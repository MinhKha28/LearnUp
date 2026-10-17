import { createApiError, type CurrentUser } from '@learnup/ts-common';
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  ASSESSMENT_CLIENT,
  hasAssessmentActivity,
  type AssessmentClient,
} from '../../infrastructure/clients/assessment/assessment.client';
import { OptionalEnrollmentRepository } from './optional-enrollment.repository';
import { assertWithdrawable } from './optional-enrollment.rules';

@Injectable()
export class EnrollmentWithdrawalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollments: OptionalEnrollmentRepository,
    @Inject(ASSESSMENT_CLIENT) private readonly assessment: AssessmentClient,
  ) {}

  async withdraw(
    user: CurrentUser,
    id: string,
  ): Promise<{ outcome: 'DELETED' | 'WITHDRAWN' }> {
    if (
      ![id, user.userId, user.organizationId].every(
        (value) => typeof value === 'string' && isUUID(value, 'all'),
      )
    )
      throw new NotFoundException(
        createApiError(
          'ENROLLMENT_NOT_FOUND',
          'Không tìm thấy đăng ký Course.',
        ),
      );
    const row = await this.enrollments.findOwned(
      id,
      user.userId,
      user.organizationId!,
    );
    assertWithdrawable(row);
    let hasActivity: boolean;
    try {
      hasActivity = hasAssessmentActivity(
        await this.assessment.getActivity(user, row.courseId),
      );
    } catch {
      throw new ServiceUnavailableException(
        createApiError(
          'ASSESSMENT_UNAVAILABLE',
          'Chưa thể kiểm tra kết quả đánh giá. Vui lòng thử lại.',
        ),
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.enrollments.lock(
        tx,
        id,
        user.userId,
        user.organizationId!,
      );
      assertWithdrawable(current);
      if (hasActivity) await this.enrollments.withdraw(tx, current);
      else await this.enrollments.remove(tx, current);
      return { outcome: hasActivity ? 'WITHDRAWN' : 'DELETED' };
    });
  }
}
