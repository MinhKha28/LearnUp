import { useNavigate, useParams } from "react-router-dom";
import { findInstructorCourse } from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";
import "./course.builder.new.version.scss";

const CourseBuilderNewVersion = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  if (!course) return null;

  return (
    <InstructorPage className="builder-page">
      <div className="new-version-header">
        <div>
          <span className="builder-crumb">Course Builder / New Version Draft</span>
          <div className="builder-hero">
            <h1>New Version Draft</h1>
          </div>
        </div>
        <span className="new-version-pill">{course.version} Draft</span>
      </div>
      <div className="new-version-grid">
        <div className="new-version-card">
          <h2>
            {course.title} · {course.version}
          </h2>
          <p>Curriculum copied from the Locked version.</p>
          <p>Edit structural elements in this Draft, then submit it for approval.</p>
          <div className="instructor-info-panel">
            <strong>File references reused</strong>
            <p>Learning files are referenced from {course.publishedVersion} without duplicating storage.</p>
          </div>
          <div className="new-version-actions">
            <InstructorButton
              type="primary"
              onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
            >
              Review new version
            </InstructorButton>
          </div>
        </div>
        <div className="new-version-side">
          <span className="new-version-side-eyebrow">Properties</span>
          <div className="instructor-info-panel">
            <strong>Previous version</strong>
            <p>
              {course.publishedVersion} remains Published until this version is approved.
            </p>
          </div>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderNewVersion;
