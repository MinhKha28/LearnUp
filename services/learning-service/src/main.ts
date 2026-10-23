import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  configureApp(app);
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LearnUP Learning Service API')
    .setDescription('Enrollment, learning progress and completion APIs')
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-internal-key',
        in: 'header',
      },
      'internal-key',
    )
    .build();

  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(configService.get<string>('PORT') ?? 3000);
}

void bootstrap();
