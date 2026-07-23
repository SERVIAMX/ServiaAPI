import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * PNG/JPEG/WebP embebidos en SVG:
 * <image xlink:href="data:image/png;base64,...">
 * o href="data:image/..."
 */
const EMBEDDED_DATA_URI_RE =
  /data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)/gi;

const OPTIMIZED_MARKER = '<!-- servia-image-proxy-optimized -->';

/**
 * TEMPORAL: volcar PNG original/optimizado + stats de píxeles a disco
 * para validar que el resize no genera un buffer vacío/transparente.
 * Quitar cuando se confirme el contenido visual del logo.
 */
const IMAGE_PROXY_DEBUG_DUMP = true;
const IMAGE_PROXY_DEBUG_DIR = join(process.cwd(), 'tmp', 'image-proxy-debug');

type PngPixelStats = {
  width: number;
  height: number;
  channels: number;
  opaque: number;
  semi: number;
  clear: number;
  nonZeroRgb: number;
  avgR: number;
  avgG: number;
  avgB: number;
  avgA: number;
  minLuma: number;
  maxLuma: number;
  fullyTransparent: boolean;
  hasVisibleContent: boolean;
};

export type ImageProxyOptimizeOptions = {
  /** Disparar si ancho > este valor (default 4000). */
  triggerMaxWidth: number;
  /** Disparar si alto > este valor (default 4000). */
  triggerMaxHeight: number;
  /** Disparar si memoria descomprimida estimada > MB (default 20). */
  triggerMaxUncompressedMb: number;
  /** Lado más largo máximo del PNG de salida (default 512). */
  targetMaxSide: number;
  limitInputPixels: number;
};

type OptimizeResult = {
  buffer: Buffer;
  contentType: string;
  optimized: boolean;
  kind: 'vector_svg' | 'embedded_png' | 'raster' | 'other';
};

type CacheEntry = OptimizeResult;

@Injectable()
export class ImageProxyService {
  private readonly logger = new Logger(ImageProxyService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheMax = 128;

  constructor(private readonly config: ConfigService) {}

  private numEnv(key: string, fallback: number): number {
    const raw = this.config.get<string | number>(key);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  getOptions(): ImageProxyOptimizeOptions {
    return {
      triggerMaxWidth: this.numEnv('IMAGE_PROXY_TRIGGER_MAX_WIDTH', 4000),
      triggerMaxHeight: this.numEnv('IMAGE_PROXY_TRIGGER_MAX_HEIGHT', 4000),
      triggerMaxUncompressedMb: this.numEnv(
        'IMAGE_PROXY_TRIGGER_MAX_UNCOMPRESSED_MB',
        20,
      ),
      targetMaxSide: this.numEnv('IMAGE_PROXY_TARGET_MAX_SIDE', 512),
      limitInputPixels: this.numEnv(
        'IMAGE_PROXY_LIMIT_INPUT_PIXELS',
        268_435_456, // ~16384²
      ),
    };
  }

  private logProxy(message: string): void {
    this.logger.log(`[IMAGE_PROXY]\n${message}`);
  }

  isSvg(contentType: string, body: Buffer): boolean {
    const ct = contentType.toLowerCase();
    if (ct.includes('svg')) return true;
    const head = body.subarray(0, Math.min(body.length, 512)).toString('utf8');
    const trimmed = head.replace(/^\uFEFF/, '').trimStart();
    return (
      trimmed.startsWith('<?xml') ||
      trimmed.startsWith('<svg') ||
      /<svg[\s>]/i.test(trimmed)
    );
  }

  isRaster(contentType: string, body: Buffer): boolean {
    const ct = contentType.toLowerCase();
    if (
      ct.includes('png') ||
      ct.includes('jpeg') ||
      ct.includes('jpg') ||
      ct.includes('webp') ||
      ct.includes('gif')
    ) {
      return true;
    }
    if (body.length >= 8) {
      if (body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) {
        return true;
      }
      if (body[0] === 0xff && body[1] === 0xd8) return true;
      if (body[0] === 0x52 && body[1] === 0x49 && body[2] === 0x46 && body[3] === 0x46) {
        return true;
      }
    }
    return false;
  }

  async optimizeResponse(
    body: Buffer,
    contentType: string,
  ): Promise<OptimizeResult> {
    const key = createHash('sha1').update(body).digest('hex');
    const hit = this.cache.get(key);
    if (hit) {
      return { ...hit, buffer: Buffer.from(hit.buffer) };
    }

    let result: OptimizeResult;
    if (this.isSvg(contentType, body)) {
      result = await this.optimizeSvg(body);
    } else if (this.isRaster(contentType, body)) {
      result = await this.optimizeStandaloneRaster(body, contentType);
    } else {
      result = {
        buffer: body,
        contentType,
        optimized: false,
        kind: 'other',
      };
    }

    this.putCache(key, result);
    // También cachear el resultado optimizado para no reprocesar si alguien
    // vuelve a pedir el mismo SVG ya reescrito (mismo hash de salida).
    if (result.optimized) {
      const outKey = createHash('sha1').update(result.buffer).digest('hex');
      this.putCache(outKey, { ...result, optimized: false, kind: result.kind });
    }

    return result;
  }

  async optimizeSvgIfNeeded(
    body: Buffer,
    contentType: string,
  ): Promise<OptimizeResult> {
    return this.optimizeResponse(body, contentType);
  }

  private putCache(key: string, entry: OptimizeResult): void {
    if (this.cache.size >= this.cacheMax) {
      const first = this.cache.keys().next().value as string | undefined;
      if (first) this.cache.delete(first);
    }
    this.cache.set(key, {
      ...entry,
      buffer: Buffer.from(entry.buffer),
    });
  }

  private async optimizeSvg(body: Buffer): Promise<OptimizeResult> {
    const opts = this.getOptions();
    const originalSvg = body.toString('utf8');

    // Ya pasó por el proxy: no volver a tocar.
    if (originalSvg.includes(OPTIMIZED_MARKER)) {
      this.logProxy('embedded_png\nalready_optimized=true');
      return {
        buffer: body,
        contentType: 'image/svg+xml',
        optimized: false,
        kind: 'embedded_png',
      };
    }

    const matches = [...originalSvg.matchAll(EMBEDDED_DATA_URI_RE)];
    if (matches.length === 0) {
      this.logProxy('vector_svg');
      return {
        buffer: body,
        contentType: 'image/svg+xml',
        optimized: false,
        kind: 'vector_svg',
      };
    }

    // Deduplicar Base64 idénticos.
    const unique = new Map<
      string,
      {
        mime: string;
        decoded: Buffer;
        indices: Array<{ index: number; length: number }>;
      }
    >();

    for (const match of matches) {
      const full = match[0];
      const index = match.index ?? -1;
      if (index < 0) continue;
      const mime = match[1].toLowerCase();
      const b64 = match[2].replace(/\s+/g, '');
      if (!b64 || b64.length < 32) continue;

      let decoded: Buffer;
      try {
        decoded = Buffer.from(b64, 'base64');
      } catch {
        continue;
      }
      if (decoded.length < 32) continue;

      const hash = createHash('sha1').update(decoded).digest('hex');
      const entry = unique.get(hash);
      if (entry) {
        entry.indices.push({ index, length: full.length });
      } else {
        unique.set(hash, {
          mime,
          decoded,
          indices: [{ index, length: full.length }],
        });
      }
    }

    type PendingReplace = {
      index: number;
      length: number;
      replacement: string;
    };
    const replacements: PendingReplace[] = [];
    let sawEmbed = false;

    for (const item of unique.values()) {
      try {
        const pipelineOpts = {
          failOn: 'none' as const,
          limitInputPixels: opts.limitInputPixels,
          sequentialRead: false,
        };
        const meta = await sharp(item.decoded, pipelineOpts).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        if (width <= 0 || height <= 0) continue;

        sawEmbed = true;
        this.logProxy(
          `embedded_png\nwidth=${width}\nheight=${height}`,
        );

        // Todos los embeds: normalizar PNG; el SVG solo cambia el data-URI.
        const resized = await this.normalizeEmbeddedRaster(
          item.decoded,
          width,
          height,
          opts,
        );
        if (!resized) continue;

        const didResize =
          resized.width !== width || resized.height !== height;
        this.logProxy(
          `optimized_png\nnewWidth=${resized.width}\nnewHeight=${resized.height}\nresized=${didResize}`,
        );

        // Conservar el mismo esquema data:image/...;base64, — solo el payload.
        const b64 = resized.buffer.toString('base64');
        const replacement = `data:image/png;base64,${b64}`;

        // TEMPORAL: confirmar que el Base64 del SVG == buffer optimizado.
        const roundtrip = Buffer.from(b64, 'base64');
        const hashBuf = createHash('sha1').update(resized.buffer).digest('hex');
        const hashB64 = createHash('sha1').update(roundtrip).digest('hex');
        const base64Matches =
          hashBuf === hashB64 && roundtrip.length === resized.buffer.length;
        this.logProxy(
          `base64_check\nsha1=${hashBuf}\nmatches=${base64Matches}\nbytes=${resized.buffer.length}`,
        );
        if (!base64Matches) {
          this.logger.error(
            '[IMAGE_PROXY] Base64 insertado NO coincide con el PNG optimizado',
          );
        }

        if (IMAGE_PROXY_DEBUG_DUMP) {
          await this.dumpOptimizedPngDebug({
            sourceHash: createHash('sha1').update(item.decoded).digest('hex'),
            original: item.decoded,
            optimized: resized.buffer,
            stats: resized.stats,
            base64Matches,
            hashBuf,
          });
        }

        if (resized.stats.fullyTransparent) {
          this.logger.error(
            '[IMAGE_PROXY] PNG optimizado completamente transparente (alpha=0 en todos los píxeles)',
          );
        } else if (!resized.stats.hasVisibleContent) {
          this.logger.warn(
            '[IMAGE_PROXY] PNG optimizado sin RGB visible (posible logo blanco/negro puro o vacío)',
          );
        }

        for (const loc of item.indices) {
          replacements.push({
            index: loc.index,
            length: loc.length,
            replacement,
          });
        }
      } catch (err) {
        this.logger.warn(
          `[IMAGE_PROXY] embed_error mime=${item.mime}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (replacements.length === 0) {
      if (sawEmbed) {
        this.logProxy('embedded_png\nrewrite=skipped');
        return {
          buffer: body,
          contentType: 'image/svg+xml',
          optimized: false,
          kind: 'embedded_png',
        };
      }
      this.logProxy('vector_svg');
      return {
        buffer: body,
        contentType: 'image/svg+xml',
        optimized: false,
        kind: 'vector_svg',
      };
    }

    // Único cambio permitido: sustituir el data-URI (Base64). Cero toques a
    // <svg>, viewBox, preserveAspectRatio, <image> x/y/width/height/transform, xmlns.
    replacements.sort((a, b) => b.index - a.index);
    let svg = originalSvg;
    for (const r of replacements) {
      svg =
        svg.slice(0, r.index) + r.replacement + svg.slice(r.index + r.length);
    }

    this.assertSvgGeometryPreserved(originalSvg, svg);
    this.logProxy('svg_rewritten\nmode=base64_only');

    return {
      buffer: Buffer.from(svg, 'utf8'),
      contentType: 'image/svg+xml',
      optimized: true,
      kind: 'embedded_png',
    };
  }

  /**
   * Normaliza CUALQUIER raster embebido (todos los logos, no un SKU concreto):
   * sRGB + alpha + PNG truecolor; redimensiona si el lado largo > targetMaxSide.
   */
  private async normalizeEmbeddedRaster(
    decoded: Buffer,
    width: number,
    height: number,
    opts: ImageProxyOptimizeOptions,
  ): Promise<{
    buffer: Buffer;
    width: number;
    height: number;
    stats: PngPixelStats;
  } | null> {
    const pipelineOpts = {
      failOn: 'none' as const,
      limitInputPixels: opts.limitInputPixels,
      sequentialRead: false,
    };

    const longest = Math.max(width, height);
    const needsResize = longest > opts.targetMaxSide;

    let pipeline = sharp(decoded, pipelineOpts)
      .rotate()
      .toColorspace('srgb')
      .ensureAlpha();

    if (needsResize) {
      pipeline = pipeline.resize({
        width: opts.targetMaxSide,
        height: opts.targetMaxSide,
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3',
      });
    }

    const out = await pipeline
      .png({
        compressionLevel: 9,
        effort: 10,
        adaptiveFiltering: true,
        palette: false,
      })
      .toBuffer({ resolveWithObject: true });

    const newWidth = out.info.width ?? 0;
    const newHeight = out.info.height ?? 0;
    if (newWidth <= 0 || newHeight <= 0) return null;

    const stats = await this.analyzePngPixels(out.data);
    this.logProxy(
      [
        'png_pixel_stats',
        `width=${stats.width}`,
        `height=${stats.height}`,
        `opaque=${stats.opaque}`,
        `semi=${stats.semi}`,
        `clear=${stats.clear}`,
        `nonZeroRgb=${stats.nonZeroRgb}`,
        `avgRGBA=${stats.avgR},${stats.avgG},${stats.avgB},${stats.avgA}`,
        `luma=${stats.minLuma}..${stats.maxLuma}`,
        `fullyTransparent=${stats.fullyTransparent}`,
        `hasVisibleContent=${stats.hasVisibleContent}`,
      ].join('\n'),
    );

    if (stats.fullyTransparent) {
      this.logger.warn(
        '[IMAGE_PROXY] Retry normalize sin alpha (posible alpha corrupto)',
      );
      let retryPipe = sharp(decoded, pipelineOpts)
        .rotate()
        .toColorspace('srgb');
      if (needsResize) {
        retryPipe = retryPipe.resize({
          width: opts.targetMaxSide,
          height: opts.targetMaxSide,
          fit: 'inside',
          withoutEnlargement: true,
          kernel: 'lanczos3',
        });
      }
      const retry = await retryPipe
        .removeAlpha()
        .png({ compressionLevel: 9, palette: false })
        .toBuffer({ resolveWithObject: true });
      const retryStats = await this.analyzePngPixels(retry.data);
      this.logProxy(
        [
          'png_pixel_stats_retry',
          `fullyTransparent=${retryStats.fullyTransparent}`,
          `hasVisibleContent=${retryStats.hasVisibleContent}`,
          `avgRGBA=${retryStats.avgR},${retryStats.avgG},${retryStats.avgB},${retryStats.avgA}`,
        ].join('\n'),
      );
      return {
        buffer: retry.data,
        width: retry.info.width ?? newWidth,
        height: retry.info.height ?? newHeight,
        stats: retryStats,
      };
    }

    return { buffer: out.data, width: newWidth, height: newHeight, stats };
  }

  /** Analiza RGBA raw para detectar PNG vacío / totalmente transparente. */
  private async analyzePngPixels(png: Buffer): Promise<PngPixelStats> {
    const { data, info } = await sharp(png, { failOn: 'none' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let opaque = 0;
    let semi = 0;
    let clear = 0;
    let nonZeroRgb = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumA = 0;
    let minLuma = 255;
    let maxLuma = 0;
    const px = info.width * info.height;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      sumR += r;
      sumG += g;
      sumB += b;
      sumA += a;
      if (a === 0) clear++;
      else if (a === 255) opaque++;
      else semi++;
      if (a > 0 && (r > 0 || g > 0 || b > 0)) nonZeroRgb++;
      const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      if (luma < minLuma) minLuma = luma;
      if (luma > maxLuma) maxLuma = luma;
    }

    const fullyTransparent = px > 0 && clear === px;
    const hasVisibleContent = nonZeroRgb > 0 && !fullyTransparent;

    return {
      width: info.width,
      height: info.height,
      channels: info.channels,
      opaque,
      semi,
      clear,
      nonZeroRgb,
      avgR: Math.round(sumR / px),
      avgG: Math.round(sumG / px),
      avgB: Math.round(sumB / px),
      avgA: Math.round(sumA / px),
      minLuma,
      maxLuma,
      fullyTransparent,
      hasVisibleContent,
    };
  }

  /** TEMPORAL: guarda original + optimizado + JSON de stats en tmp/. */
  private async dumpOptimizedPngDebug(params: {
    sourceHash: string;
    original: Buffer;
    optimized: Buffer;
    stats: PngPixelStats;
    base64Matches: boolean;
    hashBuf: string;
  }): Promise<void> {
    try {
      mkdirSync(IMAGE_PROXY_DEBUG_DIR, { recursive: true });
      const id = params.sourceHash.slice(0, 12);
      const origPath = join(IMAGE_PROXY_DEBUG_DIR, `${id}-original.png`);
      const optPath = join(IMAGE_PROXY_DEBUG_DIR, `${id}-optimized.png`);
      const metaPath = join(IMAGE_PROXY_DEBUG_DIR, `${id}-stats.json`);

      writeFileSync(optPath, params.optimized);
      // Original puede ser enorme; guardar solo si cabe ~8MB para no llenar disco.
      if (params.original.length <= 8 * 1024 * 1024) {
        writeFileSync(origPath, params.original);
      }
      writeFileSync(
        metaPath,
        JSON.stringify(
          {
            savedAt: new Date().toISOString(),
            sourceHash: params.sourceHash,
            optimizedSha1: params.hashBuf,
            base64Matches: params.base64Matches,
            originalBytes: params.original.length,
            optimizedBytes: params.optimized.length,
            stats: params.stats,
            files: {
              optimized: optPath,
              original:
                params.original.length <= 8 * 1024 * 1024 ? origPath : null,
            },
          },
          null,
          2,
        ),
        'utf8',
      );

      this.logProxy(
        `debug_dump\noptimized=${optPath}\nfullyTransparent=${params.stats.fullyTransparent}\nhasVisibleContent=${params.stats.hasVisibleContent}`,
      );
    } catch (err) {
      this.logger.warn(
        `[IMAGE_PROXY] debug_dump_failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Comprueba que fuera de los data-URI el SVG es idéntico (atributos geométricos
   * y namespaces intactos).
   */
  private assertSvgGeometryPreserved(before: string, after: string): void {
    const stripDataUris = (s: string) =>
      s.replace(
        /data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n\t ]+/gi,
        'data:image/PLACEHOLDER;base64,',
      );

    const a = stripDataUris(before);
    const b = stripDataUris(after);
    if (a === b) {
      this.logProxy('svg_geometry\npreserved=true');
      return;
    }

    const pick = (svg: string) => {
      const root = svg.match(/<svg\b[^>]*>/i)?.[0] ?? '';
      const image = svg.match(/<image\b[^>]*>/i)?.[0] ?? '';
      return { root, image };
    };
    const pb = pick(before);
    const pa = pick(after);
    this.logger.error(
      `[IMAGE_PROXY] svg_geometry altered (solo debería cambiar Base64)\n` +
        `svgBefore=${pb.root}\nsvgAfter=${pa.root}\n` +
        `imageBefore=${pb.image.slice(0, 240)}\nimageAfter=${pa.image.slice(0, 240)}`,
    );
  }

  private async optimizeStandaloneRaster(
    body: Buffer,
    contentType: string,
  ): Promise<OptimizeResult> {
    const opts = this.getOptions();
    try {
      const meta = await sharp(body, {
        failOn: 'none',
        limitInputPixels: opts.limitInputPixels,
      }).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (width <= 0 || height <= 0) {
        return {
          buffer: body,
          contentType,
          optimized: false,
          kind: 'raster',
        };
      }

      const resized = await this.normalizeEmbeddedRaster(
        body,
        width,
        height,
        opts,
      );
      if (!resized) {
        return {
          buffer: body,
          contentType,
          optimized: false,
          kind: 'raster',
        };
      }

      this.logProxy(
        `optimized_png\nnewWidth=${resized.width}\nnewHeight=${resized.height}`,
      );

      if (IMAGE_PROXY_DEBUG_DUMP) {
        const hashBuf = createHash('sha1').update(resized.buffer).digest('hex');
        await this.dumpOptimizedPngDebug({
          sourceHash: createHash('sha1').update(body).digest('hex'),
          original: body,
          optimized: resized.buffer,
          stats: resized.stats,
          base64Matches: true,
          hashBuf,
        });
      }

      return {
        buffer: resized.buffer,
        contentType: 'image/png',
        optimized: true,
        kind: 'raster',
      };
    } catch (err) {
      this.logger.warn(
        `[IMAGE_PROXY] raster_error: ${err instanceof Error ? err.message : err}`,
      );
      return {
        buffer: body,
        contentType,
        optimized: false,
        kind: 'raster',
      };
    }
  }
}
