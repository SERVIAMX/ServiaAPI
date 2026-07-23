import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

/**
 * PNG/JPEG/WebP embebidos en SVG:
 * <image xlink:href="data:image/png;base64,...">
 * o href="data:image/..."
 */
const EMBEDDED_DATA_URI_RE =
  /data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)/gi;

const OPTIMIZED_MARKER = '<!-- servia-image-proxy-optimized -->';

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
      outWidth: number;
      outHeight: number;
    };
    const replacements: PendingReplace[] = [];
    let sawEmbed = false;

    for (const item of unique.values()) {
      try {
        const pipelineOpts = {
          failOn: 'none' as const,
          limitInputPixels: opts.limitInputPixels,
          sequentialRead: true,
        };
        const meta = await sharp(item.decoded, pipelineOpts).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        if (width <= 0 || height <= 0) continue;

        sawEmbed = true;
        const channels = meta.channels && meta.channels > 0 ? meta.channels : 4;
        const uncompressedMb = (width * height * channels) / (1024 * 1024);

        this.logProxy(
          `embedded_png\nwidth=${width}\nheight=${height}`,
        );

        const exceeds =
          width > opts.triggerMaxWidth ||
          height > opts.triggerMaxHeight ||
          uncompressedMb > opts.triggerMaxUncompressedMb;

        // Solo redimensionar si es "gigante". SVG vectorial o embeds chicos: intactos.
        if (!exceeds) {
          continue;
        }

        const resized = await this.resizeEmbeddedPng(
          item.decoded,
          width,
          height,
          opts,
        );
        if (!resized) continue;

        this.logProxy(
          `optimized_png\nnewWidth=${resized.width}\nnewHeight=${resized.height}`,
        );

        const replacement = `data:image/png;base64,${resized.buffer.toString('base64')}`;
        for (const loc of item.indices) {
          replacements.push({
            index: loc.index,
            length: loc.length,
            replacement,
            outWidth: resized.width,
            outHeight: resized.height,
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

    replacements.sort((a, b) => b.index - a.index);
    let svg = originalSvg;
    for (const r of replacements) {
      svg =
        svg.slice(0, r.index) + r.replacement + svg.slice(r.index + r.length);
      svg = this.patchImageTagDimensionsNear(
        svg,
        r.index,
        r.outWidth,
        r.outHeight,
      );
    }

    if (!svg.includes(OPTIMIZED_MARKER)) {
      // Marca al inicio del documento para no reoptimizar si se reinyecta.
      if (svg.startsWith('<?xml')) {
        const endDecl = svg.indexOf('?>');
        if (endDecl >= 0) {
          svg =
            svg.slice(0, endDecl + 2) +
            `\n${OPTIMIZED_MARKER}\n` +
            svg.slice(endDecl + 2);
        } else {
          svg = `${OPTIMIZED_MARKER}\n${svg}`;
        }
      } else {
        svg = `${OPTIMIZED_MARKER}\n${svg}`;
      }
    }

    this.logProxy('svg_rewritten');

    return {
      buffer: Buffer.from(svg, 'utf8'),
      contentType: 'image/svg+xml',
      optimized: true,
      kind: 'embedded_png',
    };
  }

  /**
   * Reduce dimensiones reales (no solo peso). Lado más largo = targetMaxSide.
   * Conserva alpha / transparencia.
   */
  private async resizeEmbeddedPng(
    decoded: Buffer,
    width: number,
    height: number,
    opts: ImageProxyOptimizeOptions,
  ): Promise<{ buffer: Buffer; width: number; height: number } | null> {
    const longest = Math.max(width, height);
    if (longest <= opts.targetMaxSide) {
      return null;
    }

    const pipelineOpts = {
      failOn: 'none' as const,
      limitInputPixels: opts.limitInputPixels,
      sequentialRead: true,
    };

    const out = await sharp(decoded, pipelineOpts)
      .rotate()
      .resize({
        width: opts.targetMaxSide,
        height: opts.targetMaxSide,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .png({
        compressionLevel: 9,
        effort: 10,
        adaptiveFiltering: true,
      })
      .toBuffer({ resolveWithObject: true });

    const newWidth = out.info.width ?? 0;
    const newHeight = out.info.height ?? 0;
    if (newWidth <= 0 || newHeight <= 0) return null;

    return { buffer: out.data, width: newWidth, height: newHeight };
  }

  private patchImageTagDimensionsNear(
    svg: string,
    dataUriIndex: number,
    width: number,
    height: number,
  ): string {
    const before = svg.slice(0, dataUriIndex);
    const openIdx = before.lastIndexOf('<image');
    if (openIdx < 0) return svg;

    const tagSlice = svg.slice(openIdx, dataUriIndex);
    if (!/^<image\b/i.test(tagSlice)) return svg;

    let patched = tagSlice;
    if (/\bwidth\s*=\s*["'][^"']*["']/i.test(patched)) {
      patched = patched.replace(
        /\bwidth\s*=\s*["'][^"']*["']/i,
        `width="${width}"`,
      );
    } else {
      patched = patched.replace(/<image\b/i, `<image width="${width}"`);
    }
    if (/\bheight\s*=\s*["'][^"']*["']/i.test(patched)) {
      patched = patched.replace(
        /\bheight\s*=\s*["'][^"']*["']/i,
        `height="${height}"`,
      );
    } else {
      patched = patched.replace(/<image\b/i, `<image height="${height}"`);
    }

    return svg.slice(0, openIdx) + patched + svg.slice(dataUriIndex);
  }

  private async optimizeStandaloneRaster(
    body: Buffer,
    contentType: string,
  ): Promise<OptimizeResult> {
    // Rasters sueltos: solo redimensionar si superan el mismo umbral "gigante".
    const opts = this.getOptions();
    try {
      const meta = await sharp(body, {
        failOn: 'none',
        limitInputPixels: opts.limitInputPixels,
      }).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      const channels = meta.channels && meta.channels > 0 ? meta.channels : 4;
      const uncompressedMb = (width * height * channels) / (1024 * 1024);
      const exceeds =
        width > opts.triggerMaxWidth ||
        height > opts.triggerMaxHeight ||
        uncompressedMb > opts.triggerMaxUncompressedMb;

      if (!exceeds) {
        return {
          buffer: body,
          contentType,
          optimized: false,
          kind: 'raster',
        };
      }

      const resized = await this.resizeEmbeddedPng(body, width, height, opts);
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
