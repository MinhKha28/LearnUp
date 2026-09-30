import { Button } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  assignmentStatusLabel,
  courseDetails,
  findCourseEvaluation,
} from "@/components/learner/learner.data";
import {
  InfoPanel,
  LearnerButton,
  PageHeader,
  ProgressLine,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import "./course.progress.scss";

interface IRemainingRow {
  component: string;
  required: boolean;
  status: string;
  nextAction: string;
  to?: string;
}

const CourseProgress = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const evaluation = course ? findCourseEvaluation(course.id) : undefined;

  if (!course) {
    return null;
  }

  const rows: IRemainingRow[] = [];
  course.modules.forEach((module) => {
    let moduleHasIncomplete = false;
    module.lessons.forEach((lesson) => {
      lesson.resources
        .filter((resource) => resource.required && resource.status !== "complete")
        .forEach((resource) => {
          moduleHasIncomplete = true;
          rows.push({
            component: resource.title,
            required: true,
            status: resource.status === "in-progress" ? "In progress" : "Not complete",
            nextAction: resource.type === "video" ? "Continue watching" : "Mark after reading",
          });
        });
    });
    if (module.quizTitle && module.quizId && moduleHasIncomplete) {
      const quiz = course.quizzes[module.quizId];
      rows.push({
        component: module.quizTitle,
        required: true,
        status: quiz && quiz.attempts.length > 0 ? "In progress" : "Not started",
        nextAction: "Take Quiz",
        to: `/learner/courses/${course.id}/quizzes/${module.quizId}`,
      });
    }
  });
  course.assessments.forEach((assessment) => {
    rows.push({
      component: assessment.title,
      required: true,
      status: assignmentStatusLabel(assessment.status),
      nextAction: assessment.status === "graded" ? "View result" : "View submission",
      to: `/learner/courses/${course.id}/assignments/${assessment.id}`,
    });
  });

  return (
    <>
      <PageHeader
        eyebrow="MY COURSES / PROGRESS"
        title="Course Progress"
        subtitle="Track required components and what remains for your Certificate."
      />
      {course.overdue && (
        <WarningPanel title="Required Course overdue">
          The due date has passed; you can still complete this Course.
        </WarningPanel>
      )}
      {course.progress === 100 && evaluation && (
        <div className="course-progress-evaluation-banner">
          <InfoPanel title="Course Evaluation available">
            Share anonymous feedback now that this Course is complete.
          </InfoPanel>
          <LearnerButton onClick={() => navigate(`/learner/courses/${course.id}/evaluation`)}>
            Share your feedback
          </LearnerButton>
        </div>
      )}
      <div className="course-learning-content">
          <div className="course-progress-summary">
            <div className="course-progress-summary-head">
              <h3>{course.title}</h3>
              <StatusTag tone={course.audience === "required" ? "warning" : "info"}>
                {course.audience === "required" ? "Required" : "Optional"}
              </StatusTag>
            </div>
            <ProgressLine value={course.progress} tone="amber" />
            <span>
              Completion conditions: {course.completionConditionsMet} of{" "}
              {course.completionConditionsTotal} met
            </span>
          </div>
          <div className="course-progress-remains">
            <h3>What remains</h3>
            <table className="course-progress-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Required</th>
                  <th>Status</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.component}>
                    <td>
                      <strong>{row.component}</strong>
                    </td>
                    <td>{row.required ? "Yes" : "No"}</td>
                    <td>{row.status}</td>
                    <td>
                      {row.to ? (
                        <Button type="link" className="course-progress-action" onClick={() => navigate(row.to!)}>
                          {row.nextAction}
                        </Button>
                      ) : (
                        row.nextAction
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4}>All required components are complete.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
    </>
  );
};

export default CourseProgress;
