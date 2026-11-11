import { COURSE_STATUS, COURSE_TYPE } from '../courses/course-values';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { CatalogCourseDto } from './dto/catalog-course.dto';
import { PrismaService } from '@infra/prisma/prisma.service';

/** Điều kiện chung của Course hiển thị trong danh mục (UC25, UC25.1). */
const catalogCourseWhere = (organizationId: string) => ({
  organizationId,
  status: COURSE_STATUS.PUBLISHED,
  courseType: COURSE_TYPE.PUBLIC,
  disabledAt: null,
});

const catalogSearchWhere = (organizationId: string, keyword: string) => {
  const scope = catalogCourseWhere(organizationId);
  const escape = '\\';
  // Escape after folding because unaccent can turn fullwidth characters into wildcards.
  const pattern = Prisma.sql`
    '%' || replace(replace(replace(lower(unaccent(${keyword})),
      ${escape}, ${escape.repeat(2)}), '%', ${escape + '%'}), '_', ${escape + '_'}) || '%'`;
  return Prisma.sql`
    organization_id = ${scope.organizationId}::uuid
    AND status = ${scope.status}
    AND course_type = ${scope.courseType}
    AND disabled_at IS NULL
    AND (
      regexp_replace(lower(unaccent(name)), '[[:space:]]+', ' ', 'g')
        LIKE (${pattern}) ESCAPE ${escape}
      OR regexp_replace(lower(unaccent(training_objectives)), '[[:space:]]+', ' ', 'g')
        LIKE (${pattern}) ESCAPE ${escape}
    )`;
};

@Injectable()
export class CatalogRepository {
  private readonly logger = new Logger(CatalogRepository.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: Pick<PrismaService, 'course' | '$queryRaw'>,
  ) {}

  /** Tổng số Course trong danh mục của tổ chức. */
  async countCatalog(organizationId: string, keyword?: string) {
    if (keyword) {
      const [result] = await this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT count(*) AS total FROM courses
        WHERE ${catalogSearchWhere(organizationId, keyword)}`;
      return Number(result.total);
    }
    return this.prisma.course.count({
      where: catalogCourseWhere(organizationId),
    });
  }

  /** Một trang danh mục; service chỉ gọi khi skip nhỏ hơn tổng. */
  findCatalogCourses(organizationId: string, skip: number, take: number, keyword?: string) {
    if (keyword) {
      return this.prisma.$queryRaw<Omit<CatalogCourseDto, 'estimatedDurationMinutes'>[]>`
        SELECT id, name, short_description AS "shortDescription",
               training_objectives AS "trainingObjectives",
               cover_file_id AS "coverFileId",
               expected_completion_days AS "expectedCompletionDays"
        FROM courses
        WHERE ${catalogSearchWhere(organizationId, keyword)}
        ORDER BY published_at DESC, id DESC
        OFFSET ${skip} LIMIT ${take}`;
    }
    return this.prisma.course.findMany({
      where: catalogCourseWhere(organizationId),
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
    });
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
   * Course không có trong kết quả thì không có khóa trong Map. platform_settings trống hoặc tốc độ đọc
   * không hợp lệ (NULL, ≤ 0) thì không tính, Map rỗng (D12).
   */
  async estimateDurationMinutes(
    organizationId: string,
    courseIds: string[],
  ): Promise<Map<string, number>> {
    const durations = new Map<string, number>();
    if (courseIds.length === 0) {
      return durations;
    }

    // $queryRaw vì Prisma không cho NULLS LAST trên cột khai báo NOT NULL
    const [settings] = await this.prisma.$queryRaw<
      { reading_speed: number | null }[]
    >`
      SELECT reading_speed_words_per_minute AS reading_speed
      FROM platform_settings
      ORDER BY source_as_of DESC NULLS LAST
      LIMIT 1`;
    if (!settings) {
      this.logger.error(
        'Bảng platform_settings của course_db đang trống: không tính được thời lượng ước tính, mọi Course trả estimatedDurationMinutes = null.',
      );
      return durations;
    }

    const readingSpeed = settings.reading_speed;
    if (readingSpeed === null || readingSpeed <= 0) {
      this.logger.error(
        `platform_settings.reading_speed_words_per_minute của course_db không hợp lệ (${readingSpeed}): không tính được thời lượng ước tính, mọi Course trả estimatedDurationMinutes = null.`,
      );
      return durations;
    }

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
