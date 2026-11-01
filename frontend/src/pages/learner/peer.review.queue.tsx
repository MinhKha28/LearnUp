import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  InfoPanel,
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatusTag,
} from "@/components/learner/learner.ui";
import {
  assessmentErrorText,
  fetchLearnerPeerReviewsAPI,
} from "@/services/assessment.service";
import type {
  ILearnerReviewItem,
  ILearnerReviewList,
  TLearnerReviewState,
} from "@/types/assessment.types";
import "./peer.review.queue.scss";

const STATE_VIEW: Record<
  TLearnerReviewState,
  { label: string; tone: "info" | "success" | "neutral"; action: string }
> = {
  Open: { label: "To do", tone: "info", action: "Start review" },
  Done: { label: "Completed", tone: "success", action: "View review" },
  Closed: { label: "Closed", tone: "neutral", action: "View" },
};

const formatTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "-";

/** What the Learner calls a review without knowing the author: the end of its id, like the other anonymous labels. */
const reviewLabel = (item: ILearnerReviewItem) =>
  `Submission ${item.id.slice(-4).toUpperCase()}`;

/**
 * UC31 - the reviews the system handed out to the Learner, with the deadline of the cycle (BR-229). The number still to
 * give is the first thing on the page (BR-232). The author of the work is not shown (BR-233).
 */
const PeerReviewQueue = () => {
  const navigate = useNavigate();
  const [list, setList] = useState<ILearnerReviewList | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLearnerPeerReviewsAPI();
      if (res.data) {
        setList(res.data);
        setNotice("");
      } else {
        setList(null);
        setNotice(
          assessmentErrorText(res, "Unable to load your peer reviews."),
        );
      }
    } catch {
      setList(null);
      setNotice("Unable to reach the Assessment service. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <LearnerPage className="peer-review-queue">
      <PageHeader
        eyebrow="LEARNER"
        title="Peer Review Tasks"
        subtitle="Review the anonymous submissions assigned to you."
        actions={
          <LearnerButton
            onClick={() => navigate("/learner/peer-review/history")}
          >
            Review history
          </LearnerButton>
        }
      />
      {loading && <p className="peer-review-queue-footnote">Loading...</p>}
      {!loading && notice && (
        <InfoPanel title="Peer reviews not available">
          {notice}{" "}
          <LearnerButton onClick={() => void load()}>Try again</LearnerButton>
        </InfoPanel>
      )}
      {list && (
        <>
          <InfoPanel title="Review deadline">
            {list.pendingCount > 0
              ? `You have ${list.pendingCount} ${list.pendingCount === 1 ? "review" : "reviews"} to give. `
              : "You have no review to give right now. "}
            The cycle deadline is shared by all assigned reviewers.
          </InfoPanel>
          <div className="peer-review-queue-card">
            <table className="peer-review-queue-table">
              <thead>
                <tr>
                  <th>Assigned submission</th>
                  <th>Assignment</th>
                  <th>Review deadline</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{reviewLabel(item)}</strong>
                    </td>
                    <td>{item.assignmentTitle}</td>
                    <td>{formatTime(item.reviewDueAt)}</td>
                    <td>
                      <StatusTag tone={STATE_VIEW[item.state].tone}>
                        {STATE_VIEW[item.state].label}
                      </StatusTag>
                    </td>
                    <td>
                      <LearnerButton
                        onClick={() =>
                          navigate(`/learner/peer-review/${item.id}`)
                        }
                      >
                        {STATE_VIEW[item.state].action}
                      </LearnerButton>
                    </td>
                  </tr>
                ))}
                {list.items.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      No Peer Review tasks are assigned to you right now.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="peer-review-queue-footnote">
              Author names are hidden from Learner reviewers.
            </p>
          </div>
        </>
      )}
    </LearnerPage>
  );
};

export default PeerReviewQueue;
