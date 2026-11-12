import { formatDateTimeVN } from "@/utils/helper";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DetailItem, InfoPanel, LearnerButton, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import { learnerAssessmentErrorText, fetchLearnerResultAPI } from "@/services/assessment.service";
import type { IGradingResult } from "@/types/assessment.types";
import "./assignment.result.scss";

const formatTime = (iso: string) => formatDateTimeVN(iso);

/** UC30.2 - the final score, the score per criterion and the comments of a Finalized submission (BR-208, BR-322). */
const AssignmentResult = () => {
  const { enrollmentId: courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<IGradingResult | null>(null);
  const [loading, setLoading] = useState(true);
  // set when there is nothing to show: not submitted, not graded yet (PRE-1), or the call failed
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const load = async () => {
      try {
        // PRE-1: only a Finalized submission has a result; the server says so when it has none.
        const res = await fetchLearnerResultAPI(assignmentId);
        if (!active) return;
        if (res.data) setResult(res.data);
        else setNotice(learnerAssessmentErrorText(res));
      } catch {
        if (active) setNotice("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [assignmentId]);

  const back = () => navigate(`/learner/courses/${courseId}/assessments`);

  if (!result) {
    return (
      <>
        <PageHeader
          eyebrow="Bài đánh giá / Kết quả"
          title={loading ? "Đang tải kết quả..." : "Chưa có kết quả"}
          subtitle={loading ? "Vui lòng đợi." : notice}
          back
        />
        {!loading && <LearnerButton onClick={back}>Quay lại bài đánh giá</LearnerButton>}
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Bài đánh giá / Kết quả"
        title={`${result.assignment.title} - kết quả`}
        subtitle={`Lần nộp thứ ${result.submission.submissionNumber}, nộp lúc ${formatTime(result.submission.submittedAt)}.`}
        back
      />
      <div className="course-learning-main">
        <div className="course-learning-content assignment-result-card">
          <div className="assignment-result-score">
            <span>Điểm cuối cùng</span>
            <strong>{result.finalScore}%</strong>
            <StatusTag tone={result.passed ? "success" : "error"}>{result.passed ? "Đạt" : "Chưa đạt"}</StatusTag>
          </div>
          {result.finalizationComment && (
            <InfoPanel title="Ghi chú của giảng viên">{result.finalizationComment}</InfoPanel>
          )}

          <h3>Điểm theo tiêu chí</h3>
          <ul className="assignment-result-criteria">
            {result.criteria.map((criterion) => (
              <li key={criterion.id}>
                <span>{criterion.name}</span>
                <em>
                  {criterion.averagePoints === null ? "-" : criterion.averagePoints} / {criterion.maxPoints} điểm
                </em>
              </li>
            ))}
          </ul>

          <h3>Nhận xét</h3>
          {result.comments.length === 0 ? (
            <p className="assignment-result-empty">Chưa có nhận xét nào.</p>
          ) : (
            <ul className="assignment-result-comments">
              {result.comments.map((item, index) => (
                <li key={index}>
                  <strong>{item.source === "INSTRUCTOR" ? "Giảng viên" : "Người chấm chéo"}</strong>
                  <p>{item.comment}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="assignment-result-actions">
            <LearnerButton type="primary" onClick={back}>
              Quay lại bài đánh giá
            </LearnerButton>
          </div>
        </div>
        <div className="course-learning-side">
          <div className="assignment-result-info">
            <h3>Thông tin kết quả</h3>
            <DetailItem label="Điểm tối thiểu">{result.assignment.passingScore}%</DetailItem>
            <DetailItem label="Chấm lúc">{formatTime(result.finalizedAt)}</DetailItem>
            <DetailItem label="Người chấm">Ẩn</DetailItem>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssignmentResult;
