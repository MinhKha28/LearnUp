import { Injectable } from '@nestjs/common';
import type { Prisma } from 'generated/prisma/browser';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { assignmentInclude } from '../assessments/assessments.repository';

/** Database access of UC19.5; the Peer Review settings live on the Assignment row. */
@Injectable()
export class PeerReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  updateConfig(assignmentId: string, data: Prisma.AssessmentUpdateInput) {
    return this.prisma.assessment.update({
      where: { id: assignmentId },
      data,
      include: assignmentInclude,
    });
  }
}
