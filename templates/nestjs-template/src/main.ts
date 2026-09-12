import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  HttpExceptionFilter,
  ResponseTransformInterceptor,
  TenantContextInterceptor,
} from '@learnup/common-ts/adapters/nestjs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global cross-cutting interceptors and filters
  app.useGlobalInterceptors(
    new TenantContextInterceptor(),
    new ResponseTransformInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.SERVER_PORT || 8083;
  await app.listen(port);
  console.log(`NestJS Service Template running on port: ${port}`);
}
bootstrap();
