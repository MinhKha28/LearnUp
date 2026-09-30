import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderLesson,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderMaterials = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const found = structure ? findBuilderLesson(structure, lessonId) : undefined;

  if (!course || !found) return null;

  const { lesson } = found;
  const base = `/instructor/courses/${course.id}/builder/lessons/${lesson.id}`;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Learning Materials</span>
      <div className="builder-hero">
        <h1>Learning Materials</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <div className="builder-table">
            <div className="builder-table-row builder-table-head">
              <span>Title</span>
              <span>Type</span>
              <span>Required</span>
              <span>Storage</span>
            </div>
            {lesson.resources.map((resource) => (
              <div className="builder-table-row" key={resource.id}>
                <strong>{resource.title}</strong>
                <span>{resource.type === "video" ? "Video" : "Reading"}</span>
                <span>{resource.required ? "Yes" : "No"}</span>
                <span className="builder-table-actions">
                  {resource.sizeLabel}
                  <button
                    type="button"
                    className="builder-table-link"
                    onClick={() => navigate(`${base}/materials/${resource.id}/edit`)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="builder-table-link builder-table-link-danger"
                    onClick={() =>
                      course.locked
                        ? navigate(`${base}/materials/${resource.id}/delete-blocked`)
                        : navigate(
                            `/instructor/courses/${course.id}/builder/lessons/${lesson.id}/materials/${resource.id}/delete`,
                          )
                    }
                  >
                    Delete
                  </button>
                </span>
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
            <InstructorButton type="primary" onClick={() => navigate(`${base}/materials/video/new`)}>
              + Add Video
            </InstructorButton>
            <InstructorButton onClick={() => navigate(`${base}/materials/reading/new`)}>
              + Add Reading
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Storage">
            Uploads check technical limits and remaining Subscription storage.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderMaterials;
