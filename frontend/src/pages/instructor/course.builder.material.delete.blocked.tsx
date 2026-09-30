import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderResource,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderMaterialDeleteBlocked = () => {
  const { courseId, lessonId, materialId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const found = structure ? findBuilderResource(structure, lessonId, materialId) : undefined;

  if (!course || !found) return null;

  const { resource } = found;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Material Removal Unavailable</span>
      <div className="builder-hero">
        <h1>Material Removal Unavailable</h1>
      </div>
      <div className="builder-banner">
        <strong>Removal blocked</strong>
        <p>This Course is Locked; deleting learning material can change completion.</p>
      </div>
      <div className="builder-update-card">
        <h2>{resource.title}</h2>
        <p className="builder-lesson-intro">
          {resource.required ? "Required" : "Optional"} • {resource.type === "video" ? "Video" : "Reading"}{" "}
          • {resource.sizeLabel}
        </p>
        <p className="builder-lesson-intro">To change Course structure, create a new version.</p>
        <div className="builder-actions">
          <InstructorButton onClick={() => navigate(-1)}>Back</InstructorButton>
          <InstructorButton
            type="primary"
            onClick={() =>
              navigate(`/instructor/courses/${course.id}/edit`, { state: { newVersion: true } })
            }
          >
            Create new version
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderMaterialDeleteBlocked;
