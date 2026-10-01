import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/** Điều kiện chung của Course hiển thị trong danh mục (UC25, UC25.1). */
const catalogCourseWhere = (organizationId: string) => ({
  organizationId,
  status: 'Published',
  courseType: 'Public',
  disabledAt: null,
});

@Injectable()
export class CatalogRepository {
  private readonly logger = new Logger(CatalogRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Một trang danh mục; đếm tổng và lấy trang trong cùng một transaction. */
  async findCatalogPage(organizationId: string, skip: number, take: number) {
    const where = catalogCourseWhere(organizationId);
    const [total, courses] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        select: {
          id: true,
          name: true,
          shortDescription: true,
          trainingObjectives: true,
          coverFileId: true,
          expectedCompletionDays: true,
        },
        // id giúp thứ tự ổn định giữa các trang khi trùng published_at
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
    ]);
    return { total, courses };
  }

  /**
   * Course cho trang giới thiệu, đủ mọi điều kiện của danh mục trong một truy vấn.
   * Chỉ lấy Lesson và học liệu chưa bị vô hiệu hóa (D9); không lấy nội dung Lesson hay tệp.
   */
  findIntroductionCourse(organizationId: string, courseId: string) {
    return this.prisma.course.findFirst({
      where: { id: courseId, ...catalogCourseWhere(organizationId) },
      select: {
        id: true,
        name: true,
        shortDescription: true,
        trainingObjectives: true,
        learningOutcomes: true,
        coverFileId: true,
        expectedCompletionDays: true,
        modules: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            position: true,
            lessons: {
              where: { disabledAt: null },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                position: true,
                materials: {
                  where: { disabledAt: null },
                  select: { isRequired: true },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Thời lượng ước tính theo phút (BR-51): tổng học liệu bắt buộc còn hiệu lực cộng assignment_minutes.
   * Course không có trong kết quả (hoặc khi platform_settings trống) thì không có khóa trong Map.
   */
  async estimateDurationMinutes(
    organizationId: string,
    courseIds: string[],
  ): Promise<Map<string, number>> {
    const durations = new Map<string, number>();
    if (courseIds.length === 0) {
      return durations;
    }

    const settings = await this.prisma.platformSetting.findFirst({
      select: { readingSpeedWordsPerMinute: true },
      orderBy: { sourceAsOf: 'desc' },
    });
    if (!settings) {
      this.logger.error(
        'Bảng platform_settings của course_db đang trống: không tính được thời lượng ước tính, mọi Course trả estimatedDurationMinutes = null.',
      );
      return durations;
    }

    const readingSpeed = settings.readingSpeedWordsPerMinute;
    // 60.0 và ::numeric để chia số thực rồi mới CEIL; ::int vì SUM trả bigint, Prisma đổi thành BigInt làm JSON.stringify lỗi
    const rows = await this.prisma.$queryRaw<
      { course_id: string; minutes: number }[]
    >`
      SELECT c.id AS course_id,
             (c.assignment_minutes + COALESCE(SUM(
               CASE x.material_type
                 WHEN 'Video' THEN CEIL(f.duration_seconds / 60.0)
                 WHEN 'Reading' THEN CEIL(f.word_count / ${readingSpeed}::numeric)
               END
             ), 0))::int AS minutes
      FROM courses c
      LEFT JOIN modules m ON m.course_id = c.id
      LEFT JOIN lessons l ON l.module_id = m.id AND l.disabled_at IS NULL
      LEFT JOIN materials x ON x.lesson_id = l.id
                           AND x.is_required = true
                           AND x.disabled_at IS NULL
      LEFT JOIN media_files f ON f.id = x.file_id
      WHERE c.organization_id = ${organizationId}::uuid
        AND c.id = ANY(${courseIds}::uuid[])
      GROUP BY c.id, c.assignment_minutes`;

    for (const row of rows) {
      durations.set(row.course_id, row.minutes);
    }
    return durations;
  }
}
