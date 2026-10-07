import { Injectable } from '@nestjs/common';
import { CreateRubricDto } from './dto/create-rubrics.dto';
import { Prisma } from 'generated/prisma/browser';

@Injectable()
export class RubricsService {
  /** Store the Rubric of an Assignment inside the caller's transaction, ordered as submitted. */
  createMany(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assessmentId: string,
    criteria: CreateRubricDto[],
  ) {
    return tx.rubricCriterion.createMany({
      data: criteria.map((criterion, index) => ({
        organizationId,
        assessmentId,
        name: criterion.name.trim(),
        description: criterion.description.trim(),
        maxPoints: criterion.maxPoints,
        position: index + 1,
      })),
    });
  }

  /** Replace the whole Rubric (only allowed before any submission exists, BR-98). */
  async replaceAll(
    tx: Prisma.TransactionClient,
    organizationId: string,
    assessmentId: string,
    criteria: CreateRubricDto[],
  ) {
    await tx.rubricCriterion.deleteMany({ where: { assessmentId } });
    return this.createMany(tx, organizationId, assessmentId, criteria);
  }

  toResponse(c: {
    id: string;
    name: string;
    description: string;
    maxPoints: number;
    position: number;
  }) {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      maxPoints: c.maxPoints,
      position: c.position,
    };
  }
}
