import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
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

@ApiTags('Image proxy')
@Controller('image-proxy')
export class ImageProxyController {
  @Get()
  @Public()
  @SkipResponseInterceptor()
  @ApiOperation({
    summary: 'Proxy de imágenes (evita CORS en logos Movivendor)',
    description:
      'Descarga la imagen remota y la sirve desde este API. Solo hosts `*.movivendor.com`. Uso típico: `GET /api/image-proxy?url=<url-encoded>`.',
  })
  @ApiProduces('image/*', 'image/svg+xml', 'application/octet-stream')
  @ApiOkResponse({ description: 'Bytes de la imagen con Content-Type del origen' })
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
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: 'image/*,*/*;q=0.8',
          'User-Agent': 'ServiaAPI-ImageProxy/1.0',
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

    const contentType =
      upstream.headers.get('content-type')?.split(';')[0]?.trim() ||
      'application/octet-stream';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  }
}
