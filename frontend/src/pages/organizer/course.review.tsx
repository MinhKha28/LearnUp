import { Alert, Collapse, Empty, Input, Modal, Skeleton, message } from "antd";
import { EyeOutlined, DownloadOutlined } from "@ant-design/icons";

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
  approveCourseAPI,
  rejectCourseAPI,
  fetchOrganizerMaterialPreviewAPI,
  fetchOrganizerReadingContentAPI,
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

import "./course.review.scss";

// The project's Axios interceptor can return error
// bodies without rejecting the Promise.
const isSuccess = (statusCode: unknown) => {
  const status = Number(statusCode);

  return Number.isInteger(status) && status >= 200 && status < 300;
};

// Present the real storage filename; append .pdf only when a PDF has no extension.
const materialFilename = (material: IReviewMaterial) => {
  const filename = (material.filename || material.title || "reading").trim();
  return material.mimeType === "application/pdf" &&
    !/\.[a-z\d]{1,8}$/i.test(filename)
    ? filename + ".pdf"
    : filename;
};

const readPdfBlob = async (courseId: string, materialId: string) => {
  // Binary endpoint uses the authenticated course Axios instance.
  const response = await fetchOrganizerReadingContentAPI(courseId, materialId);
  const data: unknown = (response as { data?: unknown }).data;
  if (!(data instanceof Blob) || !data.size) {
    throw new Error("Invalid Reading PDF response");
  }
  return new Blob([data], { type: "application/pdf" });
};

const showValue = (value: number | null) =>
  value === null ? "Not configured" : String(value);

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
          {isQuiz ? "Quiz" : "Assignment"}: {assessment.title}
        </h4>

        <StatusTag tone="neutral">
          {assessment.isRequired ? "Required" : "Optional"}
        </StatusTag>

        {assessment.disabled && <StatusTag tone="error">Disabled</StatusTag>}
      </div>

      <div className="review-meta">
        <span>Passing score: {assessment.passingScore}</span>
        <span>Maximum attempts: {assessment.maxConsecutiveAttempts}</span>
        <span>Lockout: {assessment.lockoutHours} hours</span>
      </div>

      {isQuiz ? (
        <div>
          <p>
            <strong>Time limit:</strong>{" "}
            {assessment.timeLimitMinutes === null
              ? "Not configured"
              : `${assessment.timeLimitMinutes} minutes`}
          </p>

          <p>
            <strong>Question count:</strong> {assessment.questions.length}
          </p>

          {assessment.questions.length === 0 ? (
            <Empty description="No questions" />
          ) : (
            assessment.questions.map((question) => (
              <div key={question.id} className="review-question">
                <h5>
                  Question {question.position}: {question.content}
                </h5>

                <p>Type: {question.type}</p>

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
          <h5>Assignment prompt</h5>

          <p className="review-content">
            {assessment.prompt || "No text prompt provided."}
          </p>

          {assessment.promptFileName && (
            <div className="review-material">
              <div>
                <strong>{assessment.promptFileName}</strong>
                <small>Assignment attachment</small>
              </div>

              <OrganizerButton
                size="small"
                loading={downloading}
                disabled={downloading}
                onClick={() => onDownload(assessment)}
              >
                Download attachment
              </OrganizerButton>
            </div>
          )}

          <p>
            <strong>Expected duration:</strong>{" "}
            {assessment.expectedDurationMinutes === null
              ? "Not configured"
              : `${assessment.expectedDurationMinutes} minutes`}
          </p>

          <h5>Peer Review configuration</h5>

          <div className="review-meta">
            <span>Enabled: {assessment.peerReviewEnabled ? "Yes" : "No"}</span>

            {assessment.peerReviewEnabled && (
              <>
                <span>
                  Reviewers per submission:{" "}
                  {showValue(assessment.peerReviewersPerSubmission)}
                </span>

                <span>
                  Cycle: {showValue(assessment.peerReviewCycleDays)} days
                </span>

                <span>
                  Deadline: {showValue(assessment.peerReviewDeadlineDays)} days
                </span>

                <span>
                  Score gap: {showValue(assessment.peerReviewScoreGap)}
                </span>
              </>
            )}
          </div>

          <h5>Grading rubric</h5>

          <p>Total points: {rubricTotal}</p>

          {assessment.rubric.length === 0 ? (
            <Empty description="No rubric criteria" />
          ) : (
            <div className="review-rubric">
              {assessment.rubric.map((criterion) => (
                <div key={criterion.id}>
                  <strong>
                    {criterion.position}. {criterion.name}
                  </strong>

                  <p>{criterion.description}</p>

                  <small>{criterion.maxPoints} points</small>
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

  const [assessments, setAssessments] = useState<IReviewAssessment[]>([]);

  const [loading, setLoading] = useState(true);
  const [courseError, setCourseError] = useState("");
  const [assessmentError, setAssessmentError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  const [preview, setPreview] = useState<IMaterialPreview | null>(null);
  const [previewName, setPreviewName] = useState("");
  const previewBlobUrl = useRef<string | null>(null);
  const [readingDownloadingId, setReadingDownloadingId] = useState<string | null>(null);
  const readingDownloadInFlight = useRef(false);

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

  const releasePreviewUrl = () => {
    if (previewBlobUrl.current) {
      URL.revokeObjectURL(previewBlobUrl.current);
      previewBlobUrl.current = null;
    }
  };

  const closeMaterialPreview = () => {
    setPreviewOpen(false);
    setPreview(null);
    setPreviewName("");
    releasePreviewUrl();
  };

  useEffect(() => () => {
    if (previewBlobUrl.current) URL.revokeObjectURL(previewBlobUrl.current);
  }, []);

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
      setPreviewName("");
      if (previewBlobUrl.current) {
        URL.revokeObjectURL(previewBlobUrl.current);
        previewBlobUrl.current = null;
      }
      setDecisionOpen(null);
      setRejectionReason("");

      if (!courseId) {
        setCourseError("Course ID is missing.");
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
          setCourseError("Course is not available for review.");
          return;
        }

        if (response.data.status !== "Submitted") {
          setCourseError("Course is no longer awaiting approval.");
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
            setAssessmentError("Unable to load Course Assessments.");
          } else {
            setAssessments(result.data.items);
          }
        } catch {
          if (active) {
            setAssessmentError("Assessment Service is unavailable.");
          }
        }
      } catch {
        if (active) {
          setCourseError("Course Service is unavailable.");
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
      message.error("Please enter a rejection reason (up to 1,000 characters).");
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
          message.warning("This Course has changed status. Refresh the review list.");
        } else if (Number(response.statusCode) === 401 || Number(response.statusCode) === 403) {
          message.error("You do not have access to make this decision.");
        } else {
          message.error("Unable to process this Course. Please try again.");
        }
        return;
      }

      message.success(decision === "APPROVE"
        ? "Course approved successfully."
        : "Course rejected successfully.");
      setDecisionOpen(null);
      setRejectionReason("");
      navigate("/organizer/courses/approvals", { replace: true });
    } catch {
      message.error("Unable to reach Course Service. Please try again.");
    } finally {
      decisionInFlightRef.current = false;
      setDecisionLoading(false);
    }
  };

  // PDF: obtain authenticated bytes and create a local Blob URL.
  // Video: retain the existing protected signed-URL player.
  const openMaterialPreview = async (material: IReviewMaterial) => {
    if (!course || !material.previewAvailable || previewLoadingId !== null) {
      return;
    }
    closeMaterialPreview();
    setPreviewName(materialFilename(material));
    setPreviewLoadingId(material.id);

    try {
      if (material.mimeType === "application/pdf") {
        const pdf = await readPdfBlob(course.id, material.id);
        const url = URL.createObjectURL(pdf);
        previewBlobUrl.current = url;
        setPreview({
          url,
          mimeType: "application/pdf",
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
        setPreviewOpen(true);
        return;
      }

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
        message.error("Unable to open material preview.");
        return;
      }
      if (new Date(result.data.expiresAt).getTime() <= Date.now()) {
        message.error("Preview URL has expired.");
        return;
      }
      setPreview(result.data);
      setPreviewOpen(true);
    } catch {
      message.error("Unable to open material preview.");
    } finally {
      setPreviewLoadingId(null);
    }
  };

  // Explicit download action: Preview never invokes this function.
  const downloadReading = async (material: IReviewMaterial) => {
    if (!course || readingDownloadInFlight.current) return;
    readingDownloadInFlight.current = true;
    setReadingDownloadingId(material.id);
    try {
      const pdf = await readPdfBlob(course.id, material.id);
      const url = URL.createObjectURL(pdf);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = materialFilename(material).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      message.error("Unable to download Reading PDF.");
    } finally {
      readingDownloadInFlight.current = false;
      setReadingDownloadingId(null);
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
        message.error("Unable to download Assignment attachment.");
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
      message.error("Unable to download Assignment attachment.");
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

  // Initial loading.
  if (loading) {
    return (
      <OrganizerPage className="organizer-course-review">
        <PageHeader
          title="Review Course"
          subtitle="Loading Course content..."
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
          title="Course Review"
          subtitle="Unable to display Course content."
          back
        />

        <Alert
          type="error"
          showIcon
          message={courseError || "Course is not available for review."}
        />

        <div className="review-actions">
          <OrganizerButton onClick={refreshReview}>Retry</OrganizerButton>

          <OrganizerButton
            onClick={() => navigate("/organizer/courses/approvals")}
          >
            Back to approvals
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
        title="Review Course"
        subtitle={`${course.name} • Version ${course.versionNumber}`}
        back
        actions={
          <div className="review-decision-actions">
            <OrganizerButton
              disabled={decisionLoading}
              onClick={() => navigate("/organizer/courses/approvals")}
            >
              Back to approvals
            </OrganizerButton>
            <OrganizerButton
              disabled={!canDecide || decisionOpen !== null}
              onClick={() => setDecisionOpen("REJECT")}
            >
              Reject Course
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              disabled={!canDecide || decisionOpen !== null}
              onClick={() => setDecisionOpen("APPROVE")}
            >
              Approve Course
            </OrganizerButton>
          </div>
        }
      />

      <SectionCard title="Course governance">
        <div className="organizer-course-tags">
          <StatusTag tone="warning">{course.status}</StatusTag>

          <StatusTag tone="neutral">{course.courseType}</StatusTag>
        </div>

        <div className="organizer-detail-grid">
          <div className="organizer-detail-item">
            <span>Instructor ID</span>
            <strong>{course.instructorId}</strong>
          </div>

          <div className="organizer-detail-item">
            <span>Expected completion</span>
            <strong>{course.expectedCompletionDays} days</strong>
          </div>

          <div className="organizer-detail-item">
            <span>Version</span>
            <strong>{course.versionNumber}</strong>
          </div>

          <div className="organizer-detail-item">
            <span>Locked</span>
            <strong>{course.locked ? "Yes" : "No"}</strong>
          </div>
        </div>
      </SectionCard>

      <div className="organizer-content-grid organizer-course-review-grid">
        <SectionCard title="Course overview">
          <div className="organizer-detail-grid">
            <div className="organizer-detail-item">
              <span>Description</span>
              <strong>{course.shortDescription || "Not provided"}</strong>
            </div>

            <div className="organizer-detail-item">
              <span>Training objectives</span>
              <strong>{course.trainingObjectives || "Not provided"}</strong>
            </div>

            <div className="organizer-detail-item">
              <span>Learning structure</span>
              <strong>
                {course.modules.length} Modules · {lessonCount} Lessons
                {!assessmentError && (
                  <>
                    {" "}
                    · {quizCount} Quizzes · {assignmentCount} Assignments
                  </>
                )}
              </strong>
            </div>
          </div>

          <h3>Learning outcomes</h3>

          {course.learningOutcomes.length === 0 ? (
            <Empty description="No Learning Outcomes" />
          ) : (
            <ul>
              {course.learningOutcomes.map((outcome, index) => (
                <li key={index}>{outcome}</li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Curriculum review"
          extra={
            <OrganizerButton size="small" onClick={refreshReview}>
              Refresh
            </OrganizerButton>
          }
        >
          {assessmentError && (
            <Alert
              className="review-alert"
              type="warning"
              showIcon
              message={assessmentError}
              description="Assessment details are not verified. Refresh before completing your review."
            />
          )}

          {course.modules.length === 0 ? (
            <Empty description="No Modules" />
          ) : (
            <Collapse
              items={course.modules.map((module) => ({
                key: module.id,
                label: `Module ${module.position}: ${module.title}`,
                children: (
                  <div className="review-module">
                    {module.lessons.map((lesson) => (
                      <section key={lesson.id} className="review-lesson">
                        <h4>
                          Lesson {lesson.position}: {lesson.title}
                        </h4>

                        {lesson.disabled && (
                          <StatusTag tone="error">Disabled</StatusTag>
                        )}

                        <p className="review-content">
                          {lesson.content || "No Lesson content"}
                        </p>

                        {lesson.materials.map((material) => (
                          <div key={material.id} className="review-material">
                            <div>
                              <strong>{material.title}</strong>

                              <small>
                                {material.materialType}
                                {" · "}
                                {material.isRequired ? "Required" : "Optional"}
                                {material.disabled ? " · Disabled" : ""}
                              </small>

                              <small title={materialFilename(material)}>
                                {materialFilename(material)}
                              </small>
                            </div>

                            <div className="review-material-actions">
                              <OrganizerButton
                                size="small"
                                loading={previewLoadingId === material.id}
                                disabled={!material.previewAvailable || previewLoadingId !== null}
                                onClick={() => void openMaterialPreview(material)}
                              >
                                <EyeOutlined /> Preview
                              </OrganizerButton>
                              {material.mimeType === "application/pdf" && (
                                <OrganizerButton
                                  size="small"
                                  loading={readingDownloadingId === material.id}
                                  disabled={!material.previewAvailable || readingDownloadingId !== null}
                                  onClick={() => void downloadReading(material)}
                                >
                                  <DownloadOutlined /> Download
                                </OrganizerButton>
                              )}
                            </div>
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

          <h3 className="review-section-title">Course-level Assessments</h3>

          {courseLevelAssessments.length === 0 ? (
            <Empty
              description={
                assessmentError
                  ? "Assessment information unavailable"
                  : "No Course-level Assessments"
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
              message="Some Assessments reference unknown Modules."
            />
          )}
        </SectionCard>
      </div>

      <Modal
        title={previewName ? `Preview · ${previewName}` : "Material preview"}
        open={previewOpen}
        footer={null}
        width={960}
        destroyOnClose
        onCancel={closeMaterialPreview}
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
            title="Reading material preview"
            src={preview.url + "#toolbar=0&navpanes=0"}
          />
        ) : (
          <Empty description="Preview unavailable" />
        )}
      </Modal>

      <Modal
        title="Approve Course"
        open={decisionOpen === "APPROVE"}
        okText="Confirm Approval"
        confirmLoading={decisionLoading}
        okButtonProps={{ disabled: !canDecide }}
        cancelButtonProps={{ disabled: decisionLoading }}
        closable={!decisionLoading}
        maskClosable={!decisionLoading}
        onOk={() => void handleDecision("APPROVE")}
        onCancel={() => { if (!decisionLoading) setDecisionOpen(null); }}
      >
        <p>Approve <strong>{course.name}</strong> (Version {course.versionNumber})?</p>
        {course.versionNumber > 1 && (
          <Alert
            type="warning"
            showIcon
            message="Version replacement"
            description="If an older version is Published, it will be Archived."
          />
        )}
      </Modal>

      <Modal
        title="Reject Course"
        open={decisionOpen === "REJECT"}
        okText="Confirm Rejection"
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
        <p>Explain why <strong>{course.name}</strong> cannot be approved.</p>
        <Input.TextArea
          aria-label="Rejection reason"
          rows={5}
          maxLength={1000}
          showCount
          value={rejectionReason}
          disabled={decisionLoading}
          onChange={(event) => setRejectionReason(event.target.value)}
          placeholder="Enter the rejection reason..."
        />
      </Modal>
    </OrganizerPage>
  );
};

export default CourseReview;
