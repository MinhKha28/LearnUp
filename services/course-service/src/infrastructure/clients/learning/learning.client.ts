import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { firstValueFrom } from 'rxjs';
import { logHttpClientError } from '../log-http-client-error';

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

    const path = '/api/v1/enrollments/learner-counts';
    try {
      const response = await firstValueFrom(
        this.httpService.post<LearningApiResponse<CourseLearnerCount[]>>(
          `${baseUrl}${path}`,
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
      logHttpClientError(error, 'POST', path);

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

    const path = `/api/v1/enrollments/course/${courseId}/lessons/${lessonId}/completion`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<LearningApiResponse<{ hasCompleted: boolean }>>(
          `${baseUrl}${path}`,
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
      logHttpClientError(error, 'GET', path);

      throw new ServiceUnavailableException(
        'Unable to verify Lesson completion status.',
      );
    }
  }

  async hasEverEnrolled(user: CurrentUser, courseId: string): Promise<boolean> {
    const baseUrl = this.configService.getOrThrow<string>(
      'LEARNING_SERVICE_URL',
    );

    try {
      const response = await firstValueFrom(
        this.httpService.get<
          LearningApiResponse<{
            hasEverEnrolled: boolean;
          }>
        >(
          `${baseUrl}/api/v1/enrollments/internal/courses/${courseId}/history`,
          {
            headers: this.buildHeaders(user),
          },
        ),
      );

      const value = response.data.data?.hasEverEnrolled;

      if (typeof value !== 'boolean') {
        throw new Error('Invalid enrollment history response.');
      }

      return value;
    } catch {
      throw new ServiceUnavailableException({
        code: 'ENROLLMENT_CHECK_UNAVAILABLE',
        message: 'Không thể kiểm tra lịch sử Enrollment.',
      });
    }
  }
}
