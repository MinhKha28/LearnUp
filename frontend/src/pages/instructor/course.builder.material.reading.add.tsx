import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addBuilderResource,
  findBuilderLesson,
  findCourseStructure,
  findInstructorCourse,
  slugify,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.create.scss";
import "./course.builder.scss";

const CourseBuilderReadingAdd = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const found = structure ? findBuilderLesson(structure, lessonId) : undefined;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [requirement, setRequirement] = useState<"Required" | "Optional">("Required");

  if (!course || !found) return null;

  const { lesson } = found;
  const base = `/instructor/courses/${course.id}/builder/lessons/${lesson.id}`;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      message.warning("Enter a title and Reading content.");
      return;
    }
    addBuilderResource(structure!, lesson.id, {
      id: slugify(title),
      title: title.trim(),
      type: "reading",
      required: requirement === "Required",
      sizeLabel: `${wordCount} words`,
    });
    message.success("Reading saved.");
    navigate(`${base}/materials`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Add Reading</span>
      <div className="builder-hero">
        <h1>Add Reading</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label">Reading title</label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <label className="instructor-form-label instructor-form-label-spaced">
            Reading content or file
          </label>
          <Input.TextArea
            className="builder-textarea"
            placeholder="Enter content or upload a Reading document..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <p className="instructor-form-help">
            Word count {wordCount > 0 ? wordCount : "[Calculated after upload]"}
          </p>
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
            <InstructorButton onClick={() => navigate(`${base}/materials`)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save Reading
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Course duration">
            Reading word count contributes to estimated learning time.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderReadingAdd;
