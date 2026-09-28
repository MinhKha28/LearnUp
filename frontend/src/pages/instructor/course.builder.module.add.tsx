import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addBuilderModule,
  findCourseStructure,
  findInstructorCourse,
  slugify,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, InfoPanel } from "@/components/instructor/instructor.ui";
import "./course.create.scss";
import "./course.builder.scss";

const CourseBuilderModuleAdd = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const [title, setTitle] = useState("");
  const [requirement, setRequirement] = useState<"Required" | "Optional">("Required");

  if (!course || !structure) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  const handleSave = () => {
    if (!title.trim()) {
      message.warning("Enter a Module title.");
      return;
    }
    addBuilderModule(structure, {
      id: slugify(title),
      title: title.trim(),
      required: requirement === "Required",
    });
    message.success("Module saved.");
    navigate(base);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Add Module</span>
      <div className="builder-hero">
        <h1>Add Module</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label">Module title</label>
          <Input
            placeholder="Module 3 · Advanced practice"
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
          <p className="instructor-form-help">Only Required components contribute to Certificate conditions.</p>
          <p className="instructor-form-help">Add Lessons inside this Module after saving.</p>
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(-1)}>Cancel</InstructorButton>
            <InstructorButton type="primary" disabled={course.locked} onClick={handleSave}>
              Save Module
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Before first Enrollment">
            Adding a Module is blocked once the Course is Locked.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderModuleAdd;
