import { peerReviewTasks } from "@/components/learner/learner.data";
import { InfoPanel, LearnerPage, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import "./peer.review.history.scss";

const PeerReviewHistory = () => {
  const completed = peerReviewTasks.filter((task) => task.status === "completed");
  const totalAssigned = peerReviewTasks.length;
  const obligationComplete = completed.length === totalAssigned;

  return (
    <LearnerPage className="peer-review-history">
      <PageHeader
        eyebrow="LEARNER"
        title="My Review History"
        subtitle="Your completed peer reviews and review obligation status."
        back
      />
      <div className="peer-review-history-obligation">
        <div>
          <span>Review obligation</span>
          <StatusTag tone={obligationComplete ? "success" : "warning"}>
            {obligationComplete ? "Complete" : "In progress"}
          </StatusTag>
        </div>
        <p>
          Assigned reviews: {totalAssigned} Completed: {completed.length}
        </p>
      </div>
      <div className="peer-review-history-card">
        <h3>Completed reviews</h3>
        <table className="peer-review-history-table">
          <thead>
            <tr>
              <th>Submission</th>
              <th>Assignment</th>
              <th>Score given</th>
              <th>Completed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {completed.map((task) => {
              const total = task.result?.scores.reduce((sum, value) => sum + value, 0) ?? 0;
              const max = task.criteria.length * 5;
              return (
                <tr key={task.id}>
                  <td>
                    <strong>Submission {task.id}</strong>
                  </td>
                  <td>{task.assignmentTitle}</td>
                  <td>
                    {total}/{max}
                  </td>
                  <td>{task.result?.completedAt}</td>
                  <td>Complete</td>
                </tr>
              );
            })}
            {completed.length === 0 && (
              <tr>
                <td colSpan={5}>No Peer Reviews have been completed yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <InfoPanel title="Assessment condition">
        Assigned reviews must be completed for the peer-reviewed Assignment.
      </InfoPanel>
    </LearnerPage>
  );
};

export default PeerReviewHistory;
