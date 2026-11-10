import {
  Body,
  Controller,
  Get,
  Headers,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  UseFilters,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { CurrentUser } from '@learnup/ts-common';
import { RawResponse, User } from '../../common/decorator/customize';
import { SignerService } from './signer.service';
import {
  SIGNATURE_MAX_BYTES,
  type UploadedSignature,
} from './signer.validation';
// Nest maps Multer errors before controller execution. Keep the API's safe code.
@Catch(HttpException)
export class SignerUploadFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp(),
      status = exception.getStatus();
    const error =
      status === 413
        ? { code: 'SIGNATURE_TOO_LARGE' }
        : exception.getResponse();
    ctx.getResponse<Response>().status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<{ url: string }>().url,
      error,
    });
  }
}
@Controller('certificates/signer-settings')
export class SignerController {
  constructor(private readonly service: SignerService) {}
  @Get()
  async get(
    @User() user: CurrentUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.get(user);
    response.setHeader('ETag', `"${result.version}"`);
    return result;
  }
  @Put()
  @UseFilters(SignerUploadFilter)
  @UseInterceptors(
    FileInterceptor('signature', {
      limits: {
        fileSize: SIGNATURE_MAX_BYTES,
        files: 1,
        fields: 3,
        fieldSize: 4096,
        parts: 4,
      },
    }),
  )
  async put(
    @User() user: CurrentUser,
    @Headers('if-match') match: string | undefined,
    @Body() body: unknown,
    @UploadedFile() file: UploadedSignature | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.put(user, match, body, file);
    response.setHeader('ETag', `"${result.version}"`);
    return result;
  }
  @Get('signature')
  @RawResponse()
  async signature(
    @User() user: CurrentUser,
    @Res() response: Response,
  ): Promise<void> {
    const image = await this.service.signature(user);
    response.setHeader('Content-Type', image.mime);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(image.bytes);
  }
}
