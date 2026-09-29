import { message } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { addInstructorCourse, consumeCourseQuota } from "@/components/instructor/instructor.data";
import type { IBasicDraft } from "./course.create.basic";
import { InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./course.create.scss";

const ESTIMATED_LEARNING_HOURS = 12;
const CONFIGURED_DAILY_HOURS = 8;

interface ILocationState {
  basic?: IBasicDraft;
  outcomes?: string[];
  visibility?: "Public" | "Private";
  plannedCompletionDays?: number;
}

const CourseCreateReview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ILocationState | null;

  if (!state?.basic || !state?.plannedCompletionDays) {
    navigate("/instructor/courses/create", { replace: true });
  }

  const days = state?.plannedCompletionDays ?? 0;
  const convertedCapacity = days * CONFIGURED_DAILY_HOURS;

  const submitAnyway = () => {
    const basic = state?.basic;
    if (!basic) return;
    const id = `${basic.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()
      .toString()
      .slice(-4)}`;
    addInstructorCourse({
      id,
      title: basic.title,
      shortDescription: basic.shortDescription,
      trainingObjective: basic.trainingObjective,
      learningOutcomes: state?.outcomes ?? [],
      visibility: state?.visibility ?? "Public",
      status: "draft",
      locked: false,
      version: "v1",
      learners: null,
      plannedCompletionDays: days,
    });
    consumeCourseQuota();
    message.success("Draft Course created.");
    navigate("/instructor/courses/draft-created", { state: { courseId: id } });
  };

  return (
    <InstructorPage className="instructor-course-create">
      <PageHeader
        eyebrow="COURSE / REVIEW"
        title="Estimated Duration Warning"
        subtitle="Review planned completion against calculated learning time."
        back
      />
      <SectionCard className="instructor-review-card">
        <div className="instructor-review-banner">
          <strong>Duration exceeds configured capacity</strong>
          <p>This is a warning; Course submission remains available.</p>
        </div>
        <div className="instructor-review-table">
          <div className="instructor-review-row instructor-review-head">
            <span>Planned completion</span>
            <span>Converted capacity</span>
            <span>Estimated learning time</span>
          </div>
          <div className="instructor-review-row">
            <strong>{days} days</strong>
            <span>{convertedCapacity} hours</span>
            <span>{ESTIMATED_LEARNING_HOURS} hours</span>
          </div>
        </div>
        <p className="instructor-review-note">
          Consider increasing planned days or reducing Course content.
        </p>
        <p className="instructor-review-note">Quiz time limits are not included in estimated duration.</p>
        <div className="instructor-form-actions">
          <InstructorButton onClick={() => navigate(-1)}>Return to edit</InstructorButton>
          <InstructorButton type="primary" onClick={submitAnyway}>
            Submit anyway
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default CourseCreateReview;
