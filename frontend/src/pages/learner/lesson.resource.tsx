import { useState } from "react";
import { FlagOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { courseDetails, findResource } from "@/components/learner/learner.data";
import { InfoPanel, LearnerButton, LearnerPage, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import "./lesson.resource.scss";

const statusTone: Record<string, "success" | "warning" | "neutral"> = {
  complete: "success",
  "in-progress": "warning",
  "not-started": "neutral",
};

const statusLabel: Record<string, string> = {
  complete: "Complete",
  "in-progress": "In progress",
  "not-started": "Not started",
};

const LessonResource = () => {
  const { enrollmentId: courseId, lessonId, resourceId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const found = course ? findResource(course, lessonId, resourceId) : undefined;
  const [completed, setCompleted] = useState(false);

  if (!course || !found) {
    return (
      <LearnerPage className="lesson-resource">
        <PageHeader eyebrow="COURSE / LESSON" title="Resource not found" subtitle="" back />
        <LearnerButton onClick={() => navigate(`/learner/courses/${courseId ?? ""}`)}>
          Back to Course
        </LearnerButton>
      </LearnerPage>
    );
  }

  const { module, lesson, resource } = found;
  const isComplete = completed || resource.status === "complete";
  const otherResources = lesson.resources.filter(
    (item) => item.id !== resource.id && item.required,
  );
  const nextResource = lesson.resources[lesson.resources.findIndex((item) => item.id === resource.id) + 1];
  const moduleIndex = course.modules.findIndex((item) => item.id === module.id) + 1;
  const lessonIndex = module.lessons.findIndex((item) => item.id === lesson.id) + 1;

  return (
    <>
      <PageHeader
        eyebrow={`COURSE / LESSON / ${resource.type === "video" ? "VIDEO" : "READING"}`}
        title={resource.title}
        subtitle={
          resource.type === "video"
            ? `${course.title} / Module ${moduleIndex} / Lesson ${lessonIndex}`
            : `Reading / ${course.title} / Module ${moduleIndex}`
        }
      />
      <div className="course-learning-main">
          <div className="course-learning-content lesson-resource-card">
            {resource.type === "video" ? (
              <>
                <div className="lesson-resource-video">
                  <span className="lesson-resource-play">▶</span>
                  <div className="lesson-resource-track">
                    <span style={{ width: isComplete ? "100%" : "35%" }} />
                  </div>
                </div>
                <p className="lesson-resource-caption">Video progress is saved as you watch.</p>
                <InfoPanel title="Automatic completion">
                  The resource completes after the configured viewing threshold.
                </InfoPanel>
              </>
            ) : (
              <>
                <h3>{resource.title}</h3>
                <p className="lesson-resource-meta">
                  Reading resource • {resource.required ? "Required" : "Optional"}
                </p>
                <hr />
                <p>Review the guidance and examples provided in this resource.</p>
                <p>Follow the procedures defined by your Organization.</p>
                <p>Use the course materials as the reference for your learning.</p>
                <hr />
                <div className="lesson-resource-mark-row">
                  <p>Mark this Reading complete after you finish it.</p>
                  <LearnerButton
                    type="primary"
                    disabled={isComplete}
                    onClick={() => setCompleted(true)}
                  >
                    {isComplete ? "Marked complete" : "Mark as complete"}
                  </LearnerButton>
                </div>
              </>
            )}
          </div>
          <div className="course-learning-side">
            <div className="lesson-resource-panel">
              {resource.type === "video" ? (
                <>
                  <h3>This Lesson</h3>
                  <p>{resource.title}</p>
                  {otherResources.map((item) => (
                    <p key={item.id}>{item.title}</p>
                  ))}
                  <StatusTag tone={isComplete ? "success" : statusTone[resource.status]}>
                    {isComplete ? "Complete" : statusLabel[resource.status]}
                  </StatusTag>
                </>
              ) : (
                <>
                  <h3>Lesson resources</h3>
                  {lesson.resources
                    .filter((item) => item.required)
                    .map((item) => (
                    <StatusTag
                      key={item.id}
                      tone={
                        item.id === resource.id && isComplete
                          ? "success"
                          : statusTone[item.status]
                      }
                    >
                      {item.type === "video" ? "Video" : "Reading"}{" "}
                      {item.id === resource.id && isComplete
                        ? "complete"
                        : item.status === "complete"
                          ? "complete"
                          : item.status === "in-progress"
                            ? "in progress"
                            : "pending"}
                    </StatusTag>
                  ))}
                </>
              )}
              {nextResource && (
                <LearnerButton
                  className="lesson-resource-next"
                  onClick={() =>
                    navigate(
                      `/learner/courses/${course.id}/lessons/${lesson.id}/resources/${nextResource.id}`,
                    )
                  }
                >
                  Next resource
                </LearnerButton>
              )}
              <LearnerButton
                className="lesson-resource-report"
                icon={<FlagOutlined />}
                onClick={() =>
                  navigate(
                    `/learner/courses/${course.id}/lessons/${lesson.id}/resources/${resource.id}/report`,
                  )
                }
              >
                Report content
              </LearnerButton>
            </div>
          </div>
        </div>
    </>
  );
};

export default LessonResource;
