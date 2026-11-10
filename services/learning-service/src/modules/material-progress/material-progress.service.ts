import type { CurrentUser } from '@learnup/ts-common';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type {
  MaterialSnapshot,
  Prisma,
} from '../../../generated/prisma/client';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import {
  CourseServiceError,
  MaterialSigningError,
} from '../../infrastructure/clients/course/course-service.errors';
import type { CourseTree } from '../../infrastructure/clients/course/course-service.interface';
import {
  MaterialProgressRepository,
  type ProgressAccess,
  type ProgressRow,
} from './material-progress.repository';
import {
  normalizeRanges,
  positionReportedAt,
  requiredSeconds,
} from './video-progress.rules';
import type { ReportProgressDto } from './report-progress.dto';

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
  private readonly logger = new Logger(MaterialProgressService.name);
  constructor(
    private readonly repository: MaterialProgressRepository,
    private readonly course: CourseServiceClient,
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
    if (
      access &&
      ![
        'NotStarted',
        'InProgress',
        'Exempted',
        'Completed',
        'Halted',
        'Withdrawn',
      ].includes(access.status)
    ) {
      this.logger.error('INVALID_ENROLLMENT_STATUS');
      fail(
        500,
        'INVALID_ENROLLMENT_STATUS',
        'Invalid stored enrollment status.',
      );
    }
    if (!access || access.status === 'Withdrawn')
      return fail(404, 'ENROLLMENT_NOT_FOUND', 'Không tìm thấy Enrollment.');
    if (access.status === 'Halted' || access.disabledAt !== null)
      fail(403, 'CONTENT_UNAVAILABLE', 'Nội dung đang tạm ngưng.');
    return access;
  }
  private async readingMaterial(
    user: CurrentUser,
    access: ProgressAccess,
    materialId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (!isUUID(materialId, 'all'))
      return fail(404, 'MATERIAL_NOT_FOUND', 'Không tìm thấy học liệu.');
    const material = await this.repository.material(
      materialId,
      access.courseId,
      user.organizationId!,
      tx,
    );
    if (!material)
      return fail(404, 'MATERIAL_NOT_FOUND', 'Không tìm thấy học liệu.');
    if (
      material.disabledAt !== null ||
      (await this.repository.disabledLesson(
        material.lessonId,
        user.organizationId!,
        tx,
      ))
    )
      fail(403, 'CONTENT_UNAVAILABLE', 'Nội dung đang tạm ngưng.');
    if (material.materialType !== 'Reading')
      fail(409, 'MATERIAL_NOT_READING', 'Học liệu không phải Reading.');
    return material;
  }
  async completeReading(
    user: CurrentUser,
    enrollmentId: string,
    materialId: string,
  ) {
    return this.repository.transaction(async (tx) => {
      const access = await this.access(user, enrollmentId, tx);
      const material = await this.readingMaterial(user, access, materialId, tx);
      // L21: insert sequential-access policy here before the progress transition.
      const changed =
        access.status !== 'Completed' &&
        (await this.repository.completeReading(
          enrollmentId,
          materialId,
          user.organizationId!,
          tx,
        ));
      const state = await this.repository.readingState(
        enrollmentId,
        materialId,
        access.courseId,
        material.lessonId,
        user.organizationId!,
        tx,
      );
      return {
        ...state,
        alreadyCompleted: !changed && state.completedAt !== null,
      };
    });
  }
  async readingAccess(
    user: CurrentUser,
    enrollmentId: string,
    materialId: string,
  ) {
    const access = await this.access(user, enrollmentId);
    await this.readingMaterial(user, access, materialId);
    // L21: insert sequential-access policy before issuing a content URL.
    let tree: CourseTree;
    try {
      tree = await this.course.getCourseTree(user, access.courseId);
    } catch (error) {
      if (error instanceof CourseServiceError) {
        this.logger.error({
          message: 'Course content unavailable',
          enrollmentId,
          materialId,
          courseStatus: null,
        });
        return fail(
          503,
          'SERVICE_UNAVAILABLE',
          'Reading content is temporarily unavailable.',
        );
      }
      throw error;
    }
    if (tree.disabledAt !== null)
      fail(403, 'CONTENT_UNAVAILABLE', 'Nội dung đang tạm ngưng.');
    for (const module of tree.modules)
      for (const lesson of module.lessons) {
        const material = lesson.materials.find((m) => m.id === materialId);
        if (!material) continue;
        if (lesson.disabledAt !== null || material.disabledAt !== null)
          fail(403, 'CONTENT_UNAVAILABLE', 'Nội dung đang tạm ngưng.');
        if (material.materialType !== 'Reading')
          fail(409, 'MATERIAL_NOT_READING', 'Học liệu không phải Reading.');
        return {
          materialId,
          title: material.title,
          ...(await this.signedUrl(user, access, materialId, 'Reading')),
          fixture: false,
        };
      }
    return fail(404, 'MATERIAL_NOT_FOUND', 'Không tìm thấy học liệu.');
  }
  private async signedUrl(
    user: CurrentUser,
    access: ProgressAccess,
    materialId: string,
    kind: 'Video' | 'Reading',
  ) {
    try {
      const signed = await this.course.getMaterialSignedUrl(
        user,
        access.courseId,
        materialId,
      );
      if (
        kind === 'Video'
          ? !signed.mimeType.startsWith('video/')
          : signed.mimeType !== 'application/pdf'
      )
        throw new MaterialSigningError(200, null);
      return {
        ...(kind === 'Video'
          ? { playbackUrl: signed.url }
          : { accessUrl: signed.url }),
        expiresAt: signed.expiresAt,
        mimeType: signed.mimeType,
      };
    } catch (error) {
      const status =
        error instanceof MaterialSigningError ? error.status : null;
      const code = error instanceof MaterialSigningError ? error.code : null;
      if (status === 409 && code === 'MATERIAL_DISABLED')
        return fail(403, 'CONTENT_UNAVAILABLE', 'Nội dung đang tạm ngưng.');
      this.logger.error({
        message: 'Material signing failed',
        materialId,
        enrollmentId: access.id,
        courseStatus: status,
      });
      if (status === 404 && code === 'MATERIAL_NOT_FOUND')
        return fail(404, 'MATERIAL_NOT_FOUND', 'Không tìm thấy học liệu.');
      if (status === 409 && code === 'MATERIAL_FILE_NOT_READY')
        return fail(409, 'MATERIAL_NOT_READY', 'Học liệu chưa sẵn sàng.');
      return fail(
        503,
        'SERVICE_UNAVAILABLE',
        'Nội dung tạm thời không khả dụng. Vui lòng thử lại.',
      );
    }
  }
  private async tree(
    user: CurrentUser,
    courseId: string,
    enrollmentId?: string,
    materialId?: string,
  ) {
    try {
      return await this.course.getCourseTree(user, courseId);
    } catch (error) {
      if (error instanceof CourseServiceError) {
        this.logger.error({
          message: 'Course content unavailable',
          enrollmentId,
          materialId,
          courseStatus: null,
        });
        return fail(
          503,
          'SERVICE_UNAVAILABLE',
          'Không thể lấy học liệu từ course-service.',
        );
      }
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
        'SERVICE_UNAVAILABLE',
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
      positionSeconds: row.positionSeconds,
      positionReportedAt: row.positionReportedAt?.toISOString() ?? null,
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
      await this.tree(user, access.courseId, enrollmentId, materialId),
      materialId,
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
      ...(await this.signedUrl(user, access, materialId, 'Video')),
    };
  }
  async report(
    user: CurrentUser,
    enrollmentId: string,
    materialId: string,
    report: ReportProgressDto,
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
      const ranges = current.status === 'Completed' ? [] : report.ranges;
      if (ranges.some(([, end]) => end > duration + 1))
        fail(422, 'VALIDATION_ERROR', 'Đoạn xem vượt thời lượng Video.');
      await this.repository.lock(
        enrollmentId,
        materialId,
        user.organizationId!,
        tx,
      );
      if (ranges.length) {
        const normalized = normalizeRanges(ranges, duration);
        await this.repository.saveCoverage(
          enrollmentId,
          materialId,
          user.organizationId!,
          requiredSeconds(duration, current.videoCompletionPercent),
          normalized,
          tx,
        );
      }
      const row = await this.repository.savePosition(
        enrollmentId,
        materialId,
        user.organizationId!,
        Math.min(duration, report.positionSeconds),
        positionReportedAt(report.reportedAt, new Date()),
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
