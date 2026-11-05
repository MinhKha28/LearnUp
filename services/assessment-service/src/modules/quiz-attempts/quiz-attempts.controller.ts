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
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { QuizAttemptsService } from './quiz-attempts.service';

@ApiTags('UC29.1 - Take a Quiz')
@ApiSecurity('internal-key')
@Controller('assessments/learner/quizzes')
export class QuizAttemptsController {
  constructor(private readonly service: QuizAttemptsService) {}

  /** UC29.1 step 1 - the Quiz before starting: passing score, time limit, tries left, lock, the attempt to continue. */
  @Get(':id')
  @ApiOperation({ summary: 'The Quiz as the Learner sees it before starting' })
  @ResponseMessage('Quiz retrieved successfully.')
  getQuiz(@User() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getQuiz(user, id);
  }

  /** UC29.1 - Start an attempt; asking again while one is running returns that attempt. */
  @Post(':id/attempts')
  @ApiOperation({
    summary: 'Start an attempt (or get back the one that is running)',
  })
  @ResponseMessage('Attempt started successfully.')
  start(@User() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.start(user, id);
  }

  /** The attempt: questions with the answers saved so far while it runs, the result once it is over. */
  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'The running attempt, or its result when over' })
  @ResponseMessage('Attempt retrieved successfully.')
  getAttempt(
    @User() user: CurrentUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.service.getAttempt(user, attemptId);
  }

  /** UC29.1 - Save the choice of one question at once. */
  @Put('attempts/:attemptId/answers/:questionId')
  @ApiOperation({ summary: 'Save the answer of one question' })
  @ResponseMessage('Answer saved successfully.')
  saveAnswer(
    @User() user: CurrentUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.service.saveAnswer(user, attemptId, questionId, dto.optionIds);
  }

  /** UC29.1 - Submit the attempt; the answer is the result. */
  @Post('attempts/:attemptId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit the attempt and get the result' })
  @ResponseMessage('Attempt submitted successfully.')
  submit(
    @User() user: CurrentUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.service.submit(user, attemptId);
  }
}
