import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { ListQuizzesQueryDto } from './dto/list-quizzes-query.dto';
import { QuizService } from './quiz.service';

@ApiTags('UC18 / UC18.2 / UC18.5 - Quizzes')
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

  /** UC18.5 — Delete Quiz */
  @Delete('quizzes/:id')
  @ResponseMessage('Quiz deleted successfully.')
  deleteQuiz(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteQuiz(user, id);
  }
}
