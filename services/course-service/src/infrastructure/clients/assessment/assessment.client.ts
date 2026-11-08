import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { firstValueFrom } from 'rxjs';
import {
  ApiResponse,
  QuizListResponse,
  QuizSummary,
} from './assessment.interface';

@Injectable()
export class AssessmentClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getCourseQuizzes(
    user: CurrentUser,
    courseId: string,
  ): Promise<QuizSummary[]> {
    let result: QuizListResponse | undefined;

    try {
      const baseUrl = this.configService.getOrThrow<string>(
        'ASSESSMENT_SERVICE_URL',
      );
      const response = await firstValueFrom(
        this.httpService.get<ApiResponse<QuizListResponse>>(
          `${baseUrl.replace(/\/+$/, '')}/api/v1/assessments/quizzes`,
          {
            params: {
              courseId,
            },
            headers: this.buildHeaders(user),
          },
        ),
      );

      result = response.data.data;
    } catch {
      throw new ServiceUnavailableException({
        code: 'ASSESSMENT_UNAVAILABLE',
        message: 'Unable to retrieve Course quizzes.',
      });
    }

    // Không tin dữ liệu nhận từ một service khác.
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.meta ||
      !Number.isInteger(result.meta.total) ||
      result.meta.total !== result.items.length ||
      result.items.some(
        (quiz) =>
          !quiz ||
          typeof quiz.id !== 'string' ||
          !Number.isInteger(quiz.questionCount),
      )
    ) {
      throw new ServiceUnavailableException({
        code: 'INVALID_ASSESSMENT_RESPONSE',
        message: 'Invalid Course quiz response.',
      });
    }

    return result.items;
  }

  private buildHeaders(user: CurrentUser) {
    return {
      'x-internal-key': this.configService.getOrThrow<string>(
        'INTERNAL_SERVICE_KEY',
      ),
      'x-user-id': user.userId,
      'x-organization-id': user.organizationId!,
      'x-user-role': user.role,
    };
  }
}
