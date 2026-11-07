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
        eyebrow="HỌC VIÊN"
        title="Lịch sử chấm của tôi"
        subtitle="Các bài chấm chéo bạn đã hoàn thành và tình trạng nghĩa vụ chấm."
        back
      />
      <div className="peer-review-history-obligation">
        <div>
          <span>Nghĩa vụ chấm chéo</span>
          <StatusTag tone={obligationComplete ? "success" : "warning"}>
            {obligationComplete ? "Hoàn thành" : "Đang thực hiện"}
          </StatusTag>
        </div>
        <p>
          Số bài được giao: {totalAssigned}. Đã chấm: {completed.length}
        </p>
      </div>
      <div className="peer-review-history-card">
        <h3>Các bài đã chấm</h3>
        <table className="peer-review-history-table">
          <thead>
            <tr>
              <th>Bài nộp</th>
              <th>Bài tập</th>
              <th>Điểm đã chấm</th>
              <th>Ngày chấm</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {completed.map((task) => {
              const total = task.result?.scores.reduce((sum, value) => sum + value, 0) ?? 0;
              const max = task.criteria.length * 5;
              return (
                <tr key={task.id}>
                  <td>
                    <strong>Bài nộp {task.id}</strong>
                  </td>
                  <td>{task.assignmentTitle}</td>
                  <td>
                    {total}/{max}
                  </td>
                  <td>{task.result?.completedAt}</td>
                  <td>Hoàn thành</td>
                </tr>
              );
            })}
            {completed.length === 0 && (
              <tr>
                <td colSpan={5}>Chưa có bài chấm chéo nào hoàn thành.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <InfoPanel title="Điều kiện đánh giá">
        Phải chấm xong các bài được giao của bài tập có chấm chéo.
      </InfoPanel>
    </LearnerPage>
  );
};

export default PeerReviewHistory;
