import { CertificateLearnerGuard } from './certificate-learner.guard';
import { CertificateListQuery } from './dto/certificate-list-query.dto';
import {
  Controller,
  Get,
  HttpException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { CurrentUser } from '@learnup/ts-common';
import { RawResponse, User } from '../../common/decorator/customize';
import { CertificatesService } from './certificates.service';
import { pdfDisposition } from './certificate-read.config';
@UseGuards(CertificateLearnerGuard)
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}
  @Get('me')
  list(@User() user: CurrentUser, @Query() query: CertificateListQuery) {
    return this.service.list(user, query);
  }
  @Get('me/:id')
  detail(@User() user: CurrentUser, @Param('id') id: string) {
    return this.service.detail(user, id);
  }
  @Get('me/:id/pdf')
  @RawResponse()
  async pdf(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const result = await this.service.pdf(user, id);
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', pdfDisposition(result.code));
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Content-Length', result.bytes.length);
      response.send(result.bytes);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 503)
        response.setHeader('Retry-After', '1');
      throw error;
    }
  }
}
