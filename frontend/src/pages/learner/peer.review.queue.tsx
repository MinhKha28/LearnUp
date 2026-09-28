import { useNavigate } from "react-router-dom";
import { peerReviewTasks } from "@/components/learner/learner.data";
import {
  InfoPanel,
  LearnerButton,
  LearnerPage,
  PageHeader,
} from "@/components/learner/learner.ui";
import "./peer.review.queue.scss";

const PeerReviewQueue = () => {
  const navigate = useNavigate();
  const tasks = peerReviewTasks.filter((task) => !task.hiddenFromQueue);

  return (
    <LearnerPage className="peer-review-queue">
      <PageHeader
        eyebrow="LEARNER"
        title="Peer Review Tasks"
        subtitle="Review the anonymous submissions assigned to you."
        actions={
          <LearnerButton onClick={() => navigate("/learner/peer-review/history")}>
            Review history
          </LearnerButton>
        }
      />
      <InfoPanel title="Review deadline">
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
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <strong>Submission {task.id}</strong>
                </td>
                <td>{task.assignmentTitle}</td>
                <td>{task.reviewDeadline}</td>
                <td>{task.status === "completed" ? "Completed" : "Pending"}</td>
                <td>
                  <LearnerButton onClick={() => navigate(`/learner/peer-review/${task.id}`)}>
                    {task.status === "completed" ? "View review" : "Start review"}
                  </LearnerButton>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5}>No Peer Review tasks are assigned to you right now.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="peer-review-queue-footnote">Author names are hidden from Learner reviewers.</p>
      </div>
    </LearnerPage>
  );
};

export default PeerReviewQueue;
