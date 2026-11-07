import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  AssessmentApiResponse,
  AssessmentCleanupResponse,
} from './assessment.interface';

@Injectable()
export class AssessmentClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async deleteCourseAssessments(
    organizationId: string,
    courseId: string,
  ): Promise<AssessmentCleanupResponse> {
    const baseUrl = this.configService
      .getOrThrow<string>('ASSESSMENT_SERVICE_URL')
      .replace(/\/+$/, '');

    const internalKey = this.configService.getOrThrow<string>(
      'INTERNAL_SERVICE_KEY',
    );

    try {
      const response = await firstValueFrom(
        this.httpService.delete<
          AssessmentApiResponse<AssessmentCleanupResponse>
        >(`${baseUrl}/api/v1/assessments/internal/courses/${courseId}`, {
          headers: {
            'x-internal-key': internalKey,
            'x-organization-id': organizationId,
          },
        }),
      );

      const result = response.data?.data;

      if (
        !result ||
        result.courseId !== courseId ||
        result.deleted !== true ||
        !Number.isInteger(result.deletedCount) ||
        !Number.isInteger(result.deletedQuizCount) ||
        !Number.isInteger(result.deletedAssignmentCount)
      ) {
        throw new Error('Invalid Assessment cleanup response.');
      }

      return result;
    } catch {
      throw new ServiceUnavailableException({
        code: 'ASSESSMENT_CLEANUP_UNAVAILABLE',
        message: 'Unable to complete Assessment cleanup. Retry later.',
      });
    }
  }
}
