import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentsRepository } from './enrollments.repository';

export type AssessmentAccess = 'Full' | 'ReadOnly' | 'None';
/** BR-210, BR-211, BR-147, BR-307, BR-160: access follows stored status, never overdue display status. */
export function assessmentAccessOf(status: string): AssessmentAccess {
  switch (status) {
    case 'NotStarted':
    case 'InProgress':
    case 'Exempted':
      return 'Full';
    case 'Completed':
      return 'ReadOnly';
    case 'Halted':
    case 'Withdrawn':
      return 'None';
    default:
      throw new InternalServerErrorException({
        code: 'INVALID_ENROLLMENT_STATUS',
        message: 'Invalid enrollment status.',
      });
  }
}

@Injectable()
export class AssessmentAccessService {
  private readonly logger = new Logger(AssessmentAccessService.name);
  constructor(private readonly repository: EnrollmentsRepository) {}
  async get(learnerId: string, courseId: string, organizationId: string) {
    const row = await this.repository.findAssessmentAccess(
      learnerId,
      courseId,
      organizationId,
    );
    if (!row)
      throw new NotFoundException({
        code: 'ENROLLMENT_NOT_FOUND',
        message: 'Enrollment not found.',
      });
    try {
      return {
        enrollmentId: row.id,
        status: row.status,
        access: assessmentAccessOf(row.status),
      };
    } catch (error) {
      this.logger.error(
        'Invalid stored enrollment status while resolving assessment access.',
      );
      throw error;
    }
  }
}
