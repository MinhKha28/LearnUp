import { useCallback, useEffect, useState } from "react";
import { message, Popconfirm } from "antd";
import { InstructorButton } from "@/components/instructor/instructor.ui";
import {
  assessmentErrorCode,
  assessmentErrorText,
  closePeerReviewCycleAPI,
  fetchPeerReviewCyclesAPI,
} from "@/services/assessment.service";
import type { IPeerReviewCycleList, TPeerReviewCycleStatus } from "@/types/assessment.types";
import "./peer.cycle.table.scss";

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const STATUS_LABEL: Record<TPeerReviewCycleStatus, string> = {
  Open: "Open",
  Assigned: "Assigned",
  InstructorOnly: "Instructor grades",
  Completed: "Completed",
};

const STATUS_HINT: Record<TPeerReviewCycleStatus, string> = {
  Open: "Still taking submissions.",
  Assigned: "Closed; the work is assigned to reviewers.",
  InstructorOnly: "Closed with too few submissions for peer review, so you grade them all.",
  Completed: "All reviews are done.",
};

/**
 * UC33 - the cycles of one Assignment with their three dates, submissions and status. Shared by the Course Builder
 * (from an Assignment) and by the "Peer Cycles" page of the sidebar (a picked Assignment).
 */
const PeerCycleTable = ({
  assignmentId,
  onLoaded,
}: {
  assignmentId: string;
  /** Tells the page which Assignment it is showing. */
  onLoaded?: (list: IPeerReviewCycleList | null) => void;
}) => {
  const [list, setList] = useState<IPeerReviewCycleList | null>(null);
  const [loading, setLoading] = useState(true);
  // set when there is nothing to show: peer review is off, or the call failed
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [closingId, setClosingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let result: IPeerReviewCycleList | null = null;
    try {
      const res = await fetchPeerReviewCyclesAPI(assignmentId);
      if (res.data) {
        result = res.data;
        setNotice("");
      } else if (assessmentErrorCode(res).code === "PEER_REVIEW_NOT_ENABLED") {
        // PRE-1
        setNotice("Peer Review is not enabled for this Assignment, so it has no cycles.");
      } else {
        setNotice(assessmentErrorText(res, "Unable to load the peer review cycles."));
      }
    } catch {
      setNotice("Unable to reach the Assessment service. Please try again.");
    } finally {
      setList(result);
      setLoading(false);
      onLoaded?.(result);
    }
  }, [assignmentId, onLoaded]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  /** UC33: close the cycle now. The backend hands out the reviews or sends the work to the Instructor. */
  const closeCycle = async (cycleId: string) => {
    setClosingId(cycleId);
    try {
      const res = await closePeerReviewCycleAPI(assignmentId, cycleId);
      if (!res.data) {
        message.error(assessmentErrorText(res, "Unable to close the cycle."));
        return;
      }
      const done = res.data;
      if (done.alreadyClosed) message.info("This cycle was already closed.");
      else if (done.status === "Assigned")
        message.success(`Cycle closed. ${done.reviewCount} reviews were handed out to ${done.submissionCount} Learners.`);
      else message.success(`Cycle closed. Only ${done.submissionCount} submissions, so you grade them all.`);
      setReloadKey((key) => key + 1);
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setClosingId(null);
    }
  };

  if (loading) return <p className="peer-cycles-empty">Loading cycles...</p>;
  if (!list) {
    return (
      <div className="builder-banner">
        <strong>No cycles to show</strong>
        <p>{notice}</p>
        <InstructorButton onClick={() => setReloadKey((key) => key + 1)}>Try again</InstructorButton>
      </div>
    );
  }

  const n = list.settings.reviewersPerSubmission;
  return (
    <>
      {list.items.length === 0 ? (
        <p className="peer-cycles-empty">
          No cycle yet. The first one opens when a Learner submits work for this Assignment.
        </p>
      ) : (
        <table className="peer-cycles-table">
          <thead>
            <tr>
              <th>Cycle</th>
              <th>Opens</th>
              <th>Closes and assigns</th>
              <th>Reviews due</th>
              <th>Submissions</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.items.map((cycle, index) => (
              <tr key={cycle.id}>
                <td>
                  <strong>Cycle {index + 1}</strong>
                </td>
                <td>{formatTime(cycle.opensAt)}</td>
                <td>{formatTime(cycle.closesAt)}</td>
                <td>{formatTime(cycle.reviewDueAt)}</td>
                <td>{cycle.submissionCount}</td>
                <td>
                  <span className={`peer-cycles-status peer-cycles-status-${cycle.status}`} title={STATUS_HINT[cycle.status]}>
                    {STATUS_LABEL[cycle.status]}
                  </span>
                </td>
                <td>
                  {!cycle.closed && (
                    <Popconfirm
                      title="Close this cycle now?"
                      description={`Cycle ${index + 1} closes now and its ${cycle.submissionCount} submissions are handed out for review. Later submissions go to a new cycle.`}
                      okText="Close cycle"
                      onConfirm={() => closeCycle(cycle.id)}
                    >
                      <InstructorButton size="small" loading={closingId === cycle.id}>
                        Close cycle
                      </InstructorButton>
                    </Popconfirm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="peer-cycles-footnote">
        {n ?? "?"} reviewers per submission. With fewer than {(n ?? 0) + 1} submissions in a cycle, you grade them all.
        Changing the settings applies to cycles made afterwards; cycles already made keep their dates.
      </p>
    </>
  );
};

export default PeerCycleTable;
