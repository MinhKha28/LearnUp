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
  Query,
  Res,
} from '@nestjs/common';
import {
  type ApiResponseSchemaHost,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { LearnerReviewsService } from './learner-reviews.service';

/** A schema of the OpenAPI document, as `@ApiResponse` takes it. */
type SchemaObject = NonNullable<ApiResponseSchemaHost['schema']>;

const REVIEW_ID = {
  name: 'reviewId',
  description: 'The id of a review assigned to the signed-in Learner.',
  format: 'uuid',
} as const;

/** The errors every call of a Learner can get: no internal key, not a Learner, or an Enrollment that is not active. */
const UNAUTHORIZED = {
  status: 401,
  description: 'The internal key is missing or wrong.',
} as const;
const FORBIDDEN = {
  status: 403,
  description:
    'The caller is not a Learner (`FORBIDDEN`), or is not enrolled in the Course of the Assignment (`NOT_ENROLLED`).',
} as const;

/** The envelope of a JSON answer: `{ statusCode, message, data }`. */
const envelope = (data: Record<string, SchemaObject>): SchemaObject => ({
  type: 'object',
  properties: {
    statusCode: { type: 'integer' },
    message: { type: 'string' },
    data: { type: 'object', properties: data },
  },
});

const ITEM: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    assignmentId: { type: 'string', format: 'uuid' },
    assignmentTitle: { type: 'string' },
    courseId: { type: 'string', format: 'uuid' },
    status: { type: 'string', description: 'Pending, Completed or Missed.' },
    state: {
      type: 'string',
      enum: ['Open', 'Done', 'Closed'],
      description:
        'Open: can be given now. Done: given, final. Closed: the deadline passed or it was marked Missed.',
    },
    reviewDueAt: { type: 'string', format: 'date-time', nullable: true },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    score: { type: 'number', nullable: true },
  },
};

@ApiTags('UC31 / UC31.1 - Learner peer reviews')
@ApiSecurity('internal-key')
@Controller('assessments/learner/peer-reviews')
export class LearnerReviewsController {
  constructor(private readonly service: LearnerReviewsService) {}

  /** UC31 — the reviews assigned to the Learner, with the deadline of their cycle. */
  @Get()
  @ApiOperation({
    summary: 'The reviews assigned to the Learner (one page of the queue)',
    description:
      'The ones to give first (the earliest deadline first), then the given, then the closed. `pendingCount` counts the whole queue, not the page. Nothing in it says who wrote the work (BR-233). A review whose reviewer was taken off the work (Removed) or whose review lapsed (Expired) is not listed.',
  })
  @ApiResponse({
    status: 200,
    description: 'One page of the queue.',
    schema: envelope({
      pendingCount: { type: 'integer' },
      total: { type: 'integer' },
      page: { type: 'integer' },
      pageSize: { type: 'integer' },
      items: { type: 'array', items: ITEM },
    }),
  })
  @ApiResponse({
    status: 400,
    description: '`page` or `pageSize` is not a whole number in its range.',
  })
  @ApiResponse(UNAUTHORIZED)
  @ApiResponse(FORBIDDEN)
  @ResponseMessage('Peer reviews retrieved successfully.')
  list(@User() user: CurrentUser, @Query() query: ListReviewsQueryDto) {
    return this.service.list(user, query);
  }

  /** UC31 — one review: the work without its author, the Rubric, and the review so far. */
  @Get(':reviewId')
  @ApiOperation({
    summary: 'One review: the work to review, the Rubric and the review so far',
    description:
      'The work comes without its author, a submission id or a date of the author (BR-233); its file has a neutral name. The prompt file, when the Assignment has one, is read through the route of UC30.',
  })
  @ApiParam(REVIEW_ID)
  @ApiResponse({
    status: 200,
    description: 'The review, with `assignment`, `submission` and `myReview`.',
    schema: envelope({
      ...ITEM.properties,
      assignment: { type: 'object' },
      submission: { type: 'object' },
      myReview: { type: 'object', nullable: true },
    }),
  })
  @ApiResponse({ status: 400, description: '`reviewId` is not a UUID.' })
  @ApiResponse(UNAUTHORIZED)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({
    status: 404,
    description:
      '`REVIEW_NOT_FOUND`: the review is not the caller’s, is of another Organization, is the Instructor’s, or its access ended (Removed, Expired).',
  })
  @ApiResponse({
    status: 409,
    description:
      '`ENROLLMENT_NOT_ACTIVE`: the Enrollment is Halted or Withdrawn (a Completed one still reads, BR-211).',
  })
  @ResponseMessage('Peer review retrieved successfully.')
  detail(
    @User() user: CurrentUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.service.detail(user, reviewId);
  }

  /** UC31 — the file of the work under review, with a name that does not say whose it is. */
  @Get(':reviewId/file')
  @ApiOperation({
    summary: 'The file of the work under review',
    description:
      'Sent through this service under a neutral name (`submitted-work.pdf`), so nothing in the address or the name says whose it is (BR-233). A raw file, not the JSON envelope.',
  })
  @ApiParam(REVIEW_ID)
  @ApiProduces(
    'application/pdf',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
  )
  @ApiResponse({ status: 200, description: 'The file, as an attachment.' })
  @ApiResponse({ status: 400, description: '`reviewId` is not a UUID.' })
  @ApiResponse(UNAUTHORIZED)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({
    status: 404,
    description:
      '`REVIEW_NOT_FOUND` (as for the detail), or `REVIEW_FILE_NOT_FOUND`: the submission has no file or the storage no longer has it.',
  })
  @ApiResponse({
    status: 409,
    description: '`ENROLLMENT_NOT_ACTIVE` (as for the detail).',
  })
  @ApiResponse({
    status: 503,
    description: '`STORAGE_UNAVAILABLE`: the file cannot be read now.',
  })
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
  @ApiOperation({
    summary: 'Give the review',
    description:
      'A whole-number score for every criterion of the Rubric and a general comment that is not empty (BR-257). The score of the review is the points over the points possible, on 0-100 (BR-202). Allowed while the review is Pending, the cycle is Assigned and its deadline has not come, judged when the review gets its turn (BR-229). A review given is final. The review that completes the set of a submission decides where the submission goes (BR-251 to BR-253).',
  })
  @ApiParam(REVIEW_ID)
  @ApiResponse({
    status: 200,
    description: 'The review was given.',
    schema: envelope({
      id: { type: 'string', format: 'uuid' },
      status: { type: 'string', example: 'Completed' },
      score: { type: 'number' },
      completedAt: { type: 'string', format: 'date-time' },
      remainingInAssignment: { type: 'integer' },
    }),
  })
  @ApiResponse({
    status: 400,
    description:
      'The body is not valid: `RUBRIC_MISSING`, `RUBRIC_SCORES_INCOMPLETE` (a criterion missing, repeated or unknown), `RUBRIC_SCORE_OUT_OF_RANGE`, or an empty comment.',
  })
  @ApiResponse(UNAUTHORIZED)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({
    status: 404,
    description: '`REVIEW_NOT_FOUND` (as for the detail).',
  })
  @ApiResponse({
    status: 409,
    description:
      '`REVIEW_ALREADY_GIVEN`, `REVIEW_CLOSED` (the deadline passed or it was marked Missed), or `ENROLLMENT_NOT_ACTIVE`.',
  })
  @ResponseMessage('Peer review given successfully.')
  submit(
    @User() user: CurrentUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.service.submit(user, reviewId, dto);
  }
}
