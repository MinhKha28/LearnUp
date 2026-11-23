import { Input } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { CourseCover } from "@/components/learner/course.cover";
import { LearnerEmptyState, LearnerErrorState } from "@/components/learner/learner.states";
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
  FORBIDDEN: "Bạn không có quyền xem danh mục khóa học.",
};

const CATALOG_PAGE_SIZE = 12;
const resultCountFormat = new Intl.NumberFormat("vi-VN");

const CatalogSkeleton = ({ count = CATALOG_PAGE_SIZE }: { count?: number }) => (
  <div className="learner-catalog-grid" role="status" aria-busy="true" aria-label="Đang tải">
    {Array.from({ length: count }, (_, index) => (
      <article className="learner-catalog-card learner-catalog-card-skeleton" aria-hidden="true" key={index}>
        <div className="course-cover course-cover-lg" />
        <span className="learner-catalog-card-title">&nbsp;</span>
        <p className="learner-catalog-card-description">&nbsp;</p>
        <p className="learner-catalog-card-objectives">&nbsp;</p>
        <div className="learner-catalog-card-meta">
          <span>&nbsp;</span>
          <span>&nbsp;</span>
        </div>
        <span className="learner-button ant-btn">&nbsp;</span>
      </article>
    ))}
  </div>
);

const CatalogCard = ({
  course,
  enrollmentId,
  page,
  keyword,
}: {
  course: CatalogCourse;
  enrollmentId?: string;
  page: number;
  keyword: string;
}) => {
  const navigate = useNavigate();
  const introPath = LEARNER_ROUTES.courseIntro(course.id);
  const introState = { fromPage: page, fromKeyword: keyword };

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

const CatalogContent = ({ page, keyword }: { page: number; keyword: string }) => {
  const replacePage = useReplacePage();
  const catalog = useApiQuery(
    (signal) => fetchCatalog(page, signal, keyword || undefined),
    [page, keyword],
    true,
  );
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

  const loading = catalog.status === "loading" || typeof redirect === "number";
  const total = catalog.status === "success" && !loading ? catalog.data.meta.total : 0;
  let content: ReactNode;

  if (catalog.status === "loading" || typeof redirect === "number") {
    content = <CatalogSkeleton count={catalog.data?.items.length || undefined} />;
  } else if (catalog.status === "error") {
    content = (
      <LearnerErrorState
        error={catalog.error}
        title="Không tải được danh mục khóa học"
        message={CATALOG_ERROR_MESSAGES[catalog.error.code] ?? "Đã có lỗi xảy ra khi tải danh mục khóa học."}
        onRetry={catalog.reload}
      />
    );
  } else if (redirect === "empty") {
    content = <LearnerEmptyState title={keyword
      ? "Không tìm thấy khóa học nào phù hợp với từ khóa này"
      : "Hiện chưa có khóa học nào để tự đăng ký"} />;
  } else {
    content = (
      <>
        <div className="learner-catalog-grid">
          {catalog.data.items.map((course) => (
            <CatalogCard key={course.id} course={course} enrollmentId={enrolled.get(course.id)} page={page} keyword={keyword} />
          ))}
        </div>
        <UrlPagination meta={catalog.data.meta} />
      </>
    );
  }

  return (
    <>
      <div
        aria-live="polite"
        aria-atomic="true"
        className={keyword && (loading || total > 0) ? "learner-catalog-result-count" : undefined}
      >
        {keyword && total > 0 ? "Tìm thấy " + resultCountFormat.format(total) + " khóa học" : null}
      </div>
      {content}
    </>
  );
};

const CatalogSearch = ({ keyword, onSearch }: { keyword: string; onSearch: (value: string) => void }) => {
  const [draft, setDraft] = useState(keyword);
  useEffect(() => setDraft(keyword), [keyword]);
  const tooLong = [...draft.trim()].length > 200;

  return (
    <form
      role="search"
      className="learner-catalog-search"
      onSubmit={(event) => {
        event.preventDefault();
        if (tooLong) return;
        const value = draft.trim().replace(/\s+/g, " ");
        setDraft(value);
        onSearch(value);
      }}
    >
      <label htmlFor="catalog-keyword">Tìm kiếm khóa học</label>
      <div className="learner-catalog-search-controls">
        <Input
          id="catalog-keyword"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nhập tên khóa học hoặc mục tiêu đào tạo"
          status={tooLong ? "error" : undefined}
          aria-invalid={tooLong}
          aria-describedby={tooLong ? "catalog-keyword-error" : undefined}
        />
        <LearnerButton type="primary" htmlType="submit">Tìm kiếm</LearnerButton>
        {(draft || keyword) && (
          <LearnerButton onClick={() => { setDraft(""); onSearch(""); }}>Xóa tìm kiếm</LearnerButton>
        )}
      </div>
      {tooLong && <span id="catalog-keyword-error" role="alert">Từ khóa tối đa 200 ký tự.</span>}
    </form>
  );
};

const Catalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const replacePage = useReplacePage();
  const page = parsePageParam(searchParams.get("page"));
  const keyword = searchParams.get("q")?.trim() ?? "";

  const search = (value: string) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("page", "1");
      if (value) next.set("q", value);
      else next.delete("q");
      return next;
    });
  };

  useEffect(() => {
    // Tham số page không hợp lệ: về trang 1, không gọi API (D41)
    if (page === null) replacePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <LearnerPage className="learner-catalog">
      <PageHeader title="Danh mục khóa học" subtitle="Học viên có thể tự đăng ký các khóa học dưới đây do tổ chức của bạn cung cấp." />
      <CatalogSearch keyword={keyword} onSearch={search} />
      {page === null ? <CatalogSkeleton /> : <CatalogContent page={page} keyword={keyword} />}
    </LearnerPage>
  );
};

export default Catalog;
