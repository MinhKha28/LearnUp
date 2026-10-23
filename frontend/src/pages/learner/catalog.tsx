import { useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { CourseCover } from "@/components/learner/course.cover";
import { LearnerEmptyState, LearnerErrorState, LearnerSkeleton } from "@/components/learner/learner.states";
import { LearnerButton, LearnerPage, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import { UrlPagination } from "@/components/learner/url.pagination";
import { useApiQuery } from "@/hooks/use.api.query";
import { useReplacePage } from "@/hooks/use.replace.page";
import { fetchCatalog } from "@/services/catalog.service";
import { fetchEnrolledCourseLinks } from "@/services/learning.service";
import type { CatalogCourse } from "@/types/catalog.types";
import { buildEnrolledMap, formatCompletionDays, formatEstimatedDuration } from "@/utils/catalog.view";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import { parsePageParam, resolvePageRedirect } from "@/utils/page.param";
import "./catalog.scss";

const CATALOG_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền xem danh mục Khóa học.",
};

const CatalogCard = ({
  course,
  enrollmentId,
  page,
}: {
  course: CatalogCourse;
  enrollmentId?: string;
  page: number;
}) => {
  const navigate = useNavigate();
  const introPath = LEARNER_ROUTES.courseIntro(course.id);
  const introState = { fromPage: page };

  return (
    <article className="learner-catalog-card">
      <CourseCover name={course.name} coverFileId={course.coverFileId} size="lg" />
      {enrollmentId && <StatusTag tone="success">Đã đăng ký</StatusTag>}
      <Link className="learner-catalog-card-title" to={introPath} state={introState}>
        {course.name}
      </Link>
      {course.shortDescription && <p className="learner-catalog-card-description">{course.shortDescription}</p>}
      {course.trainingObjectives && (
        <p className="learner-catalog-card-objectives" title={course.trainingObjectives}>
          {course.trainingObjectives}
        </p>
      )}
      <div className="learner-catalog-card-meta">
        <span>{formatCompletionDays(course.expectedCompletionDays)}</span>
        <span>Thời lượng ước tính: {formatEstimatedDuration(course.estimatedDurationMinutes)}</span>
      </div>
      {enrollmentId ? (
        <LearnerButton type="primary" onClick={() => navigate(LEARNER_ROUTES.curriculum(enrollmentId))}>
          Vào học
        </LearnerButton>
      ) : (
        <LearnerButton onClick={() => navigate(introPath, { state: introState })}>Xem giới thiệu</LearnerButton>
      )}
    </article>
  );
};

const CatalogContent = ({ page }: { page: number }) => {
  const replacePage = useReplacePage();
  const catalog = useApiQuery((signal) => fetchCatalog(page, signal), [page]);
  // Lỗi course-ids không chặn danh mục, chỉ mất nhãn "Đã đăng ký" (D49)
  const links = useApiQuery((signal) => fetchEnrolledCourseLinks(signal), []);

  const enrolled = useMemo(
    () => (links.status === "success" ? buildEnrolledMap(links.data) : new Map<string, string>()),
    [links.status, links.data],
  );
  const redirect =
    catalog.status === "success" ? resolvePageRedirect(catalog.data.meta, catalog.data.items.length) : null;

  useEffect(() => {
    if (typeof redirect === "number") replacePage(redirect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirect]);

  if (catalog.status === "loading" || typeof redirect === "number") {
    return <LearnerSkeleton variant="grid" />;
  }
  if (catalog.status === "error") {
    return (
      <LearnerErrorState
        error={catalog.error}
        title="Không tải được danh mục Khóa học"
        message={CATALOG_ERROR_MESSAGES[catalog.error.code] ?? "Đã có lỗi xảy ra khi tải danh mục Khóa học."}
        onRetry={catalog.reload}
      />
    );
  }
  if (redirect === "empty") {
    return <LearnerEmptyState title="Hiện chưa có Khóa học nào để tự đăng ký" />;
  }

  return (
    <>
      <div className="learner-catalog-grid">
        {catalog.data.items.map((course) => (
          <CatalogCard key={course.id} course={course} enrollmentId={enrolled.get(course.id)} page={page} />
        ))}
      </div>
      <UrlPagination meta={catalog.data.meta} />
    </>
  );
};

const Catalog = () => {
  const [searchParams] = useSearchParams();
  const replacePage = useReplacePage();
  const page = parsePageParam(searchParams.get("page"));

  useEffect(() => {
    // Tham số page không hợp lệ: về trang 1, không gọi API (D41)
    if (page === null) replacePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <LearnerPage className="learner-catalog">
      <PageHeader title="Danh mục Khóa học" subtitle="Các Khóa học tổ chức của bạn mở cho Học viên tự đăng ký." />
      {page === null ? <LearnerSkeleton variant="grid" /> : <CatalogContent page={page} />}
    </LearnerPage>
  );
};

export default Catalog;
