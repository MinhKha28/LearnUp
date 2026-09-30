import { useNavigate, useParams } from "react-router-dom";
import { courseDetails, findLesson } from "@/components/learner/learner.data";
import { InfoPanel, LearnerButton, LearnerPage, PageHeader } from "@/components/learner/learner.ui";
import "./lesson.detail.scss";

const statusLabel: Record<string, string> = {
  complete: "Complete",
  "in-progress": "In progress",
  "not-started": "Not started",
};

const LessonDetail = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const found = course ? findLesson(course, lessonId) : undefined;

  if (!course || !found) {
    return (
      <LearnerPage className="lesson-detail">
        <PageHeader eyebrow="COURSE / MODULE / LESSON" title="Lesson not found" subtitle="" back />
        <LearnerButton onClick={() => navigate(`/learner/courses/${courseId ?? ""}`)}>
          Back to Course
        </LearnerButton>
      </LearnerPage>
    );
  }

  const { module, lesson } = found;
  const moduleIndex = course.modules.findIndex((item) => item.id === module.id) + 1;
  const lessonIndex = module.lessons.findIndex((item) => item.id === lesson.id) + 1;
  const requiredResources = lesson.resources.filter((resource) => resource.required);
  const completeCount = requiredResources.filter((resource) => resource.status === "complete").length;
  const nextResource =
    lesson.resources.find((resource) => resource.status !== "complete") ?? lesson.resources[0];

  return (
    <>
      <PageHeader
        eyebrow="COURSE / MODULE / LESSON"
        title={`Lesson: ${lesson.title.split("· ")[1] ?? lesson.title}`}
        subtitle={`Module ${moduleIndex} / Lesson ${lessonIndex} • ${
          course.audience === "required" ? "Required" : "Optional"
        }`}
      />
      <div className="course-learning-main">
          <div className="course-learning-content lesson-detail-card">
            <h3>Lesson content</h3>
            <p>
              Review the required resources below. The Lesson completes when every required Video
              and Reading is complete.
            </p>
            <table className="lesson-detail-table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Type</th>
                  <th>Requirement</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lesson.resources.map((resource) => (
                  <tr
                    key={resource.id}
                    onClick={() =>
                      navigate(
                        `/learner/courses/${course.id}/lessons/${lesson.id}/resources/${resource.id}`,
                      )
                    }
                  >
                    <td>
                      <strong>{resource.title}</strong>
                    </td>
                    <td>{resource.type === "video" ? "Video" : "Reading"}</td>
                    <td>{resource.required ? "Required" : "Optional"}</td>
                    <td>{statusLabel[resource.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="lesson-detail-actions">
              <LearnerButton
                type="primary"
                onClick={() =>
                  navigate(
                    `/learner/courses/${course.id}/lessons/${lesson.id}/resources/${nextResource.id}`,
                  )
                }
              >
                Open next resource
              </LearnerButton>
            </div>
          </div>
          <div className="course-learning-side">
            <div className="lesson-detail-panel">
              <h3>Lesson progress</h3>
              <span>Required resources</span>
              <strong>
                {completeCount} of {requiredResources.length} complete
              </strong>
              <div className="lesson-detail-progress-track">
                <span
                  style={{
                    width: `${
                      requiredResources.length
                        ? (completeCount / requiredResources.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <InfoPanel title="Completion">Optional resources do not block completion.</InfoPanel>
          </div>
        </div>
    </>
  );
};

export default LessonDetail;
