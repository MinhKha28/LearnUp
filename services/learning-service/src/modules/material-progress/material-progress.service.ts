import type { CurrentUser } from '@learnup/ts-common';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type {
  MaterialSnapshot,
  Prisma,
} from '../../../generated/prisma/client';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import { CourseServiceError } from '../../infrastructure/clients/course/course-service.errors';
import type { CourseTree } from '../../infrastructure/clients/course/course-service.interface';
import {
  MaterialProgressRepository,
  type ProgressAccess,
  type ProgressRow,
} from './material-progress.repository';
import {
  normalizeRanges,
  progressBudget,
  requiredSeconds,
  type WatchedRange,
} from './video-progress.rules';
import {
  VIDEO_PLAYBACK_CONFIG,
  type VideoPlaybackConfig,
} from './video-playback.config';

const fail = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
): never => {
  throw new HttpException(
    { code, message, ...(details === undefined ? {} : { details }) },
    status,
  );
};

@Injectable()
export class MaterialProgressService {
  constructor(
    private readonly repository: MaterialProgressRepository,
    private readonly course: CourseServiceClient,
    @Inject(VIDEO_PLAYBACK_CONFIG)
    private readonly playbackConfig: VideoPlaybackConfig,
  ) {}

  private async access(
    user: CurrentUser,
    enrollmentId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ProgressAccess> {
    if (
      ![user.userId, user.organizationId, enrollmentId].every(
        (id) => typeof id === 'string' && isUUID(id, 'all'),
      )
    )
      fail(404, 'ENROLLMENT_NOT_FOUND', 'Không tìm thấy Enrollment.');
    const access = await this.repository.access(
      enrollmentId,
      user.userId,
      user.organizationId!,
      tx,
    );
    if (!access || access.status === 'Withdrawn')
      return fail(404, 'ENROLLMENT_NOT_FOUND', 'Không tìm thấy Enrollment.');
    if (access.status === 'Halted' || access.disabledAt !== null)
      fail(403, 'CONTENT_UNAVAILABLE', 'Nội dung đang tạm ngưng.');
    return access;
  }
  private async tree(user: CurrentUser, courseId: string) {
    try {
      return await this.course.getCourseTree(user, courseId);
    } catch (error) {
      if (error instanceof CourseServiceError)
        return fail(
          503,
          'PLAYBACK_UNAVAILABLE',
          'Không thể lấy học liệu từ course-service.',
        );
      throw error;
    }
  }
  private treeMaterial(tree: CourseTree, materialId: string) {
    if (tree.disabledAt !== null)
      fail(403, 'CONTENT_UNAVAILABLE', 'Nội dung đang tạm ngưng.');
    for (const module of tree.modules)
      for (const lesson of module.lessons) {
        const material = lesson.materials.find(
          (item) => item.id === materialId,
        );
        if (material) {
          if (lesson.disabledAt !== null || material.disabledAt !== null)
            fail(403, 'CONTENT_UNAVAILABLE', 'Nội dung đang tạm ngưng.');
          if (material.materialType !== 'Video')
            fail(409, 'MATERIAL_NOT_VIDEO', 'Học liệu không phải Video.');
          return { material, lessonId: lesson.id };
        }
      }
    return fail(404, 'MATERIAL_NOT_FOUND', 'Không tìm thấy học liệu.');
  }
  private async validateMaterial(
    material: MaterialSnapshot | null,
    org: string,
    tx?: Prisma.TransactionClient,
  ): Promise<MaterialSnapshot> {
    if (!material)
      return fail(404, 'MATERIAL_NOT_FOUND', 'Không tìm thấy học liệu.');
    if (
      material.disabledAt !== null ||
      (await this.repository.disabledLesson(material.lessonId, org, tx))
    )
      fail(403, 'CONTENT_UNAVAILABLE', 'Nội dung đang tạm ngưng.');
    if (material.materialType !== 'Video')
      fail(409, 'MATERIAL_NOT_VIDEO', 'Học liệu không phải Video.');
    if (material.durationSeconds === null || material.durationSeconds <= 0)
      fail(
        503,
        'PLAYBACK_UNAVAILABLE',
        'Thiếu thời lượng Video hợp lệ trong bản sao.',
      );
    return material;
  }
  private state(
    materialId: string,
    duration: number,
    percent: number,
    row: ProgressRow,
  ) {
    return {
      materialId,
      durationSeconds: duration,
      watchedRanges: row.watchedRanges,
      watchedSeconds: row.watchedSeconds,
      requiredSeconds: requiredSeconds(duration, percent),
      completed: row.completedAt !== null,
      completedAt: row.completedAt?.toISOString() ?? null,
      maxPlaybackRate: 2,
      heartbeatSeconds: 15,
    };
  }
  async playback(user: CurrentUser, enrollmentId: string, materialId: string) {
    const access = await this.access(user, enrollmentId);
    if (!isUUID(materialId, 'all'))
      fail(404, 'MATERIAL_NOT_FOUND', 'Không tìm thấy học liệu.');
    const saved = await this.validateMaterial(
      await this.repository.material(
        materialId,
        access.courseId,
        user.organizationId!,
      ),
      user.organizationId!,
    );
    const { material } = this.treeMaterial(
      await this.tree(user, access.courseId),
      materialId,
    );
    if (this.playbackConfig.mode === 'course')
      fail(
        503,
        'PLAYBACK_UNAVAILABLE',
        'Chưa có hợp đồng phát Video từ course-service.',
      );
    const row = await this.repository.read(
      enrollmentId,
      materialId,
      user.organizationId!,
    );
    return {
      ...this.state(
        materialId,
        saved.durationSeconds!,
        access.videoCompletionPercent,
        row,
      ),
      title: material.title,
      playbackUrl: this.playbackConfig.fixtureUrl!,
    };
  }
  async report(
    user: CurrentUser,
    enrollmentId: string,
    materialId: string,
    ranges: WatchedRange[],
  ) {
    const access = await this.access(user, enrollmentId);
    if (!isUUID(materialId, 'all'))
      fail(404, 'MATERIAL_NOT_FOUND', 'Không tìm thấy học liệu.');
    let snapshot: Prisma.MaterialSnapshotCreateManyInput | undefined;
    if (
      !(await this.repository.material(
        materialId,
        access.courseId,
        user.organizationId!,
      ))
    ) {
      const tree = await this.tree(user, access.courseId);
      const { material, lessonId } = this.treeMaterial(tree, materialId);
      snapshot = {
        materialId,
        organizationId: user.organizationId!,
        courseId: access.courseId,
        lessonId,
        materialType: 'Video',
        isRequired: false,
        durationSeconds: material.durationSeconds,
        durationAsOf: tree.asOf,
        disabledAt: material.disabledAt,
        disabledAsOf: tree.asOf,
      };
    }
    return this.repository.transaction(async (tx) => {
      const current = await this.access(user, enrollmentId, tx);
      if (snapshot) await this.repository.insertSnapshot(snapshot, tx);
      const saved = await this.validateMaterial(
        await this.repository.material(
          materialId,
          current.courseId,
          user.organizationId!,
          tx,
        ),
        user.organizationId!,
        tx,
      );
      const duration = saved.durationSeconds!;
      if (ranges.some(([, end]) => end > duration + 1))
        fail(422, 'VALIDATION_ERROR', 'Đoạn xem vượt thời lượng Video.');
      const old = await this.repository.lock(
        enrollmentId,
        materialId,
        user.organizationId!,
        tx,
      );
      const normalized = normalizeRanges(ranges, duration);
      const preview = await this.repository.preview(
        enrollmentId,
        materialId,
        user.organizationId!,
        normalized,
        tx,
      );
      if (preview.newSeconds > progressBudget(preview.now, old.lastReportedAt))
        fail(
          409,
          'PROGRESS_RATE_EXCEEDED',
          'Đoạn xem vượt ngân sách thời gian.',
          this.state(materialId, duration, current.videoCompletionPercent, old),
        );
      const row =
        preview.newSeconds === 0
          ? old
          : await this.repository.save(
              enrollmentId,
              materialId,
              user.organizationId!,
              preview,
              requiredSeconds(duration, current.videoCompletionPercent),
              normalized,
              tx,
            );
      return this.state(
        materialId,
        duration,
        current.videoCompletionPercent,
        row,
      );
    });
  }
}
