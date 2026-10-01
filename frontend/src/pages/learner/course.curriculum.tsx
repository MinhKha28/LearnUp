import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { courseDetails, findLesson } from "@/components/learner/learner.data";
import {
  LearnerButton,
  PageHeader,
  ProgressLine,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import "./course.curriculum.scss";

const CourseCurriculum = () => {
  const { enrollmentId: courseId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const [tab, setTab] = useState<"video" | "reading">("video");

  const activeLesson = useMemo(
    () => (course ? findLesson(course, course.activeLessonId) : undefined),
    [course],
  );

  if (!course) {
    return null;
  }

  const videoResource = activeLesson?.lesson.resources.find((resource) => resource.type === "video");
  const readingResource = activeLesson?.lesson.resources.find(
    (resource) => resource.type === "reading",
  );
  const activeResource = tab === "video" ? videoResource : readingResource;
  const lessonShortTitle = activeLesson?.lesson.title.split("· ")[1] ?? activeLesson?.lesson.title;
  const moduleIndex = activeLesson
    ? course.modules.findIndex((module) => module.id === activeLesson.module.id) + 1
    : 1;
  const lessonIndex = activeLesson
    ? activeLesson.module.lessons.findIndex((lesson) => lesson.id === activeLesson.lesson.id) + 1
    : 1;

  return (
    <>
      <PageHeader
        eyebrow="MY COURSES / COURSE"
        title={`Lesson: ${lessonShortTitle}`}
        subtitle={`Module ${moduleIndex} / Lesson ${lessonIndex} • ${
          course.audience === "required" ? "Required" : "Optional"
        } • Course ${course.version}`}
      />
      {course.overdue && (
        <WarningPanel title="Required training overdue">
          You can still continue and complete this Course.
        </WarningPanel>
      )}
      <div className="course-learning-main">
          <div className="course-learning-content course-curriculum-preview">
            <div className="course-curriculum-tabs">
              {videoResource && (
                <button
                  type="button"
                  className={tab === "video" ? "active" : ""}
                  onClick={() => setTab("video")}
                >
                  Video
                </button>
              )}
              {readingResource && (
                <button
                  type="button"
                  className={tab === "reading" ? "active" : ""}
                  onClick={() => setTab("reading")}
                >
                  Reading
                </button>
              )}
            </div>
            {activeResource ? (
              <>
                <h2>{activeResource.title.replace(" video", "").replace(" reading", "")}</h2>
                <p className="course-curriculum-meta">
                  {tab === "video" ? "Required Video" : "Required Reading"} • Progress recorded
                  automatically
                </p>
                {tab === "video" ? (
                  <div className="course-curriculum-video">
                    <span className="course-curriculum-play">▶</span>
                    <div className="course-curriculum-video-track">
                      <span style={{ width: "35%" }} />
                    </div>
                  </div>
                ) : (
                  <div className="course-curriculum-reading">
                    <p>Review the guidance and examples provided in this resource.</p>
                    <p>Follow the procedures defined by your Organization.</p>
                  </div>
                )}
                <p className="course-curriculum-caption">
                  {tab === "video"
                    ? "Watch until the configured completion threshold is met."
                    : "Mark this Reading complete after you finish it."}
                </p>
              </>
            ) : (
              <p>No resources available for this Lesson.</p>
            )}
            <div className="course-curriculum-actions">
              <LearnerButton
                onClick={() =>
                  navigate(`/learner/courses/${course.id}/lessons/${activeLesson?.lesson.id}`)
                }
              >
                Next resource
              </LearnerButton>
            </div>
          </div>
          <div className="course-learning-side">
            <div className="course-curriculum-panel">
              <h3>This Lesson</h3>
              <span>Required resources</span>
              <div className="course-curriculum-pills">
                {activeLesson?.lesson.resources
                  .filter((resource) => resource.required)
                  .map((resource) => (
                    <StatusTag
                      key={resource.id}
                      tone={
                        resource.status === "complete"
                          ? "success"
                          : resource.status === "in-progress"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {resource.type === "video" ? "Video" : "Reading"}{" "}
                      {resource.status === "complete"
                        ? "complete"
                        : resource.status === "in-progress"
                          ? "in progress"
                          : "pending"}
                    </StatusTag>
                  ))}
              </div>
              <hr />
              <h4>Course progress</h4>
              <ProgressLine value={course.progress} tone="amber" />
              <span className="course-curriculum-progress-label">{course.progress}% complete</span>
            </div>
          </div>
        </div>
    </>
  );
};

export default CourseCurriculum;
