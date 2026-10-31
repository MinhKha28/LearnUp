import { message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import { learnerLabel } from "@/components/instructor/peer.cycle.format";
import {
  assessmentErrorCode,
  assessmentErrorText,
  fetchPeerReviewCycleDetailAPI,
  waivePeerReviewDutyAPI,
} from "@/services/assessment.service";
import type { IPeerReviewCycleDetail } from "@/types/assessment.types";
import "./peer.cycles.scss";

/**
 * UC33.2 - the Instructor waives the peer review duty of one Learner who owes it (BR-241). The screen asks again before
 * it does it, because the Learner is told by e-mail and the duty cannot be given back.
 */
const PeerCycleWaive = () => {
  const { assignmentId = "", cycleId = "", learnerId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<IPeerReviewCycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const back = `/instructor/peer-cycles/${assignmentId}/${cycleId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPeerReviewCycleDetailAPI(assignmentId, cycleId);
      if (res.data) {
        setDetail(res.data);
        setNotice("");
      } else {
        setDetail(null);
        setNotice(assessmentErrorText(res, "Unable to load this cycle."));
      }
    } catch {
      setDetail(null);
      setNotice("Unable to reach the Assessment service. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId, cycleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reviewer = detail?.reviewers.find((row) => row.learnerId === learnerId);

  const confirm = async () => {
    setSaving(true);
    try {
      const res = await waivePeerReviewDutyAPI(assignmentId, learnerId);
      if (res.data) {
        if (res.data.alreadyWaived)
          message.info("This obligation was already waived.");
        else
          message.success(
            "Peer Review obligation waived. The Learner has been told.",
          );
        navigate(back);
        return;
      }
      if (assessmentErrorCode(res).code === "NOT_OWING_PEER_REVIEW") {
        message.warning(
          "This Learner no longer owes a peer review, so there is nothing to waive.",
        );
        navigate(back);
        return;
      }
      message.error(
        assessmentErrorText(res, "Unable to waive the obligation."),
      );
    } catch {
      message.error(
        "Unable to reach the Assessment service. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="CYCLE / OBLIGATION"
          title="Waive Peer Review Obligation"
          subtitle="Loading..."
          back
        />
        <p className="peer-cycles-empty">Loading...</p>
      </InstructorPage>
    );
  }

  if (!detail || !reviewer) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="CYCLE / OBLIGATION"
          title="Reviewer not found"
          subtitle={notice || "This Reviewer obligation may have been removed."}
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/peer-cycles")}>
          Back to Peer Cycles
        </InstructorButton>
      </InstructorPage>
    );
  }

  const name = learnerLabel(reviewer.fullName, reviewer.learnerId);
  return (
    <InstructorPage className="instructor-peer-cycles">
      <PageHeader
        eyebrow="CYCLE / OBLIGATION"
        title="Waive Peer Review Obligation"
        subtitle="Use it when the Learner cannot be expected to make up the reviews."
        back
      />
      <SectionCard className="instructor-waive-card">
        <h2>Learner: {name}</h2>
        <p>Assignment: {detail.title}</p>
        <p>
          Reviews completed in this cycle: {reviewer.completed} of{" "}
          {reviewer.assigned}
        </p>
        {reviewer.canWaive ? (
          <>
            <WarningPanel title="Before you confirm">
              You can waive a missed obligation at any time (BR-241), for
              example when the deadline passed because the Organization was
              suspended. A Learner who resubmits can still make it up by
              reviewing in the open cycle (BR-239). The Learner is told in the
              app and by e-mail, and the duty then counts as satisfied for
              completion.
            </WarningPanel>
            <div className="instructor-waive-actions">
              <InstructorButton
                type="primary"
                loading={saving}
                onClick={() => void confirm()}
              >
                Confirm waiver
              </InstructorButton>
              <InstructorButton onClick={() => navigate(back)}>
                Cancel
              </InstructorButton>
            </div>
          </>
        ) : (
          <>
            <WarningPanel title="Nothing to waive">
              {reviewer.obligation === "Waived"
                ? "This obligation is already waived."
                : "This Learner does not owe a peer review on this Assignment now (the reviews are done or still in time)."}
            </WarningPanel>
            <div className="instructor-waive-actions">
              <InstructorButton onClick={() => navigate(back)}>
                Back to the cycle
              </InstructorButton>
            </div>
          </>
        )}
      </SectionCard>
    </InstructorPage>
  );
};

export default PeerCycleWaive;
