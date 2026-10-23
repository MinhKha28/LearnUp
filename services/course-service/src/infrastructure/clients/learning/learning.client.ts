import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { firstValueFrom } from 'rxjs';

import type {
  CourseLearnerCount,
  LearningApiResponse,
} from './learning.interface';

@Injectable()
export class LearningClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

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

  async getCourseLearnerCounts(
    user: CurrentUser,
    courseIds: string[],
  ): Promise<CourseLearnerCount[]> {
    if (courseIds.length === 0) {
      return [];
    }

    const baseUrl = this.configService.getOrThrow<string>(
      'LEARNING_SERVICE_URL',
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post<LearningApiResponse<CourseLearnerCount[]>>(
          `${baseUrl}/api/v1/enrollments/learner-counts`,
          {
            courseIds,
          },
          {
            headers: this.buildHeaders(user),
          },
        ),
      );

      return response.data.data ?? [];
    } catch (error) {
      console.error('Learning Service request failed:', error);

      throw new ServiceUnavailableException(
        'Unable to retrieve Course learner counts.',
      );
    }
  }

  async hasAnyLearnerCompletedLesson(
    user: CurrentUser,
    courseId: string,
    lessonId: string,
  ): Promise<boolean> {
    const baseUrl = this.configService.getOrThrow<string>(
      'LEARNING_SERVICE_URL',
    );

    try {
      const response = await firstValueFrom(
        this.httpService.get<LearningApiResponse<{ hasCompleted: boolean }>>(
          `${baseUrl}/api/v1/enrollments/course/${courseId}/lessons/${lessonId}/completion`,
          {
            headers: this.buildHeaders(user),
          },
        ),
      );

      const value = response.data.data?.hasCompleted;

      if (typeof value !== 'boolean') {
        throw new Error('Invalid Lesson completion response.');
      }

      return value;
    } catch (error) {
      console.error('Unable to check Lesson completion:', error);

      throw new ServiceUnavailableException(
        'Unable to verify Lesson completion status.',
      );
    }
  }
}
