import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipResponseInterceptor } from '../../common/decorators/skip-response-interceptor.decorator';
import { isAllowedImageProxyHost } from '../../common/utils/image-proxy.util';
import { ImageProxyQueryDto } from './dto/image-proxy-query.dto';
import { ImageProxyService } from './image-proxy.service';

@ApiTags('Image proxy')
@Controller('image-proxy')
export class ImageProxyController {
  private readonly logger = new Logger(ImageProxyController.name);

  constructor(private readonly imageProxyService: ImageProxyService) {}

  @Get()
  @Public()
  @SkipResponseInterceptor()
  @ApiOperation({
    summary: 'Proxy de imágenes (CORS + optimización agresiva)',
    description: [
      'Descarga desde `*.movivendor.com` y sirve con CORS.',
      'SVG: detecta `data:image/png|jpeg|webp;base64`, deduplica embeds, redimensiona a máx. 512×512 (sin ampliar),',
      'recomprime a PNG palette y sustituye el Base64.',
      'Rasters sueltos (png/jpeg/webp): mismo pipeline.',
      'Umbrales por defecto: target 512px, encoded > 80KB o memoria > 5MB también disparan optimización.',
      'Cache en memoria de resultados. Header `X-Image-Proxy-Optimized: 0|1`.',
    ].join(' '),
  })
  @ApiProduces('image/*', 'image/svg+xml', 'application/octet-stream')
  @ApiOkResponse({ description: 'Imagen (SVG/raster) posiblemente optimizada' })
  async proxy(@Query() query: ImageProxyQueryDto, @Res() res: Response) {
    let target: URL;
    try {
      target = new URL(query.url.trim());
    } catch {
      throw new BadRequestException('URL inválida');
    }

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      throw new BadRequestException('Solo se permiten URLs http/https');
    }

    if (!isAllowedImageProxyHost(target.hostname)) {
      throw new BadRequestException(
        'Host no permitido para image-proxy (solo *.movivendor.com)',
      );
    }

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
        headers: {
          Accept: 'image/svg+xml,image/*,*/*;q=0.8',
          'User-Agent': 'ServiaAPI-ImageProxy/1.1',
        },
      });
    } catch (e) {
      throw new BadGatewayException(
        `No se pudo obtener la imagen: ${e instanceof Error ? e.message : e}`,
      );
    }

    if (!upstream.ok) {
      throw new BadGatewayException(
        `Origen respondió HTTP ${upstream.status} al pedir la imagen`,
      );
    }

    const upstreamType =
      upstream.headers.get('content-type')?.split(';')[0]?.trim() ||
      'application/octet-stream';
    const raw = Buffer.from(await upstream.arrayBuffer());

    const { buffer, contentType, optimized } =
      await this.imageProxyService.optimizeResponse(raw, upstreamType);

    res.setHeader('X-Image-Proxy-Optimized', optimized ? '1' : '0');
    res.setHeader(
      'X-Image-Proxy-Bytes',
      `${raw.length}->${buffer.length}`,
    );
    if (optimized) {
      this.logger.log(
        `OK ${target.pathname} ${raw.length}→${buffer.length} B`,
      );
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  }
}
