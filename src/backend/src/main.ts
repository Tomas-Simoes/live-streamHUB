import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const allowedOrigins = (
    process.env.CORS_ORIGIN || 'http://localhost:4200,http://127.0.0.1:4200'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        isLocalDevOrigin(origin) ||
        isOverwolfOrigin(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin ${origin} is not allowed`));
    },
    credentials: true,
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  const uploadsRoot = join(process.cwd(), 'uploads');

  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }

  app.useStaticAssets(uploadsRoot, { prefix: '/uploads/' });

  initSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}

function isLocalDevOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');

    return (
      url.protocol === 'http:' &&
      isAngularDevServerPort(port) &&
      isPrivateNetworkHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

function isAngularDevServerPort(port: string) {
  const portNumber = Number(port);

  return Number.isInteger(portNumber) && portNumber >= 4200 && portNumber <= 4299;
}

function isOverwolfOrigin(origin: string) {
  try {
    const url = new URL(origin);

    if (url.protocol === 'overwolf:' || url.protocol === 'overwolf-extension:') {
      return true;
    }

    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.overwolf.com' &&
      (url.pathname === '/' || /^\/[a-z0-9]+$/i.test(url.pathname))
    );
  } catch {
    return (
      /^overwolf(?:-extension)?:\/\//i.test(origin) ||
      /^https:\/\/www\.overwolf\.com\/[a-z0-9]+$/i.test(origin)
    );
  }
}

function isPrivateNetworkHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

function initSwagger(app: NestExpressApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Live StreamHUB API')
    .setDescription(
      'Hosted API for authentication, user profiles, and saved hub layouts.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Use the access token returned by /auth/login.',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Use "Refresh <refreshToken>" for /session/refresh.',
      },
      'refresh-token',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    jsonDocumentUrl: 'api/docs-json',
  });
}

void bootstrap();
