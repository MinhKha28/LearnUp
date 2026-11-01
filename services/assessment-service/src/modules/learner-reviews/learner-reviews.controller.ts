import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { LearnerReviewsService } from './learner-reviews.service';

@ApiTags('UC31 / UC31.1 - Learner peer reviews')
@ApiSecurity('internal-key')
@Controller('assessments/learner/peer-reviews')
export class LearnerReviewsController {
  constructor(private readonly service: LearnerReviewsService) {}

  /** UC31 — the reviews assigned to the Learner, with the deadline of their cycle. */
  @Get()
  @ResponseMessage('Peer reviews retrieved successfully.')
  list(@User() user: CurrentUser) {
    return this.service.list(user);
  }

  /** UC31 — one review: the work without its author, the Rubric, and the review so far. */
  @Get(':reviewId')
  @ResponseMessage('Peer review retrieved successfully.')
  detail(
    @User() user: CurrentUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.service.detail(user, reviewId);
  }

  /** UC31 — the file of the work under review, with a name that does not say whose it is. */
  @Get(':reviewId/file')
  async file(
    @User() user: CurrentUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { content, fileName, mimeType } = await this.service.file(
      user,
      reviewId,
    );
    // Sent as a raw file, so it is not wrapped like the JSON answers.
    res
      .type(mimeType)
      .set('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(content);
  }

  /** UC31.1 — give the review: a score for every criterion of the Rubric and a general comment. */
  @Post(':reviewId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Peer review given successfully.')
  submit(
    @User() user: CurrentUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.service.submit(user, reviewId, dto);
  }
}
