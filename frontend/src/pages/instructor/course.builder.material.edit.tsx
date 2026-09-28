import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderResource,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.create.scss";
import "./course.builder.scss";

const CourseBuilderMaterialEdit = () => {
  const { courseId, lessonId, materialId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const found = structure ? findBuilderResource(structure, lessonId, materialId) : undefined;
  const [title, setTitle] = useState(found?.resource.title ?? "");

  if (!course || !found) return null;

  const { lesson, resource } = found;
  const base = `/instructor/courses/${course.id}/builder/lessons/${lesson.id}`;

  const handleSave = () => {
    if (!title.trim()) {
      message.warning("Enter a Material title.");
      return;
    }
    resource.title = title.trim();
    message.success("Learning material saved.");
    navigate(`${base}/materials`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Edit Learning Material</span>
      <div className="builder-hero">
        <h1>Edit Learning Material</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label">Material title</label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <label className="instructor-form-label instructor-form-label-spaced">
            Replace a technically broken file
          </label>
          <label className="builder-upload-box">
            <strong className="builder-upload-link">Select replacement file</strong>
            <input type="file" onChange={() => message.info("Replacement file staged for saving.")} />
          </label>
          {course.locked && (
            <div className="builder-banner" style={{ marginTop: 20 }}>
              <strong>Locked requirement</strong>
              <p>Required/Optional cannot change after the Course is Locked.</p>
            </div>
          )}
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/materials`)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save changes
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title={course.locked ? "Permitted edits" : "Editable"}>
            {course.locked
              ? "Title and technical replacement remain available."
              : "Title, file and requirement remain editable before Locked."}
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderMaterialEdit;
