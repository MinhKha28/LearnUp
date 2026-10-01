import { InputNumber, Switch, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { findInstructorCourse } from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, fetchAssignmentAPI, updatePeerReviewAPI } from "@/services/assessment.service";
import type { IAssignment } from "@/types/assessment.types";
import "./course.builder.scss";

const CourseBuilderAssignmentPeerReviewEdit = () => {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  const [assignment, setAssignment] = useState<IAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  if (!course) return null;

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

  const handleSave = async () => {
    if (enabled) {
      if (!reviewers || reviewers < 1) {
        message.warning("Enter the number of reviewers per submission (at least 1).");
        return;
      }
      if (threshold === null || threshold < 0 || threshold > 100) {
        message.warning("Enter a score discrepancy threshold between 0 and 100.");
        return;
      }
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
      navigate(detailPath);
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
              <InputNumber
                style={{ width: "100%" }}
                min={1}
                precision={0}
                disabled={!enabled}
                value={reviewers ?? undefined}
                onChange={(value) => setReviewers(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Cycle length (days)</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="Platform default"
                min={1}
                precision={0}
                disabled={!enabled}
                value={cycleLength ?? undefined}
                onChange={(value) => setCycleLength(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Review deadline after cycle closes (days)</label>
              <InputNumber
                style={{ width: "100%" }}
                placeholder="Platform default"
                min={1}
                precision={0}
                disabled={!enabled}
                value={reviewDeadline ?? undefined}
                onChange={(value) => setReviewDeadline(typeof value === "number" ? value : null)}
              />
            </div>
            <div>
              <label className="instructor-form-label">Score discrepancy threshold (0-100)</label>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                max={100}
                precision={2}
                disabled={!enabled}
                value={threshold ?? undefined}
                onChange={(value) => setThreshold(typeof value === "number" ? value : null)}
              />
            </div>
          </div>

          <InfoPanel title="Cycle timing">
            The review deadline starts when the cycle closes and work is assigned. Choose a cycle long enough to
            collect at least {reviewers ? reviewers + 1 : "reviewers + 1"} submissions; otherwise you grade that
            cycle yourself.
          </InfoPanel>

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(detailPath)}>Cancel</InstructorButton>
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
