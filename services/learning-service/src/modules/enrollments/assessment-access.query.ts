import { HttpException, Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';

export interface AssessmentAccessQuery {
  learnerId: string;
  courseId: string;
}
@Injectable()
export class AssessmentAccessQueryPipe implements PipeTransform<
  unknown,
  AssessmentAccessQuery
> {
  transform(value: unknown): AssessmentAccessQuery {
    const query = value as Record<string, unknown> | null;
    if (
      !query ||
      typeof query !== 'object' ||
      Array.isArray(query) ||
      Object.keys(query).length !== 2 ||
      Object.keys(query).some(
        (key) => key !== 'learnerId' && key !== 'courseId',
      ) ||
      typeof query.learnerId !== 'string' ||
      !isUUID(query.learnerId, 'all') ||
      typeof query.courseId !== 'string' ||
      !isUUID(query.courseId, 'all')
    ) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message:
            'Exactly one valid learnerId and courseId UUID are required.',
        },
        422,
      );
    }
    return { learnerId: query.learnerId, courseId: query.courseId };
  }
}
