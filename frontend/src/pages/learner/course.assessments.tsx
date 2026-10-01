import { useNavigate, useParams } from "react-router-dom";
import {
  assignmentStatusLabel,
  courseDetails,
  quizAttemptsRemaining,
} from "@/components/learner/learner.data";
import { InfoPanel, LearnerButton, PageHeader } from "@/components/learner/learner.ui";
import "./course.assessments.scss";

const quizAction = (locked: boolean, attempted: boolean) => {
  if (locked) return "Locked";
  if (attempted) return "View history";
  return "Start Quiz";
};

const assignmentAction = (status: string) => {
  switch (status) {
    case "not-submitted":
      return "Start Assignment";
    case "submitted":
      return "View submission";
    case "returned":
      return "Resubmit";
    case "graded":
      return "View result";
    case "locked":
      return "Locked";
    default:
      return "View";
  }
};

const CourseAssessments = () => {
  const { enrollmentId: courseId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;

  if (!course) {
    return null;
  }

  const quizRows = course.modules
    .filter((module) => module.quizId)
    .map((module) => {
      const quiz = course.quizzes[module.quizId as string];
      return { module, quiz };
    })
    .filter((row) => row.quiz);

  return (
    <>
      <PageHeader
        eyebrow="COURSE / ASSESSMENTS"
        title="Assessments"
        subtitle="Required Quizzes and Assignments for this Course."
      />
      <InfoPanel title="How results are recorded">
        Quiz uses your highest attempt; Assignment uses your latest submission.
      </InfoPanel>
      <div className="course-learning-content">
          <div className="course-assessments-table-card">
            <table className="course-assessments-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Requirement</th>
                  <th>Minimum score</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {quizRows.map(({ quiz }) => {
                  if (!quiz) return null;
                  const attempted = quiz.attempts.length > 0;
                  return (
                    <tr key={quiz.id}>
                      <td>
                        <strong>{quiz.title}</strong>
                      </td>
                      <td>{quiz.requirement}</td>
                      <td>{quiz.passingScoreLabel}</td>
                      <td>
                        {quiz.locked
                          ? "Locked"
                          : attempted
                            ? `Completed • ${quizAttemptsRemaining(quiz)} attempts left`
                            : "Not started"}
                      </td>
                      <td>
                        <LearnerButton
                          onClick={() =>
                            navigate(
                              quiz.locked || !attempted
                                ? `/learner/courses/${course.id}/quizzes/${quiz.id}`
                                : `/learner/courses/${course.id}/quizzes/${quiz.id}/history`,
                            )
                          }
                        >
                          {quizAction(Boolean(quiz.locked), attempted)}
                        </LearnerButton>
                      </td>
                    </tr>
                  );
                })}
                {course.assessments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <strong>{assignment.title}</strong>
                    </td>
                    <td>{assignment.requirement}</td>
                    <td>{assignment.minScore}%</td>
                    <td>{assignmentStatusLabel(assignment.status)}</td>
                    <td>
                      <LearnerButton
                        onClick={() =>
                          navigate(`/learner/courses/${course.id}/assignments/${assignment.id}`)
                        }
                      >
                        {assignmentAction(assignment.status)}
                      </LearnerButton>
                    </td>
                  </tr>
                ))}
                {quizRows.length === 0 && course.assessments.length === 0 && (
                  <tr>
                    <td colSpan={5}>No Assessments are configured for this Course.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="course-assessments-footnote">
              Attempt counts and unlock times are shown in each Assessment.
            </p>
          </div>
        </div>
    </>
  );
};

export default CourseAssessments;
