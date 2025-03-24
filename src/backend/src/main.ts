import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet'
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true
  }))

  // TODO pass in the CORS options
  app.enableCors()

  app.use(helmet())
  app.use(cookieParser())

  console.log(process.env.DB_HOST)
  console.log(process.env.JWT_SECRET)

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
