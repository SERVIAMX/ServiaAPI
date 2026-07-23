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
    summary: 'Proxy de logos (CORS + resize PNG embebido en SVG)',
    description: [
      'Descarga desde `*.movivendor.com`.',
      'Si el SVG es vectorial (`path`/`g`/…), se devuelve igual.',
      'Si contiene `<image … data:image/…;base64>`, redimensiona el PNG embebido',
      'y sustituye ÚNICAMENTE el Base64 en href/xlink:href.',
      'No altera width/height/viewBox/transform/namespaces del SVG ni del `<image>`.',
      'No rasteriza SVG vectoriales. Mismo endpoint/contrato público.',
    ].join(' '),
  })
  @ApiProduces('image/svg+xml', 'image/*', 'application/octet-stream')
  @ApiOkResponse({ description: 'SVG (posiblemente con PNG embebido optimizado) o raster' })
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
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: 'image/svg+xml,image/*,*/*;q=0.8',
          'User-Agent': 'ServiaAPI-ImageProxy/2.0',
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

    const { buffer, contentType, optimized, kind } =
      await this.imageProxyService.optimizeResponse(raw, upstreamType);

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Image-Proxy-Optimized', optimized ? '1' : '0');
    res.setHeader('X-Image-Proxy-Kind', kind);
    res.setHeader(
      'X-Image-Proxy-Bytes',
      `${raw.length}->${buffer.length}`,
    );
    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=604800',
    );
    res.setHeader('Access-Control-Allow-Origin', '*');

    this.logger.log(
      `[IMAGE_PROXY] ${target.pathname} kind=${kind} optimized=${optimized ? 1 : 0} ${raw.length}->${buffer.length}`,
    );

    res.send(buffer);
  }
}
