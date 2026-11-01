import { Alert, message, Skeleton } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";

import {
  fetchCourseDetailAPI,
  submitCourseForApprovalAPI,
} from "@/services/course.service";

import type { ICourseDetail } from "@/types/course.types";

import "./course.submit.scss";

const CourseSubmit = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState<ICourseDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Chặn double-click trước cả khi React cập nhật state.
  const submitInProgress = useRef(false);

  const loadCourse = useCallback(async () => {
    if (!courseId) {
      setError("Course ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetchCourseDetailAPI(courseId);

      if (!response.data) {
        throw new Error("Course not found.");
      }

      setCourse(response.data);
    } catch {
      setCourse(null);
      setError("Unable to load Course information.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const handleSubmit = async () => {
    if (!course || submitInProgress.current) return;

    if (course.status !== "Draft" && course.status !== "Rejected") {
      message.warning("Course cannot be submitted.");
      return;
    }

    submitInProgress.current = true;
    setSubmitting(true);

    try {
      const response = await submitCourseForApprovalAPI(course.id);

      // Interceptor có thể trả error response.
      if (response.data?.status !== "Submitted") {
        message.error(
          "Unable to submit Course. Check Course information and Quiz questions.",
        );

        await loadCourse();
        return;
      }

      message.success("Course submitted successfully.");

      navigate(`/instructor/courses/${course.id}/submitted`, { replace: true });
    } catch {
      message.error("Unable to submit Course.");

      await loadCourse();
    } finally {
      submitInProgress.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <InstructorPage className="instructor-course-submit">
        <Skeleton active paragraph={{ rows: 6 }} />
      </InstructorPage>
    );
  }

  if (!course) {
    return (
      <InstructorPage className="instructor-course-submit">
        <PageHeader
          eyebrow="COURSE / APPROVAL"
          title="Course not found"
          back
          subtitle=""
        />
        <Alert type="error" showIcon message={error || "Course not found."} />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  const canSubmit = course.status === "Draft" || course.status === "Rejected";

  const informationComplete =
    Boolean(course.shortDescription?.trim()) &&
    Boolean(course.trainingObjectives?.trim()) &&
    course.learningOutcomes.some((outcome) => outcome.trim().length > 0);

  return (
    <InstructorPage className="instructor-course-submit">
      <PageHeader
        eyebrow="COURSE / APPROVAL"
        title="Review and Submit Course"
        subtitle="Review your Course before sending it for approval."
        back
      />

      <div className="instructor-submit-grid">
        <SectionCard className="instructor-submit-main">
          <h2 className="instructor-submit-heading">
            {course.name} • {course.status}
          </h2>

          {course.status === "Rejected" && course.rejectionReason && (
            <Alert
              type="warning"
              showIcon
              message="Previous rejection reason"
              description={course.rejectionReason}
              style={{ marginBottom: 16 }}
            />
          )}

          {!canSubmit && (
            <Alert
              type="warning"
              showIcon
              message="This Course cannot be submitted."
              style={{ marginBottom: 16 }}
            />
          )}

          {!informationComplete && (
            <Alert
              type="warning"
              showIcon
              message="Course information is incomplete."
              description="Provide a short description, training objectives and at least one Learning Outcome."
              style={{ marginBottom: 16 }}
            />
          )}

          <div className="instructor-submit-rows">
            <div className="instructor-submit-row">
              <div>
                <strong>Course details</strong>
                <p>Review the description, objectives and Learning Outcomes.</p>
              </div>

              <button
                type="button"
                className="instructor-submit-review-link"
                onClick={() =>
                  navigate(`/instructor/courses/${course.id}/edit`)
                }
              >
                Review
              </button>
            </div>

            <div className="instructor-submit-row">
              <div>
                <strong>Course content and assessments</strong>
                <p>Review Modules, Lessons, resources and Quiz questions.</p>
              </div>

              <button
                type="button"
                className="instructor-submit-review-link"
                onClick={() =>
                  navigate(`/instructor/courses/${course.id}/builder`)
                }
              >
                Review
              </button>
            </div>
          </div>

          <div className="instructor-submit-warning">
            <strong>Estimated learning duration</strong>
            <p>
              {course.estimatedDurationMinutes === null
                ? "Estimated duration is not available."
                : `${course.estimatedDurationMinutes} minutes estimated.`}
            </p>
            <p>Duration warnings do not block submission.</p>
          </div>

          <div className="instructor-submit-actions">
            <InstructorButton
              disabled={submitting}
              onClick={() => navigate(`/instructor/courses/${course.id}`)}
            >
              Cancel
            </InstructorButton>

            <InstructorButton
              type="primary"
              loading={submitting}
              disabled={!canSubmit || !informationComplete}
              onClick={() => void handleSubmit()}
            >
              {course.status === "Rejected"
                ? "Resubmit Course"
                : "Submit Course"}
            </InstructorButton>
          </div>
        </SectionCard>

        <SectionCard title="Approval route" className="instructor-submit-side">
          <p>Draft or Rejected → Submitted</p>
          <p>Organizer reviews and makes a decision.</p>
          <p>Submitted does not mean Published.</p>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default CourseSubmit;
