import { App, Modal } from "antd";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { CourseCover } from "@/components/learner/course.cover";
import { LearnerEmptyState, LearnerErrorState, LearnerSkeleton } from "@/components/learner/learner.states";
import { LearnerButton, LearnerPage, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import { UrlPagination } from "@/components/learner/url.pagination";
import { useApiQuery } from "@/hooks/use.api.query";
import { useLearningRefresh } from "@/hooks/use.learning.refresh";
import { useReplacePage } from "@/hooks/use.replace.page";
import { toApiError } from "@/services/api.client";
import { fetchMyEnrollments, withdrawOptionalCourse } from "@/services/learning.service";
import type { MyEnrollmentItem } from "@/types/learning.types";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import { buildMyCourseRow, type MyCourseRow } from "@/utils/my.courses.view";
import { parsePageParam, resolvePageRedirect } from "@/utils/page.param";
import { canWithdrawEnrollment, resolveWithdrawalOutcome, WITHDRAWAL_CONFIRMATION, WITHDRAWAL_MESSAGES } from "@/utils/withdrawal.outcome";
import "./my.courses.scss";

const MY_COURSES_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền xem danh sách Khóa học này.",
};

const MyCourseListRow = ({ row, item, onReload }: {
  row: MyCourseRow;
  item: MyEnrollmentItem;
  onReload: () => void;
}) => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const submitting = useRef(false);
  const openTo = row.action.kind === "open" ? row.action.to : null;

  const withdraw = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSending(true);
    setErrorText(null);
    try {
      let result;
      try {
        result = await withdrawOptionalCourse(item.enrollmentId);
      } catch (cause) {
        result = toApiError(cause);
      }
      const outcome = resolveWithdrawalOutcome(result);
      const text = WITHDRAWAL_MESSAGES[outcome.kind];
      if (outcome.reload) {
        if (outcome.kind === "notFound") message.info(text);
        else message.success(text);
        setConfirming(false);
        onReload();
      } else if (outcome.retry) {
        setErrorText(text);
      } else {
        message.error(text);
        setConfirming(false);
      }
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };

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
      {(openTo || canWithdrawEnrollment(item)) && (
        <div className="learner-my-course-action">
          {openTo && <LearnerButton type="primary" onClick={() => navigate(openTo)}>
            Vào học
          </LearnerButton>}
          {canWithdrawEnrollment(item) && (
            <LearnerButton loading={sending} onClick={() => { setErrorText(null); setConfirming(true); }}>
              Rút khỏi Khóa học
            </LearnerButton>
          )}
        </div>
      )}
      <Modal
        title="Rút khỏi Khóa học?"
        open={confirming}
        okText={errorText ? "Thử lại" : "Rút khỏi Khóa học"}
        cancelText="Hủy"
        confirmLoading={sending}
        cancelButtonProps={{ disabled: sending }}
        closable={!sending}
        maskClosable={!sending}
        keyboard={!sending}
        onOk={withdraw}
        onCancel={() => { if (!submitting.current) setConfirming(false); }}
      >
        <p>{WITHDRAWAL_CONFIRMATION}</p>
        {errorText && <p role="alert" className="learner-my-course-withdraw-error">{errorText}</p>}
      </Modal>
    </li>
  );
};

const MyCoursesContent = ({ page }: { page: number }) => {
  const navigate = useNavigate();
  const replacePage = useReplacePage();
  const query = useApiQuery((signal) => fetchMyEnrollments(page, signal), [page]);
  useLearningRefresh(query.reload, "");
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
        title="Không tải được danh sách Khóa học"
        message={MY_COURSES_ERROR_MESSAGES[query.error.code] ?? "Đã có lỗi xảy ra khi tải danh sách Khóa học."}
        onRetry={query.reload}
      />
    );
  }
  if (redirect === "empty") {
    return (
      <LearnerEmptyState
        title="Bạn chưa có Khóa học nào"
        action={<LearnerButton onClick={() => navigate(LEARNER_ROUTES.catalog())}>Xem danh mục Khóa học</LearnerButton>}
      />
    );
  }

  const { items, meta } = query.data;
  return (
    <>
      {/* Giữ đúng thứ tự backend trả về (D22) */}
      <ul className="learner-my-course-list">
        {items.map((item) => (
          <MyCourseListRow key={item.enrollmentId} item={item} row={buildMyCourseRow(item)} onReload={query.reload} />
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
      <PageHeader title="Khóa học của tôi" subtitle="Các Khóa học bạn được phân công và đã tự đăng ký." />
      {page === null ? <LearnerSkeleton variant="list" /> : <MyCoursesContent page={page} />}
    </LearnerPage>
  );
};

export default MyCourses;
