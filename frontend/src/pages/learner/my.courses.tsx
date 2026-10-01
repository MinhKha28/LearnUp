import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { CourseCover } from "@/components/learner/course.cover";
import { LearnerEmptyState, LearnerErrorState, LearnerSkeleton } from "@/components/learner/learner.states";
import { LearnerButton, LearnerPage, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import { UrlPagination } from "@/components/learner/url.pagination";
import { useApiQuery } from "@/hooks/use.api.query";
import { useReplacePage } from "@/hooks/use.replace.page";
import { fetchMyEnrollments } from "@/services/learning.service";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import { buildMyCourseRow, type MyCourseRow } from "@/utils/my.courses.view";
import { parsePageParam, resolvePageRedirect } from "@/utils/page.param";
import "./my.courses.scss";

const MY_COURSES_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền xem danh sách Course này.",
};

const MyCourseListRow = ({ row }: { row: MyCourseRow }) => {
  const navigate = useNavigate();
  const openTo = row.action.kind === "open" ? row.action.to : null;

  return (
    <li className={`learner-my-course${openTo ? "" : " learner-my-course-halted"}`}>
      <CourseCover name={row.courseName ?? row.title} coverFileId={row.coverFileId} size="sm" />
      <div className="learner-my-course-body">
        <div className="learner-my-course-heading">
          {openTo ? (
            <Link className="learner-my-course-title" to={openTo}>
              {row.title}
            </Link>
          ) : (
            <span className="learner-my-course-title">{row.title}</span>
          )}
          {row.versionLabel && <span className="learner-my-course-version">{row.versionLabel}</span>}
        </div>
        <div className="learner-my-course-tags">
          <StatusTag tone="neutral">{row.typeLabel}</StatusTag>
          <StatusTag tone={row.status.tone}>{row.status.label}</StatusTag>
        </div>
        {(row.due || row.progress) && (
          <div className="learner-my-course-meta">
            {row.due && <span>Hạn hoàn thành: {row.due.text}</span>}
            {row.progress && <span>{row.progress}</span>}
          </div>
        )}
        {row.action.kind === "halted" && <p className="learner-my-course-note">{row.action.note}</p>}
      </div>
      {openTo && (
        <div className="learner-my-course-action">
          <LearnerButton type="primary" onClick={() => navigate(openTo)}>
            Vào học
          </LearnerButton>
        </div>
      )}
    </li>
  );
};

const MyCoursesContent = ({ page }: { page: number }) => {
  const navigate = useNavigate();
  const replacePage = useReplacePage();
  const query = useApiQuery((signal) => fetchMyEnrollments(page, signal), [page]);
  const redirect = query.status === "success" ? resolvePageRedirect(query.data.meta, query.data.items.length) : null;

  useEffect(() => {
    if (typeof redirect === "number") replacePage(redirect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirect]);

  if (query.status === "loading" || typeof redirect === "number") {
    return <LearnerSkeleton variant="list" />;
  }
  if (query.status === "error") {
    return (
      <LearnerErrorState
        error={query.error}
        title="Không tải được danh sách Course"
        message={MY_COURSES_ERROR_MESSAGES[query.error.code] ?? "Đã có lỗi xảy ra khi tải danh sách Course."}
        onRetry={query.reload}
      />
    );
  }
  if (redirect === "empty") {
    return (
      <LearnerEmptyState
        title="Bạn chưa có Course nào"
        action={<LearnerButton onClick={() => navigate(LEARNER_ROUTES.catalog())}>Xem danh mục Course</LearnerButton>}
      />
    );
  }

  const { items, meta, organizationTimezone } = query.data;
  return (
    <>
      {/* Giữ đúng thứ tự backend trả về (D22) */}
      <ul className="learner-my-course-list">
        {items.map((item) => (
          <MyCourseListRow key={item.enrollmentId} row={buildMyCourseRow(item, organizationTimezone)} />
        ))}
      </ul>
      <UrlPagination meta={meta} />
    </>
  );
};

const MyCourses = () => {
  const [searchParams] = useSearchParams();
  const replacePage = useReplacePage();
  const page = parsePageParam(searchParams.get("page"));

  useEffect(() => {
    if (page === null) replacePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <LearnerPage className="learner-courses">
      <PageHeader title="Course của tôi" subtitle="Các Course bạn được phân công và đã tự đăng ký." />
      {page === null ? <LearnerSkeleton variant="list" /> : <MyCoursesContent page={page} />}
    </LearnerPage>
  );
};

export default MyCourses;
