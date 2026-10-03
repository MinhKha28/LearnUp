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
