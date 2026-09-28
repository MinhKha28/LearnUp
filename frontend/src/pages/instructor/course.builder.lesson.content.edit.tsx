import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderLesson,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderLessonContentEdit = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const found = structure ? findBuilderLesson(structure, lessonId) : undefined;
  const [content, setContent] = useState(found?.lesson.introText ?? "");

  if (!course || !found) return null;

  const { lesson } = found;
  const base = `/instructor/courses/${course.id}/builder`;

  if (lesson.completedByLearner) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Lesson Content Locked</span>
        <div className="builder-hero">
          <h1>Lesson Content Locked</h1>
        </div>
        <div className="builder-banner">
          <strong>Lesson content cannot be changed</strong>
          <p>At least one Learner has completed this Lesson.</p>
        </div>
        <div className="builder-update-card">
          <h2>Lesson content</h2>
          <p className="builder-lesson-intro">{lesson.introText}</p>
          <p className="builder-lesson-intro">Required materials remain visible for review.</p>
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/lessons/${lesson.id}`)}>Back</InstructorButton>
          </div>
        </div>
      </InstructorPage>
    );
  }

  const handleSave = () => {
    lesson.introText = content.trim();
    message.success("Lesson content saved.");
    navigate(`${base}/lessons/${lesson.id}`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Edit Lesson Content</span>
      <div className="builder-hero">
        <h1>Edit Lesson Content</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Lesson introduction</h2>
          <Input.TextArea
            className="builder-textarea"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/lessons/${lesson.id}`)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save content
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Edit rule">Allowed until a Learner completes this Lesson.</InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderLessonContentEdit;
