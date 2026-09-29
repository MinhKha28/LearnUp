import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addBuilderLesson,
  findBuilderModule,
  findCourseStructure,
  findInstructorCourse,
  slugify,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.create.scss";
import "./course.builder.scss";

const CourseBuilderLessonAdd = () => {
  const { courseId, moduleId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const module = structure ? findBuilderModule(structure, moduleId) : undefined;
  const [title, setTitle] = useState("");
  const [requirement, setRequirement] = useState<"Required" | "Optional">("Required");
  const [content, setContent] = useState("");

  if (!course || !structure || !module) {
    return (
      <InstructorPage className="builder-page">
        <p>Select a Module from the Curriculum Tree to add a Lesson.</p>
      </InstructorPage>
    );
  }

  const base = `/instructor/courses/${course.id}/builder`;

  const handleSave = () => {
    if (!title.trim()) {
      message.warning("Enter a Lesson title.");
      return;
    }
    addBuilderLesson(structure, module.id, {
      id: slugify(title),
      title: title.trim(),
      required: requirement === "Required",
      introText: content.trim(),
    });
    message.success("Lesson saved.");
    navigate(base);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Add Lesson</span>
      <div className="builder-hero">
        <h1>Add Lesson</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label">Lesson title</label>
          <Input
            placeholder="Lesson 2 · Applying safety procedures"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label className="instructor-form-label instructor-form-label-spaced">Requirement</label>
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
          <label className="instructor-form-label instructor-form-label-spaced">Lesson content</label>
          <Input.TextArea
            className="builder-textarea"
            placeholder="Write the Lesson introduction..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(-1)}>Cancel</InstructorButton>
            <InstructorButton type="primary" disabled={course.locked} onClick={handleSave}>
              Save Lesson
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Structural rule">
            Adding a Lesson is blocked after the Course is Locked.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderLessonAdd;
