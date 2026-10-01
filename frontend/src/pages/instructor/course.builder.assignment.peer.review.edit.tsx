import { Switch, message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";
import { NumberField } from "@/components/instructor/form.field";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, fetchAssignmentAPI, updatePeerReviewAPI } from "@/services/assessment.service";
import type { IAssignment } from "@/types/assessment.types";
import { PEER_DAYS_RULE, PEER_REVIEWERS_RULE, PEER_SCORE_GAP_RULE, validateNumber } from "@/utils/validation";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

const CourseBuilderAssignmentPeerReviewEdit = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;

  const [assignment, setAssignment] = useState<IAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [reviewers, setReviewers] = useState<number | null>(null);
  const [cycleLength, setCycleLength] = useState<number | null>(null);
  const [reviewDeadline, setReviewDeadline] = useState<number | null>(null);
  const [threshold, setThreshold] = useState<number | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAssignmentAPI(assignmentId);
        if (!active) return;
        const loaded = res.data;
        if (!loaded) {
          message.error(assessmentErrorText(res, "Unable to load the Assignment."));
          return;
        }
        setAssignment(loaded);
        setEnabled(loaded.peerReview.enabled);
        setReviewers(loaded.peerReview.reviewersPerSubmission);
        setCycleLength(loaded.peerReview.cycleDays);
        setReviewDeadline(loaded.peerReview.deadlineDays);
        setThreshold(loaded.peerReview.scoreGap);
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

  if (!assignment) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Peer Review Settings</span>
        <div className="builder-hero">
          <h1>{loading ? "Loading Peer Review settings..." : "Assignment not found"}</h1>
        </div>
        {!loading && <InstructorButton onClick={() => navigate(`${base}/assignments`)}>Back</InstructorButton>}
      </InstructorPage>
    );
  }

  const detailPath = `${base}/assignments/${assignment.id}`;
  // BR-185: only the on/off switch is blocked once the Course is Locked; the parameters stay editable.
  const toggleLocked = assignment.courseLocked;

  // The fields are only used (and checked) while Peer Review is on.
  const errors = enabled
    ? [
        validateNumber(reviewers, PEER_REVIEWERS_RULE),
        validateNumber(cycleLength, PEER_DAYS_RULE),
        validateNumber(reviewDeadline, PEER_DAYS_RULE),
        validateNumber(threshold, PEER_SCORE_GAP_RULE),
      ]
    : [];

  const handleSave = async () => {
    setSubmitted(true);
    if (errors.some(Boolean)) {
      message.warning("Please fix the highlighted fields.");
      requestAnimationFrame(() =>
        document
          .querySelector(".builder-field-error, .ant-input-number-status-error")
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      return;
    }
    setSaving(true);
    try {
      const res = await updatePeerReviewAPI(
        assignment.id,
        enabled
          ? {
              enabled,
              reviewersPerSubmission: reviewers ?? undefined,
              cycleDays: cycleLength ?? undefined,
              deadlineDays: reviewDeadline ?? undefined,
              scoreGap: threshold ?? undefined,
            }
          : { enabled },
      );
      if (!res.data) {
        message.error(assessmentErrorText(res, "Unable to save Peer Review settings."));
        return;
      }
      message.success("Peer Review settings saved.");
      navigate(detailPath, { state: location.state });
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Peer Review Settings</span>
      <div className="builder-hero">
        <h1>Peer Review Settings</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <div className="builder-actions-split" style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Enable Peer Review</h2>
            <Switch checked={enabled} disabled={toggleLocked} onChange={setEnabled} />
          </div>

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label">Reviewers per submission</label>
              <NumberField
                rule={PEER_REVIEWERS_RULE}
                disabled={!enabled}
                showError={submitted}
                value={reviewers}
                onChange={setReviewers}
              />
            </div>
            <div>
              <label className="instructor-form-label">Cycle length (days)</label>
              <NumberField
                rule={PEER_DAYS_RULE}
                placeholder="Platform default"
                disabled={!enabled}
                showError={submitted}
                value={cycleLength}
                onChange={setCycleLength}
              />
            </div>
            <div>
              <label className="instructor-form-label">Review deadline after cycle closes (days)</label>
              <NumberField
                rule={PEER_DAYS_RULE}
                placeholder="Platform default"
                disabled={!enabled}
                showError={submitted}
                value={reviewDeadline}
                onChange={setReviewDeadline}
              />
            </div>
            <div>
              <label className="instructor-form-label">Score discrepancy threshold (0-100)</label>
              <NumberField
                rule={PEER_SCORE_GAP_RULE}
                disabled={!enabled}
                showError={submitted}
                value={threshold}
                onChange={setThreshold}
              />
            </div>
          </div>

          <InfoPanel title="Cycle timing">
            The review deadline starts when the cycle closes and work is assigned. Choose a cycle long enough to
            collect at least {reviewers && Number.isFinite(reviewers) ? reviewers + 1 : "reviewers + 1"} submissions;
            otherwise you grade that cycle yourself.
          </InfoPanel>

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(detailPath, { state: location.state })}>Cancel</InstructorButton>
            <InstructorButton type="primary" loading={saving} onClick={handleSave}>
              Save settings
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <div className="builder-banner" style={{ marginBottom: 0 }}>
            <strong>Locked rule</strong>
            <p>
              {toggleLocked
                ? "The Course is Locked, so Peer Review cannot be turned on or off. You can still change its parameters; they apply to new cycles only."
                : "Turning Peer Review on or off is blocked after Course Locked."}
            </p>
          </div>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentPeerReviewEdit;
