import { Input, InputNumber, Select, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addBuilderQuiz,
  findCourseStructure,
  findInstructorCourse,
  slugify,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.create.scss";
import "./course.builder.scss";

const CourseBuilderQuizCreate = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);

  const attachOptions = structure
    ? [
        ...structure.modules.map((module) => ({ value: `module:${module.id}`, label: module.title })),
        { value: "course", label: `${course?.title ?? "Course"} (Course level)` },
      ]
    : [];

  const [title, setTitle] = useState("");
  const [attachTo, setAttachTo] = useState<string | undefined>(attachOptions[0]?.value);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [passingScore, setPassingScore] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [lockHours, setLockHours] = useState<number | null>(null);
  const [requirement, setRequirement] = useState<"Required" | "Optional">("Required");

  if (!course || !structure) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  const handleCreate = () => {
    if (!title.trim()) {
      message.warning("Enter a Quiz title.");
      return;
    }
    if (!attachTo) {
      message.warning("Choose where to attach this Quiz.");
      return;
    }
    const id = slugify(title);
    addBuilderQuiz(structure, {
      id,
      title: title.trim(),
      location: attachTo === "course" ? "course" : "module",
      moduleId: attachTo === "course" ? undefined : attachTo.replace("module:", ""),
      required: requirement === "Required",
      timeLimitMinutes: timeLimit ?? undefined,
      passingScore: passingScore ?? undefined,
      attempts: attempts ?? undefined,
      lockHours: lockHours ?? undefined,
      locked: false,
      questions: [],
    });
    message.success("Quiz created.");
    navigate(`${base}/quizzes/${id}`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Create Quiz</span>
      <div className="builder-hero">
        <h1>Create Quiz</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label">Quiz title</label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Module 2 Quiz" />

          <label className="instructor-form-label instructor-form-label-spaced">Attach to</label>
          <Select
            style={{ width: "100%" }}
            value={attachTo}
            onChange={setAttachTo}
            options={attachOptions}
          />

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Time limit</label>
              <InputNumber
                className="instructor-days-input"
                style={{ width: "100%" }}
                placeholder="[Configured minutes]"
                min={1}
                value={timeLimit ?? undefined}
                onChange={(value) => setTimeLimit(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Minimum passing score</label>
              <InputNumber
                className="instructor-days-input"
                style={{ width: "100%" }}
                placeholder="[Configured score]"
                min={0}
                max={100}
                value={passingScore ?? undefined}
                onChange={(value) => setPassingScore(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">
                Consecutive attempts (n)
              </label>
              <InputNumber
                className="instructor-days-input"
                style={{ width: "100%" }}
                placeholder="[Configured count]"
                min={1}
                value={attempts ?? undefined}
                onChange={(value) => setAttempts(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">
                Temporary lock (m hours)
              </label>
              <InputNumber
                className="instructor-days-input"
                style={{ width: "100%" }}
                placeholder="[Configured hours]"
                min={0}
                value={lockHours ?? undefined}
                onChange={(value) => setLockHours(typeof value === "number" ? value : null)}
              />
            </div>
          </div>

          <div className="instructor-pill-toggle">
            <button
              type="button"
              className={requirement === "Required" ? "instructor-pill-active" : ""}
              onClick={() => setRequirement("Required")}
            >
              Required
            </button>
            <button
              type="button"
              className={requirement === "Optional" ? "instructor-pill-active" : ""}
              onClick={() => setRequirement("Optional")}
            >
              Optional
            </button>
          </div>

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(base)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={handleCreate}>
              Create Quiz
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Certificate requirement">A Quiz can be Optional for practice.</InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizCreate;
