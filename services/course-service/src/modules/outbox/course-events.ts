import type { Prisma } from '../../../generated/prisma/client';

import type { CourseEventInput } from './interfaces/course-event.interface';

export async function appendCourseOutboxEvent(
  tx: Prisma.TransactionClient,
  input: CourseEventInput,
): Promise<void> {
  const payload = {
    organizationId: input.organizationId,
    courseId: input.courseId,
    occurredAt: input.occurredAt.toISOString(),

    ...('componentType' in input
      ? {
          componentType: input.componentType,
          componentId: input.componentId,
        }
      : {}),
  };

  await tx.outboxEvent.create({
    data: {
      aggregateType: 'Course',
      aggregateId: input.courseId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      payload,
    },
  });
}
