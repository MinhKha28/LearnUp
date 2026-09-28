import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderLesson,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderLessonDetail = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const found = structure ? findBuilderLesson(structure, lessonId) : undefined;

  if (!course || !found) return null;

  const { lesson } = found;
  const base = `/instructor/courses/${course.id}/builder`;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Lesson Detail</span>
      <div className="builder-hero">
        <h1>Lesson Detail</h1>
      </div>
      <div className="builder-update-card">
        <h2>Lesson content</h2>
        <p className="builder-lesson-intro">{lesson.introText || "No Lesson introduction written yet."}</p>
        <p className="builder-lesson-intro">Learners complete its Required resources to complete the Lesson.</p>
        <hr className="builder-divider" />
        <h2>Learning materials</h2>
        <div className="builder-table">
          <div className="builder-table-row builder-table-head">
            <span>Resource</span>
            <span>Type</span>
            <span>Required</span>
            <span>Storage</span>
          </div>
          {lesson.resources.map((resource) => (
            <div className="builder-table-row" key={resource.id}>
              <strong>{resource.title}</strong>
              <span>{resource.type === "video" ? "Video" : "Reading"}</span>
              <span>{resource.required ? "Yes" : "No"}</span>
              <span>{resource.sizeLabel}</span>
            </div>
          ))}
          {lesson.resources.length === 0 && (
            <div className="builder-table-row">
              <span>No learning materials yet.</span>
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
        <div className="builder-actions builder-actions-split">
          <InstructorButton onClick={() => navigate(`${base}/lessons/${lesson.id}/content/edit`)}>
            Edit content
          </InstructorButton>
          <InstructorButton
            type="primary"
            onClick={() => navigate(`${base}/lessons/${lesson.id}/materials`)}
          >
            Add resource
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderLessonDetail;
