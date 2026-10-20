import { ArrowLeftOutlined } from "@ant-design/icons";
import { App, Button, Skeleton } from "antd";
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { CourseCover } from "@/components/learner/course.cover";
import { LearnerEmptyState, LearnerErrorState, LearnerSkeleton } from "@/components/learner/learner.states";
import {
  DetailItem,
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchCourseIntroduction } from "@/services/catalog.service";
import { enrollOptionalCourse, fetchEnrolledCourseLinks } from "@/services/learning.service";
import { ApiError } from "@/types/api.types";
import type { CourseIntroduction } from "@/types/catalog.types";
import {
  buildEnrolledMap,
  formatCompletionDays,
  formatEstimatedDuration,
  formatMaterialCount,
  orderCurriculum,
} from "@/utils/catalog.view";
import { ENROLL_OUTCOME_MESSAGES, getEnrollOutcomeMessage, resolveEnrollOutcome } from "@/utils/enroll.outcome";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import "./course.overview.scss";

type BlockedReason = "inGrace" | "forbidden" | "unavailable";

const INTRO_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền xem giới thiệu Khóa học.",
};

const readFromPage = (state: unknown): number | undefined => {
  const fromPage = (state as { fromPage?: unknown } | null)?.fromPage;
  return typeof fromPage === "number" && Number.isSafeInteger(fromPage) && fromPage > 0 ? fromPage : undefined;
};

const CourseContent = ({ course }: { course: CourseIntroduction }) => {
  const modules = useMemo(() => orderCurriculum(course.modules), [course.modules]);

  return (
    <div className="course-overview-card">
      <CourseCover name={course.name} coverFileId={course.coverFileId} size="lg" />
      <div className="course-overview-facts">
        <DetailItem label="Số ngày hoàn thành dự kiến">{formatCompletionDays(course.expectedCompletionDays)}</DetailItem>
        <DetailItem label="Thời lượng ước tính">{formatEstimatedDuration(course.estimatedDurationMinutes)}</DetailItem>
      </div>
      {course.trainingObjectives && (
        <section className="course-overview-section">
          <h3>Mục tiêu đào tạo</h3>
          <p className="course-overview-objectives">{course.trainingObjectives}</p>
        </section>
      )}
      {course.learningOutcomes.length > 0 && (
        <section className="course-overview-section">
          <h3>Learning Outcomes</h3>
          <ul className="course-overview-outcomes">
            {course.learningOutcomes.map((outcome, index) => (
              <li key={index}>{outcome}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="course-overview-section">
        <h3>Chương trình học</h3>
        {modules.length === 0 ? (
          <p>Khóa học chưa có Chương nào.</p>
        ) : (
          <ol className="course-overview-modules">
            {modules.map((module) => (
              <li key={module.id} className="course-overview-module">
                <div className="course-overview-module-heading">
                  <strong>{module.title}</strong>
                  {module.isRequired && <StatusTag tone="warning">Bắt buộc</StatusTag>}
                </div>
                <ol className="course-overview-lessons">
                  {module.lessons.map((lesson) => (
                    <li key={lesson.id} className="course-overview-lesson">
                      <span className="course-overview-lesson-title">{lesson.title}</span>
                      <span className="course-overview-lesson-meta">
                        {lesson.isRequired && <StatusTag tone="warning">Bắt buộc</StatusTag>}
                        <span>{formatMaterialCount(lesson.materialCount)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </section>
      {course.requiredMaterialCount > 0 && (
        <section className="course-overview-section">
          <h3>Điều kiện cấp Chứng chỉ</h3>
          <p>Hoàn thành toàn bộ {course.requiredMaterialCount} học liệu bắt buộc</p>
        </section>
      )}
    </div>
  );
};

const EnrollmentPanel = ({ courseId, fromPage }: { courseId: string; fromPage?: number }) => {
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  const links = useApiQuery((signal) => fetchEnrolledCourseLinks(signal), [courseId]);
  const [enrolledId, setEnrolledId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedReason | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const linkedId = links.status === "success" ? buildEnrolledMap(links.data).get(courseId) : undefined;
  const enrollmentId = enrolledId ?? linkedId;

  const enroll = async () => {
    setEnrolling(true);
    let result;
    try {
      result = await enrollOptionalCourse(courseId);
    } catch (error) {
      result = error instanceof ApiError ? error : new ApiError(0, "NETWORK", "");
    } finally {
      setEnrolling(false);
    }

    const outcome = resolveEnrollOutcome(result);
    const text = getEnrollOutcomeMessage(outcome);
    switch (outcome.kind) {
      case "enrolled":
      case "restored":
        message.success(text);
        setEnrolledId(outcome.enrollmentId);
        break;
      case "alreadyEnrolled":
        message.info(text);
        setEnrolledId(outcome.enrollmentId);
        break;
      case "inGrace":
      case "forbidden":
      case "unavailable":
        setBlocked(outcome.kind);
        break;
      case "retry":
        message.error(text);
        if (outcome.refreshLinks) links.reload();
        break;
      case "rateLimited":
        message.warning(text);
        break;
      case "notRestorable":
        message.error(text);
        break;
    }
  };

  const confirmEnroll = () => {
    if (enrolling) return;
    modal.confirm({
      title: "Đăng ký Khóa học này?",
      content: "Bạn có thể rút bất cứ lúc nào.",
      okText: "Đăng ký",
      cancelText: "Hủy",
      // Trả promise để nút "Đăng ký" ở trạng thái loading và không bấm được lần hai
      onOk: enroll,
    });
  };

  const renderAction = () => {
    if (enrollmentId) {
      return (
        <LearnerButton type="primary" block onClick={() => navigate(LEARNER_ROUTES.curriculum(enrollmentId))}>
          Vào học
        </LearnerButton>
      );
    }
    if (blocked === "unavailable") {
      return (
        <>
          <WarningPanel title={ENROLL_OUTCOME_MESSAGES.unavailable}>
            Khóa học đã thay đổi trong lúc bạn đang xem.
          </WarningPanel>
          <LearnerButton block onClick={() => navigate(LEARNER_ROUTES.catalog(fromPage))}>
            Về danh mục Khóa học
          </LearnerButton>
        </>
      );
    }
    if (blocked) {
      return <WarningPanel title="Chưa thể đăng ký">{ENROLL_OUTCOME_MESSAGES[blocked]}</WarningPanel>;
    }
    if (links.status === "loading") {
      return <Skeleton.Button active block className="course-overview-action-skeleton" />;
    }
    if (links.status === "error") {
      // D49: không hiện "Đăng ký học" khi chưa biết đã đăng ký hay chưa; Thử lại chỉ gọi lại course-ids
      return (
        <div className="course-overview-links-error" role="alert">
          <p>Chưa kiểm tra được trạng thái đăng ký</p>
          <LearnerButton block onClick={links.reload}>
            Thử lại
          </LearnerButton>
        </div>
      );
    }
    return (
      <LearnerButton type="primary" block loading={enrolling} onClick={confirmEnroll}>
        Đăng ký học
      </LearnerButton>
    );
  };

  return (
    <aside className="course-overview-enrollment">
      <h3>Đăng ký</h3>
      <span className="course-overview-tag">Tự chọn</span>
      <p>Tự đăng ký, không cần duyệt. Khóa học tự chọn không có hạn hoàn thành.</p>
      {renderAction()}
    </aside>
  );
};

const CourseOverviewContent = ({ courseId, fromPage }: { courseId: string; fromPage?: number }) => {
  const navigate = useNavigate();
  const intro = useApiQuery((signal) => fetchCourseIntroduction(courseId, signal), [courseId]);
  const backToCatalog = () => navigate(LEARNER_ROUTES.catalog(fromPage));

  if (intro.status === "loading") {
    return <LearnerSkeleton variant="detail" />;
  }
  if (intro.status === "error") {
    if (intro.error.status === 404 && intro.error.code === "COURSE_NOT_FOUND") {
      return (
        <LearnerEmptyState
          title="Khóa học không tồn tại hoặc không còn trong danh mục"
          action={<LearnerButton onClick={backToCatalog}>Về danh mục Khóa học</LearnerButton>}
        />
      );
    }
    return (
      <LearnerErrorState
        error={intro.error}
        title="Không tải được giới thiệu Khóa học"
        message={INTRO_ERROR_MESSAGES[intro.error.code] ?? "Đã có lỗi xảy ra khi tải giới thiệu Khóa học."}
        onRetry={intro.reload}
      />
    );
  }

  return (
    <>
      <PageHeader title={intro.data.name} subtitle={intro.data.shortDescription ?? ""} />
      <div className="course-overview-body">
        <CourseContent course={intro.data} />
        <EnrollmentPanel courseId={courseId} fromPage={fromPage} />
      </div>
    </>
  );
};

const CourseOverview = () => {
  const { courseId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fromPage = readFromPage(location.state);

  return (
    <LearnerPage className="course-overview">
      <Button
        className="learner-back"
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(LEARNER_ROUTES.catalog(fromPage))}
      >
        Danh mục Khóa học
      </Button>
      {/* key: đổi Course thì trạng thái đăng ký cục bộ bắt đầu lại */}
      <CourseOverviewContent key={courseId} courseId={courseId} fromPage={fromPage} />
    </LearnerPage>
  );
};

export default CourseOverview;
