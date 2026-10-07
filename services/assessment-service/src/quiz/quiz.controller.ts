import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '../common/decorator/customize';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { ListQuizzesQueryDto } from './dto/list-quizzes-query.dto';
import { QuizService } from './quiz.service';

@ApiTags('UC18 / UC18.2 - Quizzes')
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
}
