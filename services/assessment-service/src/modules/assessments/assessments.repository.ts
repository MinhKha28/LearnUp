import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/browser';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const KIND_ASSIGNMENT = 'ASSIGNMENT';

export const assignmentInclude = {
  rubricCriteria: { orderBy: { position: 'asc' as const } },
  _count: { select: { submissions: true } },
};

/** Every database access of the Assignment use cases (UC19 – UC19.4); the service keeps the business rules. */
@Injectable()
export class AssessmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  private db(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  findLatestPlatformSetting() {
    return this.prisma.platformSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  findAssignmentRow(organizationId: string, id: string) {
    return this.prisma.assessment.findFirst({
      where: { id, organizationId, kind: KIND_ASSIGNMENT },
      include: assignmentInclude,
    });
  }

  findAssignmentsOfCourse(organizationId: string, courseId: string) {
    return this.prisma.assessment.findMany({
      where: { organizationId, courseId, kind: KIND_ASSIGNMENT },
      orderBy: { position: 'asc' },
      include: { _count: { select: { submissions: true } } },
    });
  }

  findWithRubric(tx: Prisma.TransactionClient, id: string) {
    return tx.assessment.findUniqueOrThrow({
      where: { id },
      include: assignmentInclude,
    });
  }

  /** Serialise concurrent creates on one Course so two Assignments never get the same position. */
  async lockCourse(tx: Prisma.TransactionClient, courseId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${courseId}::text))`;
  }

  /** BR-154: Assignments sit at the end of the Course tree, ordered among course-level assessments. */
  async lastPositionOfCourse(
    tx: Prisma.TransactionClient,
    courseId: string,
  ): Promise<number> {
    const last = await tx.assessment.aggregate({
      where: { courseId, moduleId: null },
      _max: { position: true },
    });
    return last._max.position ?? 0;
  }

  createAssignment(
    tx: Prisma.TransactionClient,
    data: Prisma.AssessmentUncheckedCreateInput,
  ) {
    return tx.assessment.create({ data });
  }

  updateAssignment(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.AssessmentUpdateInput,
  ) {
    return tx.assessment.update({ where: { id }, data });
  }

  deleteAssignment(tx: Prisma.TransactionClient, id: string) {
    return tx.assessment.delete({ where: { id } });
  }

  /** How many other Assignments still point at the same stored prompt file. */
  countOtherUsersOfFile(fileKey: string, exceptId: string) {
    return this.prisma.assessment.count({
      where: { promptFileKey: fileKey, id: { not: exceptId } },
    });
  }

  /** Is the stored prompt file linked to any Assignment? */
  async isPromptFileInUse(fileKey: string): Promise<boolean> {
    const count = await this.prisma.assessment.count({
      where: { promptFileKey: fileKey },
    });
    return count > 0;
  }

  /**
   * Lock the Assignment row, then count its submissions. Inserting a submission takes a
   * key-share lock on this row (FK), so it waits until we commit, which makes the
   * "no submission yet" checks of BR-98 / BR-92 reliable.
   */
  async lockAndCountSubmissions(
    tx: Prisma.TransactionClient,
    assessmentId: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM assessments WHERE id = ${assessmentId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Assignment not found.');
    return tx.submission.count({ where: { assessmentId } });
  }

  /** BR-51: the total expected duration (minutes) of all the Assignments of a Course version. */
  async sumExpectedMinutes(
    organizationId: string,
    courseId: string,
  ): Promise<number> {
    const result = await this.prisma.assessment.aggregate({
      where: { organizationId, courseId, kind: KIND_ASSIGNMENT },
      _sum: { expectedDurationMinutes: true },
    });
    return result._sum.expectedDurationMinutes ?? 0;
  }

  /** The Course Service has been told: the outbox row is done. */
  markOutboxPublished(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
  }

  /** The outbox row is written in the same transaction as the change it announces. */
  createOutboxEvent(
    tx: Prisma.TransactionClient,
    data: {
      aggregateId: string;
      eventType: string;
      organizationId: string;
      payload: Prisma.InputJsonValue;
    },
  ) {
    return this.db(tx).outboxEvent.create({
      data: {
        aggregateType: 'Assignment',
        occurredAt: new Date(),
        ...data,
      },
    });
  }
}
