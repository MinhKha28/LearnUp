import { ConflictException, Injectable } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';

import { AssessmentsRepository } from '../assessments/assessments.repository';
import {
  AssessmentsService,
  AUTHORABLE_STATUSES,
} from '../assessments/assessments.service';
import { UpdatePeerReviewDto } from './dto/update-peer-review.dto';
import { PeerReviewRepository } from './peer-review.repository';
import type { PeerReviewUpdateData } from './interfaces/peer-review-update-data.interface';

@Injectable()
export class PeerReviewService {
  constructor(
    private readonly repository: PeerReviewRepository,
    private readonly assessmentsRepository: AssessmentsRepository,
    private readonly assessments: AssessmentsService,
  ) {}

  /** UC19.5 — turn peer review on/off and configure its cycle (BR-182, BR-183). */
  async updateConfig(
    user: CurrentUser,
    assignmentId: string,
    dto: UpdatePeerReviewDto,
  ) {
    const { assignment, course } = await this.assessments.findOwnAssignment(
      user,
      assignmentId,
    );

    if (
      course.disabled ||
      !AUTHORABLE_STATUSES.includes(course.status.toUpperCase())
    ) {
      throw new ConflictException({
        code: 'COURSE_NOT_EDITABLE',
        message: `Peer Review cannot be changed while the Course is ${course.status}.`,
      });
    }
    // BR-185 / BR-93: only the on/off switch is blocked by Locked; the parameters stay editable.
    if (course.locked && dto.enabled !== assignment.peerReviewEnabled) {
      throw new ConflictException({
        code: 'PEER_REVIEW_TOGGLE_LOCKED',
        message:
          'Peer Review cannot be turned on or off because the Course is Locked. Create a new Course version to change it.',
      });
    }

    let data: PeerReviewUpdateData = { peerReviewEnabled: dto.enabled };
    if (dto.enabled) {
      const settings =
        await this.assessmentsRepository.findLatestPlatformSetting();
      data = {
        peerReviewEnabled: true,
        peerReviewersPerSubmission: dto.reviewersPerSubmission,
        peerReviewCycleDays:
          dto.cycleDays ??
          assignment.peerReviewCycleDays ??
          settings?.defaultPeerReviewCycleDays ??
          7,
        peerReviewDeadlineDays:
          dto.deadlineDays ??
          assignment.peerReviewDeadlineDays ??
          settings?.defaultPeerReviewDeadlineDays ??
          3,
        peerReviewScoreGap: dto.scoreGap,
      };
    }

    // BR-269: new values apply only to cycles created afterwards; existing cycles keep their dates.
    const updated = await this.repository.updateConfig(assignment.id, data);
    return this.assessments.toDetail(updated, course.locked);
  }
}
