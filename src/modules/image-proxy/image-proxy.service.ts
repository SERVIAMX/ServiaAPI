import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

/** data:image/...;base64,... (png/jpeg/jpg/webp), con o sin whitespace en el payload. */
const EMBEDDED_DATA_URI_RE =
  /data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)/gi;

export type ImageProxyOptimizeOptions = {
  /** Disparar si ancho > este valor (default = targetMaxWidth). */
  triggerMaxWidth: number;
  /** Disparar si alto > este valor (default = targetMaxHeight). */
  triggerMaxHeight: number;
  /** Disparar si memoria descomprimida estimada > MB. */
  triggerMaxUncompressedMb: number;
  /** Disparar si el Base64/bytes comprimidos > KB. */
  triggerMaxEncodedKb: number;
  /** Ancho máximo de salida (default 512). Sin ampliar. */
  targetMaxWidth: number;
  /** Alto máximo de salida (default 512). Sin ampliar. */
  targetMaxHeight: number;
  /** Calidad PNG palette 1–100 (default 80). */
  pngQuality: number;
  /** Límite de píxeles de entrada Sharp (anti DoS). */
  limitInputPixels: number;
};

type OptimizeResult = {
  buffer: Buffer;
  contentType: string;
  optimized: boolean;
};

type CacheEntry = { buffer: Buffer; contentType: string; optimized: boolean };

@Injectable()
export class ImageProxyService {
  private readonly logger = new Logger(ImageProxyService.name);

  /** Cache en memoria por hash del cuerpo original (logos repetidos). */
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheMax = 64;

  constructor(private readonly config: ConfigService) {}

  private numEnv(key: string, fallback: number): number {
    const raw = this.config.get<string | number>(key);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  getOptions(): ImageProxyOptimizeOptions {
    const targetMaxWidth = this.numEnv('IMAGE_PROXY_TARGET_MAX_WIDTH', 512);
    const targetMaxHeight = this.numEnv(
      'IMAGE_PROXY_TARGET_MAX_HEIGHT',
      targetMaxWidth,
    );
    return {
      // Por defecto: cualquier imagen más grande que el target se optimiza.
      triggerMaxWidth: this.numEnv(
        'IMAGE_PROXY_TRIGGER_MAX_WIDTH',
        targetMaxWidth,
      ),
      triggerMaxHeight: this.numEnv(
        'IMAGE_PROXY_TRIGGER_MAX_HEIGHT',
        targetMaxHeight,
      ),
      triggerMaxUncompressedMb: this.numEnv(
        'IMAGE_PROXY_TRIGGER_MAX_UNCOMPRESSED_MB',
        5,
      ),
      triggerMaxEncodedKb: this.numEnv('IMAGE_PROXY_TRIGGER_MAX_ENCODED_KB', 80),
      targetMaxWidth,
      targetMaxHeight,
      pngQuality: Math.min(
        100,
        Math.max(1, this.numEnv('IMAGE_PROXY_PNG_QUALITY', 80)),
      ),
      limitInputPixels: this.numEnv(
        'IMAGE_PROXY_LIMIT_INPUT_PIXELS',
        50_000_000,
      ),
    };
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
    // Magic bytes
    if (body.length >= 8) {
      if (
        body[0] === 0x89 &&
        body[1] === 0x50 &&
        body[2] === 0x4e &&
        body[3] === 0x47
      ) {
        return true;
      }
      if (body[0] === 0xff && body[1] === 0xd8) return true;
      if (
        body[0] === 0x52 &&
        body[1] === 0x49 &&
        body[2] === 0x46 &&
        body[3] === 0x46
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Punto de entrada: SVG embebidos y rasters sueltos.
   */
  async optimizeResponse(
    body: Buffer,
    contentType: string,
  ): Promise<OptimizeResult> {
    const key = createHash('sha1').update(body).digest('hex');
    const hit = this.cache.get(key);
    if (hit) return { ...hit, buffer: Buffer.from(hit.buffer) };

    let result: OptimizeResult;
    if (this.isSvg(contentType, body)) {
      result = await this.optimizeSvg(body);
    } else if (this.isRaster(contentType, body)) {
      result = await this.optimizeStandaloneRaster(body, contentType);
    } else {
      result = { buffer: body, contentType, optimized: false };
    }

    this.putCache(key, result);
    return result;
  }

  /** @deprecated usar optimizeResponse */
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
      buffer: Buffer.from(entry.buffer),
      contentType: entry.contentType,
      optimized: entry.optimized,
    });
  }

  private async optimizeSvg(body: Buffer): Promise<OptimizeResult> {
    const opts = this.getOptions();
    const originalSvg = body.toString('utf8');
    const matches = [...originalSvg.matchAll(EMBEDDED_DATA_URI_RE)];
    if (matches.length === 0) {
      return {
        buffer: body,
        contentType: 'image/svg+xml',
        optimized: false,
      };
    }

    // Deduplicar Base64 idénticos: una sola pasada Sharp.
    const unique = new Map<
      string,
      { mime: string; decoded: Buffer; indices: Array<{ index: number; length: number }> }
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

    type PendingReplace = { index: number; length: number; replacement: string };
    const replacements: PendingReplace[] = [];

    await Promise.all(
      [...unique.values()].map(async (item) => {
        try {
          const out = await this.compressRaster(item.decoded, item.mime, opts, {
            forceIfSmaller: true,
          });
          if (!out) return;
          const replacement = `data:image/png;base64,${out.toString('base64')}`;
          for (const loc of item.indices) {
            replacements.push({
              index: loc.index,
              length: loc.length,
              replacement,
            });
          }
        } catch (err) {
          this.logger.warn(
            `SVG embed (${item.mime}): ${err instanceof Error ? err.message : err}`,
          );
        }
      }),
    );

    if (replacements.length === 0) {
      return {
        buffer: body,
        contentType: 'image/svg+xml',
        optimized: false,
      };
    }

    replacements.sort((a, b) => b.index - a.index);
    let svg = originalSvg;
    for (const r of replacements) {
      svg =
        svg.slice(0, r.index) + r.replacement + svg.slice(r.index + r.length);
    }

    const outBuf = Buffer.from(svg, 'utf8');
    const saved = body.length - outBuf.length;
    this.logger.log(
      `SVG optimizado: embeds=${replacements.length} ${body.length}→${outBuf.length} B (${saved > 0 ? '-' : '+'}${Math.abs(saved)} B)`,
    );

    // Si por alguna razón quedó más grande, devolver original.
    if (outBuf.length >= body.length * 0.98 && outBuf.length > body.length) {
      return {
        buffer: body,
        contentType: 'image/svg+xml',
        optimized: false,
      };
    }

    return {
      buffer: outBuf,
      contentType: 'image/svg+xml',
      optimized: true,
    };
  }

  private async optimizeStandaloneRaster(
    body: Buffer,
    contentType: string,
  ): Promise<OptimizeResult> {
    const opts = this.getOptions();
    const mime = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : 'jpeg';

    try {
      const out = await this.compressRaster(body, mime, opts, {
        forceIfSmaller: true,
      });
      if (!out || out.length >= body.length) {
        return { buffer: body, contentType, optimized: false };
      }
      this.logger.log(
        `Raster optimizado: ${mime} ${body.length}→${out.length} B`,
      );
      return {
        buffer: out,
        contentType: 'image/png',
        optimized: true,
      };
    } catch (err) {
      this.logger.warn(
        `Raster no optimizado: ${err instanceof Error ? err.message : err}`,
      );
      return { buffer: body, contentType, optimized: false };
    }
  }

  /**
   * Redimensiona + PNG palette agresivo si supera umbrales o si el resultado es más liviano.
   */
  private async compressRaster(
    decoded: Buffer,
    mimeSubtype: string,
    opts: ImageProxyOptimizeOptions,
    flags: { forceIfSmaller: boolean },
  ): Promise<Buffer | null> {
    const pipelineOpts = {
      failOn: 'none' as const,
      limitInputPixels: opts.limitInputPixels,
      sequentialRead: true,
    };

    const meta = await sharp(decoded, pipelineOpts).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width <= 0 || height <= 0) return null;

    const channels = meta.channels && meta.channels > 0 ? meta.channels : 4;
    const uncompressedMb = (width * height * channels) / (1024 * 1024);
    const encodedKb = decoded.length / 1024;

    const needsResize =
      width > opts.targetMaxWidth || height > opts.targetMaxHeight;
    const exceedsTrigger =
      width > opts.triggerMaxWidth ||
      height > opts.triggerMaxHeight ||
      uncompressedMb > opts.triggerMaxUncompressedMb ||
      encodedKb > opts.triggerMaxEncodedKb;

    if (!needsResize && !exceedsTrigger && !flags.forceIfSmaller) {
      return null;
    }

    // Si no necesita resize ni supera umbral, igual intentamos recomprimir solo si forceIfSmaller.
    const shouldProcess = needsResize || exceedsTrigger || flags.forceIfSmaller;
    if (!shouldProcess) return null;

    this.logger.debug?.(
      `compress ${mimeSubtype} ${width}x${height} enc=${encodedKb.toFixed(0)}KB raw≈${uncompressedMb.toFixed(1)}MB`,
    );

    let pipeline = sharp(decoded, pipelineOpts).rotate(); // respeta EXIF

    if (needsResize || exceedsTrigger) {
      pipeline = pipeline.resize({
        width: opts.targetMaxWidth,
        height: opts.targetMaxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // PNG palette: ideal para logos (pocos colores, con alpha).
    const out = await pipeline
      .png({
        compressionLevel: 9,
        effort: 10,
        palette: true,
        quality: opts.pngQuality,
        dither: 1.0,
      })
      .toBuffer();

    // Resize por umbral: siempre devolver (Flutter necesita dimensiones acotadas).
    if (needsResize || exceedsTrigger) {
      return out;
    }
    // Solo recompresión: aceptar si baja ≥5%.
    if (out.length < decoded.length * 0.95) return out;
    return null;
  }
}
