import { InputNumber, message } from "antd";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  addInstructorCourse,
  consumeCourseQuota,
  type CourseVisibility,
} from "@/components/instructor/instructor.data";
import type { IBasicDraft } from "./course.create.basic";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";
import "./course.create.scss";

const ESTIMATED_LEARNING_HOURS = 12;
const CONFIGURED_DAILY_HOURS = 8;

interface ILocationState {
  basic?: IBasicDraft;
  outcomes?: string[];
  visibility?: CourseVisibility;
  plannedCompletionDays?: number;
}

const CourseCreateSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ILocationState | null;

  if (!state?.basic || !state?.outcomes) {
    navigate("/instructor/courses/create", { replace: true });
  }

  const [visibility, setVisibility] = useState<CourseVisibility>(state?.visibility ?? "Public");
  const [plannedDays, setPlannedDays] = useState<number | null>(
    state?.plannedCompletionDays ?? null,
  );

  const createDraft = () => {
    const basic = state?.basic;
    const outcomes = state?.outcomes ?? [];
    if (!basic) return;
    const id = `${basic.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()
      .toString()
      .slice(-4)}`;
    addInstructorCourse({
      id,
      title: basic.title,
      shortDescription: basic.shortDescription,
      trainingObjective: basic.trainingObjective,
      learningOutcomes: outcomes,
      visibility,
      status: "draft",
      locked: false,
      version: "v1",
      learners: null,
      plannedCompletionDays: plannedDays,
    });
    consumeCourseQuota();
    message.success("Draft Course created.");
    navigate("/instructor/courses/draft-created", { state: { courseId: id } });
  };

  const handleCreateDraft = () => {
    if (!plannedDays || plannedDays <= 0) {
      message.warning("Enter the planned completion days.");
      return;
    }
    const convertedCapacityHours = plannedDays * CONFIGURED_DAILY_HOURS;
    if (convertedCapacityHours < ESTIMATED_LEARNING_HOURS) {
      navigate("/instructor/courses/create/review", {
        state: {
          basic: state?.basic,
          outcomes: state?.outcomes,
          visibility,
          plannedCompletionDays: plannedDays,
        },
      });
      return;
    }
    createDraft();
  };

  return (
    <InstructorPage className="instructor-course-create">
      <PageHeader
        eyebrow="CREATE COURSE / SETTINGS"
        title="Course Settings"
        subtitle="Choose Course visibility and planned completion days."
        back
      />
      <div className="instructor-course-create-grid">
        <SectionCard className="instructor-course-create-main">
          <label className="instructor-form-label">Course type</label>
          <div className="instructor-pill-toggle">
            <button
              type="button"
              className={visibility === "Public" ? "instructor-pill-active" : ""}
              onClick={() => setVisibility("Public")}
            >
              Public
            </button>
            <button
              type="button"
              className={visibility === "Private" ? "instructor-pill-active" : ""}
              onClick={() => setVisibility("Private")}
            >
              Private
            </button>
          </div>
          <p className="instructor-form-help">
            Public only controls visibility in the Learner Catalog.
          </p>
          <p className="instructor-form-help">Required assignment is managed by the Organizer.</p>

          <label className="instructor-form-label instructor-form-label-spaced">
            Planned completion days
          </label>
          <InputNumber
            className="instructor-days-input"
            placeholder="[Days]"
            min={1}
            value={plannedDays ?? undefined}
            onChange={(value) => setPlannedDays(typeof value === "number" ? value : null)}
          />

          <div className="instructor-settings-info">
            <InfoPanel title="Estimated duration">
              Calculated from Video, Reading word count and Assignment effort.
            </InfoPanel>
          </div>

          <div className="instructor-form-actions">
            <InstructorButton onClick={() => navigate(-1)}>Back</InstructorButton>
            <InstructorButton type="primary" onClick={handleCreateDraft}>
              Create Draft
            </InstructorButton>
          </div>
        </SectionCard>
        <SectionCard title="Deadline rule" className="instructor-course-create-side">
          <p>Planned days become a deadline only when an Organizer creates a Required Enrollment.</p>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default CourseCreateSettings;
