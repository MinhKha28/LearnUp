import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DetailItem,
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
} from "@/services/assessment.service";
import type {
  IPeerReviewCycleDetail,
  TReviewerObligation,
} from "@/types/assessment.types";
import "./peer.cycles.scss";

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const OBLIGATION_LABEL: Record<TReviewerObligation, string> = {
  Pending: "In progress",
  Satisfied: "Done",
  Missed: "Missed",
  Waived: "Waived",
};

/**
 * UC33.1 - one cycle: the submissions with the reviews they got, and the Learners who have reviews to give with the state of
 * their duty. A duty that was missed can be waived from here (UC33.2).
 */
const PeerCycleDetail = () => {
  const { assignmentId = "", cycleId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<IPeerReviewCycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPeerReviewCycleDetailAPI(assignmentId, cycleId);
      if (res.data) {
        setDetail(res.data);
        setNotice("");
      } else {
        setDetail(null);
        const code = assessmentErrorCode(res).code;
        if (code === "CYCLE_NOT_FOUND")
          setNotice("This Peer Review Cycle may have been removed.");
        else if (code === "PEER_REVIEW_NOT_ENABLED")
          setNotice(
            "Peer Review is not enabled for this Assignment, so it has no cycles.",
          );
        else setNotice(assessmentErrorText(res, "Unable to load this cycle."));
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

  if (loading) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="PEER CYCLES / DETAIL"
          title="Peer Review Cycle Details"
          subtitle="Loading..."
          back
        />
        <p className="peer-cycles-empty">Loading the cycle...</p>
      </InstructorPage>
    );
  }

  if (!detail) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="PEER CYCLES / DETAIL"
          title="Cycle not available"
          subtitle={notice}
          back
        />
        <InstructorButton onClick={() => void load()}>
          Try again
        </InstructorButton>{" "}
        <InstructorButton onClick={() => navigate("/instructor/peer-cycles")}>
          Back to Peer Cycles
        </InstructorButton>
      </InstructorPage>
    );
  }

  const { cycle } = detail;
  return (
    <InstructorPage className="instructor-peer-cycles">
      <PageHeader
        eyebrow="PEER CYCLES / DETAIL"
        title="Peer Review Cycle Details"
        subtitle={detail.title}
        back
      />
      <SectionCard className="instructor-cycle-meta-card">
        <div className="instructor-cycle-meta-grid">
          <DetailItem label="OPEN">{formatTime(cycle.opensAt)}</DetailItem>
          <DetailItem label="CLOSE & ASSIGN">
            {formatTime(cycle.closesAt)}
          </DetailItem>
          <DetailItem label="REVIEW DEADLINE">
            {formatTime(cycle.reviewDueAt)}
          </DetailItem>
        </div>
      </SectionCard>
      <div className="instructor-cycle-detail-grid">
        <SectionCard title="Submissions in cycle">
          <div className="instructor-cycle-table">
            <div className="instructor-cycle-row instructor-cycle-row-submissions instructor-cycle-head">
              <span>Submission</span>
              <span>Reviews</span>
              <span>Need</span>
            </div>
            {detail.submissions.map((row) => (
              <div
                className="instructor-cycle-row instructor-cycle-row-submissions"
                key={row.id}
              >
                <strong>{learnerLabel(row.fullName, row.learnerId)}</strong>
                <span>
                  {row.reviewsCompleted} of {row.reviewsAssigned}
                </span>
                <span>{row.reviewsMissing}</span>
              </div>
            ))}
            {detail.submissions.length === 0 && (
              <div className="instructor-cycle-row instructor-cycle-row-submissions">
                <span>No Submissions in this Cycle yet.</span>
                <span />
                <span />
              </div>
            )}
          </div>
        </SectionCard>
        <SectionCard title="Reviewer obligations">
          <div className="instructor-cycle-table">
            <div className="instructor-cycle-row instructor-cycle-head">
              <span>Reviewer</span>
              <span>Assigned</span>
              <span>Completed</span>
              <span>Obligation</span>
            </div>
            {detail.reviewers.map((reviewer) => (
              <div className="instructor-cycle-row" key={reviewer.learnerId}>
                <strong>
                  {learnerLabel(reviewer.fullName, reviewer.learnerId)}
                </strong>
                <span>{reviewer.assigned}</span>
                <span>{reviewer.completed}</span>
                <span className="instructor-cycle-obligation">
                  <span
                    className={`instructor-cycle-chip instructor-cycle-chip-${reviewer.obligation}`}
                  >
                    {OBLIGATION_LABEL[reviewer.obligation]}
                  </span>
                  {reviewer.canWaive && (
                    <button
                      type="button"
                      className="instructor-cycle-waive-link"
                      onClick={() =>
                        navigate(
                          `/instructor/peer-cycles/${detail.assignmentId}/${cycle.id}/waive/${reviewer.learnerId}`,
                        )
                      }
                    >
                      Waive
                    </button>
                  )}
                </span>
              </div>
            ))}
            {detail.reviewers.length === 0 && (
              <div className="instructor-cycle-row">
                <span>No Reviewers assigned yet.</span>
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </SectionCard>
      </div>
      <WarningPanel title="Interventions">
        Grade missing reviews directly and inspect submissions with score
        discrepancies.
      </WarningPanel>
    </InstructorPage>
  );
};

export default PeerCycleDetail;
