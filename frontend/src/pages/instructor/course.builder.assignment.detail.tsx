import { message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, fetchAssignmentAPI } from "@/services/assessment.service";
import type { IAssignment } from "@/types/assessment.types";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

/** BR-174: stored in minutes, shown converted to hours once it reaches an hour. */
const formatMinutes = (minutes: number | null) => {
  if (minutes === null) return "-";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

type TParamProps = { label: string; value: string; hint: string; tone?: "on" | "off" };

const Param = ({ label, value, hint, tone }: TParamProps) => (
  <div className={`builder-param-card${tone ? ` builder-param-card-${tone}` : ""}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{hint}</small>
  </div>
);

const CourseBuilderAssignmentDetail = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;

  const [assignment, setAssignment] = useState<IAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAssignmentAPI(assignmentId);
        if (!active) return;
        if (res.data) setAssignment(res.data);
        else message.error(assessmentErrorText(res, "Unable to load the Assignment."));
      } catch {
        if (active) message.error("Unable to reach the Assessment service. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [assignmentId]);


  const base = `/instructor/courses/${course.id}/builder`;
  // Back goes to the screen the user opened this Assignment from (outline, list, ...); direct visits fall back to the list.
  const backPath = (location.state as { from?: string } | null)?.from ?? `${base}/assignments`;

  if (!assignment) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Assignment Detail</span>
        <div className="builder-hero">
          <h1>{loading ? "Loading Assignment..." : "Assignment not found"}</h1>
        </div>
        {!loading && <InstructorButton onClick={() => navigate(backPath)}>Back</InstructorButton>}
      </InstructorPage>
    );
  }

  const { peerReview } = assignment;
  const totalPoints = assignment.rubric.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
  // BR-98: once a submission exists only the estimated effort can change (BR-173, UC19.3).
  const restricted = assignment.locked;
  const editPath = `${base}/assignments/${assignment.id}/edit`;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">
        Course Builder / {restricted ? "Assignment Editing Restricted" : "Assignment Detail"}
      </span>
      <div className="builder-hero">
        <h1>{assignment.title}</h1>
      </div>

      {assignment.disabled && (
        <div className="builder-banner builder-banner-error">
          <strong>Assignment disabled</strong>
          <p>
            This Assignment was disabled after a confirmed violation. It is left out of the Certificate requirements until
            it is re-enabled; scores already recorded are kept.
          </p>
        </div>
      )}

      {/* BR-185: the on/off switch is only available until the Course is Locked, so remind while it still can be set. */}
      {!peerReview.enabled && !assignment.courseLocked && (
        <div className="builder-banner">
          <strong>Peer Review is off</strong>
          <p>
            Learners will be graded directly by you. You can turn Peer Review on until the Course is Locked (when the
            first Learner enrolls); after that it can no longer be switched.
          </p>
        </div>
      )}

      {restricted && (
        <div className="builder-banner">
          <strong>Submission data exists</strong>
          <p>
            Instructions, Rubric, n attempts and m-hour lock cannot be edited. Only the estimated effort can still
            change.
          </p>
        </div>
      )}

      <div className="builder-param-grid">
        <Param label="Passing score" value={`${assignment.passingScore} / 100`} hint="Minimum score to pass" />
        <Param
          label="Estimated effort"
          value={formatMinutes(assignment.expectedDurationMinutes)}
          hint="Counts toward Course duration"
        />
        <Param
          label="Consecutive submissions (n)"
          value={String(assignment.maxConsecutiveAttempts)}
          hint="Attempts before a lock"
        />
        <Param label="Temporary lock (m)" value={`${assignment.lockoutHours} h`} hint="Per Learner, then attempts reset" />
        <Param
          label="Peer Review"
          value={peerReview.enabled ? "On" : "Off"}
          hint={
            peerReview.enabled
              ? `${peerReview.reviewersPerSubmission ?? "?"} reviewers per submission`
              : "Instructor grades directly"
          }
          tone={peerReview.enabled ? "on" : "off"}
        />
        <Param
          label="Rubric"
          value={`${assignment.rubric.length} ${assignment.rubric.length === 1 ? "criterion" : "criteria"}`}
          hint={`${totalPoints} points in total`}
        />
      </div>

      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Instructions</h2>
          <p className="builder-lesson-intro builder-prompt">{assignment.prompt || "No Instructions written yet."}</p>
          {assignment.promptFile && (
            <p className="builder-lesson-intro">Attachment: {assignment.promptFile.fileName}</p>
          )}

          <hr className="builder-divider" />
          <h2>Rubric</h2>
          <div className="builder-rubric-summary">
            {assignment.rubric.map((criterion) => (
              <div className="builder-rubric-line" key={criterion.id}>
                <span>
                  {criterion.position}. {criterion.description}
                </span>
                <strong>{criterion.maxPoints} pts</strong>
              </div>
            ))}
            <div className="builder-rubric-line builder-rubric-total">
              <span>Total</span>
              <strong>{totalPoints} pts</strong>
            </div>
          </div>

          <div className="builder-actions builder-actions-split">
            <InstructorButton onClick={() => navigate(backPath)}>Back</InstructorButton>
            {restricted ? (
              <InstructorButton type="primary" onClick={() => navigate(editPath, { state: location.state })}>
                Edit estimated effort
              </InstructorButton>
            ) : (
              <>
                <InstructorButton danger onClick={() => navigate(`${base}/assignments/${assignment.id}/delete`, { state: location.state })}>
                  Delete Assignment
                </InstructorButton>
                <InstructorButton onClick={() => navigate(editPath, { state: location.state })}>Edit Assignment</InstructorButton>
              </>
            )}
          </div>
        </div>

        <div className="builder-side">
          <div className="builder-side-card">
            <h3>Submission rules</h3>
            <p>
              No separate deadline. After <strong>{assignment.maxConsecutiveAttempts}</strong> consecutive submissions
              the Learner is locked for <strong>{assignment.lockoutHours} h</strong>, then can submit again. The latest
              score is the recorded score.
            </p>
          </div>
          <div className="builder-side-card">
            <h3>Peer Review</h3>
            {peerReview.enabled ? (
              <ul>
                <li>{peerReview.reviewersPerSubmission ?? "?"} reviewers per submission</li>
                <li>{peerReview.cycleDays ?? "?"}-day cycle</li>
                <li>{peerReview.deadlineDays ?? "?"}-day review deadline after the cycle closes</li>
                <li>Score gap threshold: {peerReview.scoreGap ?? "?"}</li>
              </ul>
            ) : (
              <p>
                Disabled for this Assignment.
                {assignment.courseLocked && " It can no longer be turned on because the Course is Locked."}
              </p>
            )}
            <InstructorButton onClick={() => navigate(`${base}/assignments/${assignment.id}/peer-review`, { state: location.state })}>
              Configure Peer Review
            </InstructorButton>
          </div>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentDetail;
