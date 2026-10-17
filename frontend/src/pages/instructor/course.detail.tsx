import { Alert, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import { fetchCourseDetailAPI } from "@/services/course.service";
import type { CourseStatus, ICourseDetail } from "@/types/course.types";

import "./course.detail.scss";

const courseStatusLabel: Record<CourseStatus, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  Published: "Published",
  Rejected: "Rejected",
  Archived: "Archived",
  Disabled: "Disabled",
};

const getCourseStatusTone = (
  status: CourseStatus,
): "neutral" | "success" | "warning" | "error" | "info" => {
  switch (status) {
    case "Published":
      return "success";
    case "Submitted":
      return "info";
    case "Rejected":
    case "Disabled":
      return "error";
    case "Archived":
      return "warning";
    default:
      return "neutral";
  }
};

const formatEstimatedDuration = (minutes: number | null) => {
  if (minutes === null) return "Not available";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
};

const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState<ICourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchCourse = useCallback(async () => {
    if (!courseId) {
      setLoading(false);
      setErrorMessage("Course ID is missing.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchCourseDetailAPI(courseId);

      if (!response.data) {
        setCourse(null);
        setErrorMessage(response.message || "Unable to load Course details.");
        return;
      }

      setCourse(response.data);
    } catch (error) {
      console.error("Fetch Course detail error:", error);
      setCourse(null);
      setErrorMessage("Unable to load Course details.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void fetchCourse();
  }, [fetchCourse]);

  if (loading) {
    return (
      <InstructorPage className="instructor-course-detail">
        <Skeleton active />
      </InstructorPage>
    );
  }

  if (!course) {
    return (
      <InstructorPage className="instructor-course-detail">
        <PageHeader
          eyebrow="MY COURSES"
          title="Course not found"
          subtitle="The Course does not exist or you do not have access."
          back
        />

        <Alert
          type="error"
          showIcon
          message={errorMessage || "Course not found."}
        />

        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-course-detail">
      <PageHeader
        eyebrow="MY COURSES / COURSE DETAIL"
        title={course.name}
        subtitle={`Version ${course.versionNumber} • ${
          course.courseType === "Public" ? "Public" : "Private"
        }`}
        back
        actions={
          <InstructorButton
            onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
          >
            Open Builder
          </InstructorButton>
        }
      />

      {course.coverUrl && (
        <div className="instructor-course-detail-cover">
          <img src={course.coverUrl} alt={course.name} />
        </div>
      )}

      <div className="instructor-course-detail-grid">
        <SectionCard className="instructor-course-detail-main">
          <div className="instructor-course-detail-block">
            <h2>Short description</h2>
            <p>
              {course.shortDescription ||
                "No short description has been provided."}
            </p>
          </div>

          <div className="instructor-course-detail-block">
            <h2>Training objective</h2>
            <p>
              {course.trainingObjectives ||
                "No training objective has been provided."}
            </p>
          </div>

          <div className="instructor-course-detail-block">
            <h2>Learning Outcomes</h2>

            {course.learningOutcomes.length > 0 ? (
              <ul className="instructor-course-outcomes">
                {course.learningOutcomes.map((outcome, index) => (
                  <li key={`${index}-${outcome}`}>{outcome}</li>
                ))}
              </ul>
            ) : (
              <p>No Learning Outcomes have been provided.</p>
            )}
          </div>

          <div className="instructor-course-detail-block instructor-course-detail-block-last">
            <h2>Course information</h2>

            <div className="instructor-course-info-table">
              <div className="instructor-course-info-row">
                <strong>Planned completion</strong>
                <span>{course.expectedCompletionDays} days</span>
              </div>

              <div className="instructor-course-info-row">
                <strong>Estimated learning time</strong>
                <span>
                  {formatEstimatedDuration(course.estimatedDurationMinutes)}
                </span>
              </div>

              <div className="instructor-course-info-row">
                <strong>Course type</strong>
                <span>
                  {course.courseType === "Public" ? "Public" : "Private"}
                </span>
              </div>

              <div className="instructor-course-info-row">
                <strong>Approval status</strong>
                <StatusTag tone={getCourseStatusTone(course.status)}>
                  {courseStatusLabel[course.status]}
                </StatusTag>
              </div>

              <div className="instructor-course-info-row">
                <strong>Structure status</strong>
                <span>{course.locked ? "Locked" : "Unlocked"}</span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Actions" className="instructor-course-actions-card">
          {(course.status === "Draft" || course.status === "Rejected") && (
            <InstructorButton
              block
              onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}
            >
              Edit Course Details
            </InstructorButton>
          )}

          <InstructorButton
            block
            onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
          >
            Open Builder
          </InstructorButton>

          {(course.status === "Draft" || course.status === "Rejected") && (
            <InstructorButton
              block
              type="primary"
              onClick={() =>
                navigate(`/instructor/courses/${course.id}/submit`)
              }
            >
              Submit for Review
            </InstructorButton>
          )}

          {course.status === "Submitted" && (
            <InstructorButton
              block
              onClick={() =>
                navigate(`/instructor/courses/${course.id}/withdraw`)
              }
            >
              Withdraw Submission
            </InstructorButton>
          )}

          {course.status === "Published" && (
            <InstructorButton
              block
              onClick={() =>
                navigate(`/instructor/courses/${course.id}/versions`)
              }
            >
              View Version Chain
            </InstructorButton>
          )}
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default CourseDetail;
