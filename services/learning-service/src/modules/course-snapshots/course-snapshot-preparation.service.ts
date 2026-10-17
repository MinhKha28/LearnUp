import type { CurrentUser } from '@learnup/ts-common';
import { Injectable } from '@nestjs/common';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import type { LockedCourse } from '../../infrastructure/clients/course/course-service.interface';
import {
  buildCourseSnapshotRows,
  type CourseSnapshotRows,
} from './course-snapshot-rows';
import { CourseSnapshotsRepository } from './course-snapshots.repository';

@Injectable()
export class CourseSnapshotPreparationService {
  private readonly pending = new Map<
    string,
    Promise<CourseSnapshotRows | null>
  >();

  constructor(
    private readonly snapshots: CourseSnapshotsRepository,
    private readonly courses: CourseServiceClient,
  ) {}

  /** Gộp các lần chuẩn bị cùng Course trong tiến trình; I2 luôn nằm ngoài transaction ghi. */
  prepare(
    user: CurrentUser,
    lock: LockedCourse,
  ): Promise<CourseSnapshotRows | null> {
    const waiting = this.pending.get(lock.courseId);
    if (waiting) return waiting;
    const promise = this.load(user, lock).finally(() => {
      this.pending.delete(lock.courseId);
    });
    this.pending.set(lock.courseId, promise);
    return promise;
  }

  private async load(
    user: CurrentUser,
    lock: LockedCourse,
  ): Promise<CourseSnapshotRows | null> {
    if (
      await this.snapshots.existsForCourse(lock.courseId, lock.organizationId)
    )
      return null;
    return buildCourseSnapshotRows(
      lock,
      await this.courses.getCourseTree(user, lock.courseId),
      new Date(),
    );
  }
}
