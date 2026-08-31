import './set-tz';

import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ProspectEstatus } from './common/enums/prospect-estatus.enum';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new ResponseInterceptor(reflector),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(config));

  const corsOrigin = config.get<string>('CORS_ORIGIN', '*');
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('ServiaAPI')
    .setDescription('API de recargas de tiempo aire')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ProspectEstatus = {
    type: 'integer',
    enum: [
      ProspectEstatus.NUEVO,
      ProspectEstatus.EN_SEGUIMIENTO,
      ProspectEstatus.CONVERTIDO,
      ProspectEstatus.DESCARTADO,
    ],
    description: [
      'Estatus del prospecto en el pipeline comercial.',
      '1 = NUEVO — Recién registrado',
      '2 = EN_SEGUIMIENTO — En contacto / negociación',
      '3 = CONVERTIDO — Pasó a cliente',
      '4 = DESCARTADO — Rechazado o eliminado',
    ].join(' '),
  };
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('APP_PORT', 3000);
  await app.listen(port);
}

bootstrap();
