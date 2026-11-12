import { Alert, Collapse, Empty, Input, Modal, Skeleton, message } from "antd";

import { useEffect, useRef, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";

import {
  fetchOrganizerCourseReviewAPI,
  fetchOrganizationCourseInstructorsAPI,
  approveCourseAPI,
  rejectCourseAPI,
  fetchOrganizerMaterialPreviewAPI,
} from "@/services/course.service";

import {
  downloadOrganizerAssignmentPromptAPI,
  fetchOrganizerAssessmentReviewAPI,
} from "@/services/assessment.service";

import type {
  IOrganizerCourseReview,
  IReviewAssessment,
  IReviewMaterial,
  IMaterialPreview,
} from "@/types/course.types";

import {
  courseStatusText,
  courseTypeText,
  materialTypeText,
  questionTypeText,
} from "@/utils/organizer.labels";
import "./course.review.scss";

// The project's Axios interceptor can return error
// bodies without rejecting the Promise.
const isSuccess = (statusCode: unknown) => {
  const status = Number(statusCode);

  return Number.isInteger(status) && status >= 200 && status < 300;
};

const showValue = (value: number | null) =>
  value === null ? "Chưa cấu hình" : String(value);

/**
 * Read-only Quiz / Assignment presentation.
 * No editing, submission or grading actions.
 */
const AssessmentContent = ({
  assessment,
  onDownload,
  downloading,
}: {
  assessment: IReviewAssessment;
  onDownload: (item: IReviewAssessment) => void;
  downloading: boolean;
}) => {
  const isQuiz = assessment.kind === "QUIZ";

  const rubricTotal = assessment.rubric.reduce(
    (total, criterion) => total + criterion.maxPoints,
    0,
  );

  return (
    <article className="review-assessment">
      <div className="review-heading">
        <h4>
          {isQuiz ? "Bài trắc nghiệm" : "Bài tập"}: {assessment.title}
        </h4>

        <StatusTag tone="neutral">
          {assessment.isRequired ? "Bắt buộc" : "Tự chọn"}
        </StatusTag>

        {assessment.disabled && <StatusTag tone="error">Đã vô hiệu hóa</StatusTag>}
      </div>

      <div className="review-meta">
        <span>Điểm đạt: {assessment.passingScore}</span>
        <span>Số lần làm tối đa: {assessment.maxConsecutiveAttempts}</span>
        <span>Thời gian chờ: {assessment.lockoutHours} giờ</span>
      </div>

      {isQuiz ? (
        <div>
          <p>
            <strong>Thời gian làm bài:</strong>{" "}
            {assessment.timeLimitMinutes === null
              ? "Chưa cấu hình"
              : `${assessment.timeLimitMinutes} phút`}
          </p>

          <p>
            <strong>Số câu hỏi:</strong> {assessment.questions.length}
          </p>

          {assessment.questions.length === 0 ? (
            <Empty description="Chưa có câu hỏi" />
          ) : (
            assessment.questions.map((question) => (
              <div key={question.id} className="review-question">
                <h5>
                  Câu hỏi {question.position}: {question.content}
                </h5>

                <p>Loại: {questionTypeText(question.type)}</p>

                <ul>
                  {question.options.map((option) => (
                    <li key={option.id}>
                      {option.content}

                      {option.isCorrect && (
                        <strong className="review-correct">
                          {" "}
                          — Correct answer
                        </strong>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : (
        <div>
          <h5>Đề bài</h5>

          <p className="review-content">
            {assessment.prompt || "Chưa có đề bài dạng văn bản."}
          </p>

          {assessment.promptFileName && (
            <div className="review-material">
              <div>
                <strong>{assessment.promptFileName}</strong>
                <small>Tệp đính kèm bài tập</small>
              </div>

              <OrganizerButton
                size="small"
                loading={downloading}
                disabled={downloading}
                onClick={() => onDownload(assessment)}
              >
                Tải tệp đính kèm
              </OrganizerButton>
            </div>
          )}

          <p>
            <strong>Thời lượng dự kiến:</strong>{" "}
            {assessment.expectedDurationMinutes === null
              ? "Chưa cấu hình"
              : `${assessment.expectedDurationMinutes} phút`}
          </p>

          <h5>Cấu hình chấm chéo</h5>

          <div className="review-meta">
            <span>Đã bật: {assessment.peerReviewEnabled ? "Có" : "Không"}</span>

            {assessment.peerReviewEnabled && (
              <>
                <span>
                  Số người chấm mỗi bài nộp:{" "}
                  {showValue(assessment.peerReviewersPerSubmission)}
                </span>

                <span>
                  Đợt: {showValue(assessment.peerReviewCycleDays)} ngày
                </span>

                <span>
                  Hạn chót: {showValue(assessment.peerReviewDeadlineDays)} ngày
                </span>

                <span>
                  Chênh lệch điểm: {showValue(assessment.peerReviewScoreGap)}
                </span>
              </>
            )}
          </div>

          <h5>Tiêu chí chấm điểm</h5>

          <p>Tổng điểm: {rubricTotal}</p>

          {assessment.rubric.length === 0 ? (
            <Empty description="Chưa có tiêu chí chấm điểm" />
          ) : (
            <div className="review-rubric">
              {assessment.rubric.map((criterion) => (
                <div key={criterion.id}>
                  <strong>
                    {criterion.position}. {criterion.name}
                  </strong>

                  <p>{criterion.description}</p>

                  <small>{criterion.maxPoints} điểm</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

const CourseReview = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState<IOrganizerCourseReview | null>(null);
  const [instructorName, setInstructorName] = useState<string | null>(null);

  const [assessments, setAssessments] = useState<IReviewAssessment[]>([]);

  const [loading, setLoading] = useState(true);
  const [courseError, setCourseError] = useState("");
  const [assessmentError, setAssessmentError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  const [preview, setPreview] = useState<IMaterialPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Prevent duplicate attachment downloads immediately,
  // without waiting for the next React render.
  const downloadingRef = useRef(false);

  const [decisionOpen, setDecisionOpen] = useState<"APPROVE" | "REJECT" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  // Ref closes the gap before React's next render: one request per decision.
  const decisionInFlightRef = useRef(false);

  // Load real Course and Assessment data.
  useEffect(() => {
    let active = true;

    const loadReview = async () => {
      setLoading(true);
      setCourse(null);
      setAssessments([]);
      setCourseError("");
      setAssessmentError("");
      setPreview(null);
      setPreviewOpen(false);
      setDecisionOpen(null);
      setRejectionReason("");

      if (!courseId) {
        setCourseError("Thiếu mã khóa học.");
        setLoading(false);
        return;
      }

      try {
        // Step 1: Verify Course review access.
        const response = await fetchOrganizerCourseReviewAPI(courseId);

        if (!active) return;

        if (
          !isSuccess(response.statusCode) ||
          !response.data ||
          response.data.id !== courseId ||
          !Array.isArray(response.data.modules)
        ) {
          setCourseError("Không thể xem xét khóa học này.");
          return;
        }

        if (response.data.status !== "Submitted") {
          setCourseError("Khóa học đã rời trạng thái chờ phê duyệt.");
          return;
        }

        setCourse(response.data);

        // Step 2: Load assessment content only
        // after the Course is confirmed accessible.
        try {
          const result = await fetchOrganizerAssessmentReviewAPI(courseId);

          if (!active) return;

          if (
            !isSuccess(result.statusCode) ||
            !result.data ||
            result.data.courseId !== courseId ||
            !Array.isArray(result.data.items)
          ) {
            setAssessmentError("Không thể tải các bài đánh giá của khóa học.");
          } else {
            setAssessments(result.data.items);
          }
        } catch {
          if (active) {
            setAssessmentError("Tạm thời không thể truy cập thông tin bài đánh giá.");
          }
        }
      } catch {
        if (active) {
          setCourseError("Tạm thời không thể truy cập thông tin khóa học.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReview();

    return () => {
      active = false;
    };
  }, [courseId, reloadKey]);

  const refreshReview = () => {
    setReloadKey((current) => current + 1);
  };

  const canDecide =
    !loading &&
    course?.status === "Submitted" &&
    !assessmentError &&
    !decisionLoading &&
    !decisionInFlightRef.current;

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    if (!courseId || !course || !canDecide || decisionOpen !== decision) return;
    const reason = rejectionReason.trim();

    if (decision === "REJECT" && (!reason || reason.length > 1000)) {
      message.error("Nhập lý do từ chối (tối đa 1.000 ký tự).");
      return;
    }

    decisionInFlightRef.current = true;
    setDecisionLoading(true);

    try {
      const response = decision === "APPROVE"
        ? await approveCourseAPI(courseId)
        : await rejectCourseAPI(courseId, { reason });
      const expectedStatus = decision === "APPROVE" ? "Published" : "Rejected";

      // LearnUP interceptor may resolve HTTP 4xx/5xx with an error body.
      if (
        !isSuccess(response.statusCode) ||
        !response.data ||
        response.data.id !== courseId ||
        response.data.status !== expectedStatus
      ) {
        if (Number(response.statusCode) === 409) {
          message.warning("Trạng thái khóa học đã thay đổi. Hãy tải lại danh sách chờ phê duyệt.");
        } else if (Number(response.statusCode) === 401 || Number(response.statusCode) === 403) {
          message.error("Bạn không có quyền thực hiện thao tác này.");
        } else {
          message.error("Không thể xử lý khóa học này. Vui lòng thử lại.");
        }
        return;
      }

      message.success(decision === "APPROVE"
        ? "Đã phê duyệt khóa học."
        : "Đã từ chối khóa học.");
      setDecisionOpen(null);
      setRejectionReason("");
      navigate("/organizer/courses/approvals", { replace: true });
    } catch {
      message.error("Không thể kết nối để tải thông tin khóa học. Vui lòng thử lại.");
    } finally {
      decisionInFlightRef.current = false;
      setDecisionLoading(false);
    }
  };

  // Obtain a protected Video / PDF URL.
  const openMaterialPreview = async (material: IReviewMaterial) => {
    if (!course || !material.previewAvailable) {
      return;
    }

    setPreview(null);
    setPreviewOpen(false);
    setPreviewLoadingId(material.id);

    try {
      const result = await fetchOrganizerMaterialPreviewAPI(
        course.id,
        material.id,
      );

      if (
        !isSuccess(result.statusCode) ||
        !result.data?.url ||
        !result.data.mimeType ||
        !result.data.expiresAt
      ) {
        message.error("Không thể mở bản xem trước học liệu.");
        return;
      }

      if (new Date(result.data.expiresAt).getTime() <= Date.now()) {
        message.error("Liên kết xem trước đã hết hạn.");
        return;
      }

      setPreview(result.data);
      setPreviewOpen(true);
    } catch {
      message.error("Không thể kết nối để tải thông tin khóa học.");
    } finally {
      setPreviewLoadingId(null);
    }
  };

  // Download a PDF / DOCX / ZIP attachment.
  const downloadAttachment = async (item: IReviewAssessment) => {
    if (!course || !item.promptFileName || downloadingRef.current) {
      return;
    }

    downloadingRef.current = true;
    setDownloadingId(item.id);

    try {
      const blob = await downloadOrganizerAssignmentPromptAPI(
        course.id,
        item.id,
      );

      if (!blob) {
        message.error("Không thể tải tệp đính kèm bài tập.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = item.promptFileName;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      message.error("Không thể tải tệp đính kèm bài tập.");
    } finally {
      downloadingRef.current = false;
      setDownloadingId(null);
    }
  };

  const renderAssessment = (item: IReviewAssessment) => (
    <AssessmentContent
      key={item.id}
      assessment={item}
      downloading={downloadingId === item.id}
      onDownload={(assessment) => void downloadAttachment(assessment)}
    />
  );

  // Display a real Instructor name; failure here must never block UC21 review.
  useEffect(() => {
    const instructorId = course?.instructorId;
    if (!instructorId) {
      setInstructorName(null);
      return;
    }
    let active = true;
    void fetchOrganizationCourseInstructorsAPI()
      .then((response) => {
        if (!active) return;
        // The project's response interceptor unwraps successful JSON envelopes.
        const result = response as unknown as {
          statusCode: number;
          data?: Array<{ id: string; fullName: string }>;
        };
        setInstructorName(
          isSuccess(result.statusCode)
            ? result.data?.find((item) => item.id === instructorId)?.fullName ?? null
            : null,
        );
      })
      .catch(() => {
        if (active) setInstructorName(null);
      });
    return () => { active = false; };
  }, [course?.instructorId]);

  // Initial loading.
  if (loading) {
    return (
      <OrganizerPage className="organizer-course-review">
        <PageHeader
          title="Xem xét khóa học"
          subtitle="Đang tải nội dung khóa học…"
          back
        />

        <Skeleton active paragraph={{ rows: 7 }} />
      </OrganizerPage>
    );
  }

  // Error or inaccessible Course.
  if (!course) {
    return (
      <OrganizerPage className="organizer-course-review">
        <PageHeader
          title="Xem xét khóa học"
          subtitle="Không thể hiển thị nội dung khóa học."
          back
        />

        <Alert
          type="error"
          showIcon
          message={courseError || "Khóa học không còn khả dụng để xem xét."}
        />

        <div className="review-actions">
          <OrganizerButton onClick={refreshReview}>Thử lại</OrganizerButton>

          <OrganizerButton
            onClick={() => navigate("/organizer/courses/approvals")}
          >
            Về danh sách chờ phê duyệt
          </OrganizerButton>
        </div>
      </OrganizerPage>
    );
  }

  const lessonCount = course.modules.reduce(
    (total, module) => total + module.lessons.length,
    0,
  );

  const quizCount = assessments.filter((item) => item.kind === "QUIZ").length;

  const assignmentCount = assessments.filter(
    (item) => item.kind === "ASSIGNMENT",
  ).length;

  const courseLevelAssessments = assessments.filter(
    (item) => item.moduleId === null,
  );

  const unknownModuleAssessments = assessments.filter(
    (item) =>
      item.moduleId !== null &&
      !course.modules.some((module) => module.id === item.moduleId),
  );

  return (
    <OrganizerPage className="organizer-course-review">
      <PageHeader
        title="Xem xét khóa học"
        subtitle={`${course.name} • Phiên bản ${course.versionNumber}`}
        back
        actions={
          <div className="review-decision-actions">
            <OrganizerButton
              disabled={decisionLoading}
              onClick={() => navigate("/organizer/courses/approvals")}
            >
              Về danh sách chờ phê duyệt
            </OrganizerButton>
            <OrganizerButton
              disabled={!canDecide || decisionOpen !== null}
              onClick={() => setDecisionOpen("REJECT")}
            >
              Từ chối khóa học
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              disabled={!canDecide || decisionOpen !== null}
              onClick={() => setDecisionOpen("APPROVE")}
            >
              Phê duyệt khóa học
            </OrganizerButton>
          </div>
        }
      />

      <SectionCard title="Thông tin quản lý khóa học">
        <div className="organizer-course-tags">
          <StatusTag tone="warning">{courseStatusText(course.status)}</StatusTag>

          <StatusTag tone="neutral">{courseTypeText(course.courseType)}</StatusTag>
        </div>

        <div className="organizer-detail-grid">
          <div className="organizer-detail-item">
            <span>Giảng viên phụ trách</span>
            <strong>{instructorName || "Chưa xác định"}</strong>
            <small className="review-instructor-id">{course.instructorId}</small>
          </div>

          <div className="organizer-detail-item">
            <span>Thời hạn hoàn thành dự kiến</span>
            <strong>{course.expectedCompletionDays} ngày</strong>
          </div>

          <div className="organizer-detail-item">
            <span>Phiên bản</span>
            <strong>{course.versionNumber}</strong>
          </div>

          <div className="organizer-detail-item">
            <span>Đã khóa</span>
            <strong>{course.locked ? "Có" : "Không"}</strong>
          </div>
        </div>
      </SectionCard>

      <div className="organizer-content-grid organizer-course-review-grid">
        <SectionCard title="Tổng quan khóa học">
          <div className="organizer-detail-grid">
            <div className="organizer-detail-item">
              <span>Mô tả</span>
              <strong>{course.shortDescription || "Chưa cung cấp"}</strong>
            </div>

            <div className="organizer-detail-item">
              <span>Mục tiêu đào tạo</span>
              <strong>{course.trainingObjectives || "Chưa cung cấp"}</strong>
            </div>

            <div className="organizer-detail-item">
              <span>Cấu trúc khóa học</span>
              <strong>
                {course.modules.length} chương · {lessonCount} bài học
                {!assessmentError && (
                  <>
                    {" "}
                    · {quizCount} bài trắc nghiệm · {assignmentCount} bài tập
                  </>
                )}
              </strong>
            </div>
          </div>

          <h3>Kết quả học tập mong đợi</h3>

          {course.learningOutcomes.length === 0 ? (
            <Empty description="Chưa có kết quả học tập mong đợi" />
          ) : (
            <ul>
              {course.learningOutcomes.map((outcome, index) => (
                <li key={index}>{outcome}</li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Xem xét chương trình học"
          extra={
            <OrganizerButton size="small" onClick={refreshReview}>
              Tải lại
            </OrganizerButton>
          }
        >
          {assessmentError && (
            <Alert
              className="review-alert"
              type="warning"
              showIcon
              message={assessmentError}
              description="Chưa xác minh được thông tin bài đánh giá. Hãy tải lại trước khi hoàn tất xem xét."
            />
          )}

          {course.modules.length === 0 ? (
            <Empty description="Chưa có chương" />
          ) : (
            <Collapse
              items={course.modules.map((module) => ({
                key: module.id,
                label: `Chương ${module.position}: ${module.title}`,
                children: (
                  <div className="review-module">
                    {module.lessons.map((lesson) => (
                      <section key={lesson.id} className="review-lesson">
                        <h4>
                          Bài học {lesson.position}: {lesson.title}
                        </h4>

                        {lesson.disabled && (
                          <StatusTag tone="error">Đã vô hiệu hóa</StatusTag>
                        )}

                        <p className="review-content">
                          {lesson.content || "Bài học chưa có nội dung"}
                        </p>

                        {lesson.materials.map((material) => (
                          <div key={material.id} className="review-material">
                            <div>
                              <strong>{material.title}</strong>

                              <small>
                                {materialTypeText(material.materialType)}
                                {" · "}
                                {material.isRequired ? "Bắt buộc" : "Tự chọn"}
                                {material.disabled ? " · Đã vô hiệu hóa" : ""}
                              </small>

                              <small>{material.filename}</small>
                            </div>

                            <OrganizerButton
                              size="small"
                              loading={previewLoadingId === material.id}
                              disabled={
                                !material.previewAvailable ||
                                previewLoadingId !== null
                              }
                              onClick={() => void openMaterialPreview(material)}
                            >
                              Xem trước
                            </OrganizerButton>
                          </div>
                        ))}
                      </section>
                    ))}

                    {assessments
                      .filter((item) => item.moduleId === module.id)
                      .sort((a, b) => a.position - b.position)
                      .map(renderAssessment)}
                  </div>
                ),
              }))}
            />
          )}

          <h3 className="review-section-title">Bài đánh giá cấp khóa học</h3>

          {courseLevelAssessments.length === 0 ? (
            <Empty
              description={
                assessmentError
                  ? "Không xem được thông tin bài đánh giá"
                  : "Chưa có bài đánh giá cấp khóa học"
              }
            />
          ) : (
            [...courseLevelAssessments]
              .sort((a, b) => a.position - b.position)
              .map(renderAssessment)
          )}

          {unknownModuleAssessments.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message="Một số bài đánh giá tham chiếu đến chương không xác định."
            />
          )}
        </SectionCard>
      </div>

      <Modal
        title="Xem trước học liệu"
        open={previewOpen}
        footer={null}
        width={960}
        destroyOnClose
        onCancel={() => {
          setPreviewOpen(false);
          setPreview(null);
        }}
      >
        {preview?.mimeType.startsWith("video/") ? (
          <video
            className="review-video"
            controls
            playsInline
            preload="metadata"
            src={preview.url}
          />
        ) : preview?.mimeType === "application/pdf" ? (
          <iframe
            className="review-pdf"
            title="Xem trước tài liệu đọc"
            src={preview.url}
          />
        ) : (
          <Empty description="Không thể xem trước" />
        )}
      </Modal>

      <Modal
        title="Phê duyệt khóa học"
        open={decisionOpen === "APPROVE"}
        okText="Xác nhận phê duyệt"
        confirmLoading={decisionLoading}
        okButtonProps={{ disabled: !canDecide }}
        cancelButtonProps={{ disabled: decisionLoading }}
        closable={!decisionLoading}
        maskClosable={!decisionLoading}
        onOk={() => void handleDecision("APPROVE")}
        onCancel={() => { if (!decisionLoading) setDecisionOpen(null); }}
      >
        <p>Phê duyệt <strong>{course.name}</strong> (Phiên bản {course.versionNumber})?</p>
        {course.versionNumber > 1 && (
          <Alert
            type="warning"
            showIcon
            message="Thay thế phiên bản"
            description="Phiên bản đã phát hành trước đó sẽ được lưu trữ."
          />
        )}
      </Modal>

      <Modal
        title="Từ chối khóa học"
        open={decisionOpen === "REJECT"}
        okText="Xác nhận từ chối"
        okButtonProps={{
          danger: true,
          loading: decisionLoading,
          disabled: !canDecide || !rejectionReason.trim() || rejectionReason.trim().length > 1000,
        }}
        cancelButtonProps={{ disabled: decisionLoading }}
        closable={!decisionLoading}
        maskClosable={!decisionLoading}
        onOk={() => void handleDecision("REJECT")}
        onCancel={() => { if (!decisionLoading) setDecisionOpen(null); }}
      >
        <p>Nêu lý do <strong>{course.name}</strong> không thể được phê duyệt.</p>
        <Input.TextArea
          aria-label="Lý do từ chối"
          rows={5}
          maxLength={1000}
          showCount
          value={rejectionReason}
          disabled={decisionLoading}
          onChange={(event) => setRejectionReason(event.target.value)}
          placeholder="Nhập lý do từ chối…"
        />
      </Modal>
    </OrganizerPage>
  );
};

export default CourseReview;
