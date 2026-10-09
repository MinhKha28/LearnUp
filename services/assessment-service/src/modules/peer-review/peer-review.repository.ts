import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { assignmentInclude } from '../assessments/assessments.repository';
import type { PeerReviewUpdateData } from './interfaces/peer-review-update-data.interface';

/** Database access of UC19.5; the Peer Review settings live on the Assignment row. */
@Injectable()
export class PeerReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  updateConfig(assignmentId: string, data: PeerReviewUpdateData) {
    return this.prisma.assessment.update({
      where: { id: assignmentId },
      data,
      include: assignmentInclude,
    });
  }
}
