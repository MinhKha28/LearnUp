import { useNavigate, useParams } from "react-router-dom";
import { courseDetails } from "@/components/learner/learner.data";
import { InfoPanel, LearnerButton, LearnerPage, PageHeader, StatusTag, WarningPanel } from "@/components/learner/learner.ui";
import "./course.withdraw.scss";

const CourseWithdraw = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;

  if (!course) {
    return (
      <LearnerPage className="course-withdraw">
        <PageHeader eyebrow="LEARNER" title="Course not found" subtitle="" back />
        <LearnerButton onClick={() => navigate("/learner/courses")}>Back to My Courses</LearnerButton>
      </LearnerPage>
    );
  }

  const withAssessment = Boolean(course.assessmentStarted);

  return (
    <LearnerPage className="course-withdraw">
      <PageHeader
        eyebrow="LEARNER"
        title="Withdraw from Optional Course"
        subtitle="Review what happens to your learning record."
        back
      />
      <div className="course-withdraw-backdrop">
        <div className="course-withdraw-card">
          <h3>Confirm withdrawal</h3>
          <StatusTag tone="info">Optional</StatusTag>
          <h4>{course.title}</h4>
          <hr />
          {withAssessment ? (
            <InfoPanel title="Learning record retained">
              Your Enrollment becomes Withdrawn; re-enrolling restores progress.
            </InfoPanel>
          ) : (
            <WarningPanel title="No assessment results yet">
              Withdrawing deletes this Enrollment and its learning data.
            </WarningPanel>
          )}
          <p>
            {withAssessment ? (
              <>
                Your Quiz, submission and review records are preserved.
                <br />
                You can re-enroll in this Course later.
              </>
            ) : (
              <>
                This action can be confirmed while the Course is Optional.
                <br />
                A Required Course cannot be withdrawn by a Learner.
              </>
            )}
          </p>
          <div className="course-withdraw-actions">
            <LearnerButton onClick={() => navigate(-1)}>Keep learning</LearnerButton>
            <LearnerButton
              type="primary"
              onClick={() => navigate(`/learner/courses/${course.id}/withdrawn`)}
            >
              Withdraw Course
            </LearnerButton>
          </div>
        </div>
      </div>
    </LearnerPage>
  );
};

export default CourseWithdraw;
