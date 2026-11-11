import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { ListQuizzesQueryDto } from './dto/list-quizzes-query.dto';
import { UpdateQuizConfigDto } from './dto/update-quiz.dto';
import { QuizService } from './quiz.service';

@ApiTags('UC18 / UC18.1 / UC18.1.1 / UC18.2 / UC18.3 / UC18.4 - Quizzes')
@ApiSecurity('internal-key')
@Controller('assessments')
export class QuizController {
  constructor(private readonly service: QuizService) {}

  /** UC18 — List Quizzes of a Course (or of one Module) */
  @Get('quizzes')
  @ResponseMessage('Quizzes retrieved successfully.')
  listQuizzes(@User() user: CurrentUser, @Query() query: ListQuizzesQueryDto) {
    return this.service.listQuizzes(user, query);
  }

  /** UC18.2 — Create Quiz */
  @Post('quizzes')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Quiz created successfully.')
  createQuiz(@User() user: CurrentUser, @Body() dto: CreateQuizDto) {
    return this.service.createQuiz(user, dto);
  }

  /**
   * UC18.1 — View Quiz detail.
   * INSTRUCTOR only: the answer returns every option with `isCorrect` (the answer key).
   * UC29.1 (the Learner taking a Quiz) must NOT reuse this route or QuizService.getQuiz; it needs its own
   * Learner endpoint that never sends `isCorrect`.
   */
  @Get('quizzes/:id')
  @ResponseMessage('Quiz retrieved successfully.')
  getQuiz(@User() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getQuiz(user, id);
  }

  /** UC18.3 — Update Quiz configuration; answers like UC18.1 with the new permissions. */
  @Patch('quizzes/:id')
  @ResponseMessage('Quiz configuration updated successfully.')
  updateQuizConfig(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuizConfigDto,
  ) {
    return this.service.updateQuizConfig(user, id, dto);
  }

  /** UC18.1.1 — Add a question with its answers at the end of a Quiz (Instructor only). */
  @Post('quizzes/:id/questions')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Question added successfully.')
  addQuestion(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuizQuestionDto,
  ) {
    return this.service.addQuestion(user, id, dto);
  }

  /** UC18.4 — Delete Quiz */
  @Delete('quizzes/:id')
  @ResponseMessage('Quiz deleted successfully.')
  deleteQuiz(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteQuiz(user, id);
  }
}
