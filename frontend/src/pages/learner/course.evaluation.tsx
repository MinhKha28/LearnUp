import { useState } from "react";
import { StarFilled, StarOutlined } from "@ant-design/icons";
import { Input, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  courseDetails,
  findCourseEvaluation,
  type ICourseEvaluationRatings,
} from "@/components/learner/learner.data";
import { InfoPanel, LearnerButton, LearnerPage, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import "./course.evaluation.scss";

const criteria: { key: keyof ICourseEvaluationRatings; label: string }[] = [
  { key: "usefulness", label: "Mức độ hữu ích của nội dung" },
  { key: "difficulty", label: "Mức độ phù hợp của độ khó" },
  { key: "quality", label: "Chất lượng học liệu" },
];

const ratingOptions = [1, 2, 3, 4, 5];
const maxCommentLength = 2000;

const StarRating = ({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
}) => (
  <div className="course-evaluation-stars" role="group" aria-label={label}>
    {ratingOptions.map((star) => (
      <button
        key={star}
        type="button"
        disabled={disabled}
        aria-label={`${star} sao`}
        aria-pressed={star === value}
        onClick={() => onChange?.(star)}
      >
        {star <= value ? <StarFilled /> : <StarOutlined />}
      </button>
    ))}
  </div>
);

const CourseEvaluation = () => {
  const { enrollmentId: courseId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const evaluation = findCourseEvaluation(courseId);

  const [submitted, setSubmitted] = useState(evaluation?.status === "open");
  const [ratings, setRatings] = useState<ICourseEvaluationRatings>(
    evaluation?.ratings ?? { usefulness: 0, difficulty: 0, quality: 0 },
  );
  const [comments, setComments] = useState(evaluation?.comments ?? "");

  if (!course || !evaluation) {
    return (
      <LearnerPage className="course-evaluation">
        <PageHeader eyebrow="Khóa học đã hoàn thành / Đánh giá" title="Chưa thể đánh giá" subtitle="" back />
        <LearnerButton onClick={() => navigate("/learner/courses")}>Quay lại khóa học của tôi</LearnerButton>
      </LearnerPage>
    );
  }

  if (evaluation.status === "closed") {
    return (
      <LearnerPage className="course-evaluation">
        <PageHeader
          eyebrow="Khóa học đã hoàn thành / Đánh giá"
          title="Đánh giá khóa học"
          subtitle="Đã hết thời hạn đánh giá."
          back
        />
        <div className="course-evaluation-closed-card">
          <StatusTag tone="neutral">Đã đóng</StatusTag>
          <h3>Bạn không thể sửa đánh giá đã gửi.</h3>
          <p>Việc đánh giá không ảnh hưởng đến chứng chỉ của bạn.</p>
          <InfoPanel title="Quyền riêng tư">Nội dung đánh giá vẫn được ẩn danh.</InfoPanel>
        </div>
      </LearnerPage>
    );
  }

  const rate = (key: keyof ICourseEvaluationRatings, value: number) =>
    setRatings((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    const invalidRating = criteria.some(({ key }) => !ratingOptions.includes(ratings[key]));
    if (invalidRating) {
      message.warning("Hãy chấm điểm cho từng tiêu chí trước khi gửi.");
      return;
    }
    if (comments.length > maxCommentLength) {
      message.warning("Nhận xét tối đa 2.000 ký tự.");
      return;
    }
    message.success(submitted ? "Đã cập nhật đánh giá." : "Cảm ơn bạn đã gửi đánh giá.");
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <LearnerPage className="course-evaluation">
        <PageHeader
          eyebrow="Khóa học đã hoàn thành / Đánh giá"
          title="Sửa đánh giá khóa học"
          subtitle="Bạn có thể sửa đánh giá trong thời hạn quy định."
          back
        />
        <InfoPanel title="Đang trong thời hạn đánh giá">
          Bạn có thể cập nhật đánh giá đến {evaluation.windowCloseDate ?? "ngày kết thúc theo quy định"}.
        </InfoPanel>
        <div className="course-evaluation-card">
          <h3>Điểm đánh giá ẩn danh của bạn</h3>
          {criteria.map((criterion) => (
            <div className="course-evaluation-row" key={criterion.key}>
              <span>{criterion.label}</span>
              <StarRating label={criterion.label} value={ratings[criterion.key]} onChange={(value) => rate(criterion.key, value)} />
            </div>
          ))}
          <span className="course-evaluation-comments-label">Nhận xét</span>
          <Input.TextArea
            rows={4}
            maxLength={maxCommentLength}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
          />
          <div className="course-evaluation-actions">
            <LearnerButton type="primary" onClick={submit}>
              Lưu thay đổi
            </LearnerButton>
          </div>
        </div>
      </LearnerPage>
    );
  }

  return (
    <LearnerPage className="course-evaluation">
      <PageHeader
        eyebrow="Khóa học đã hoàn thành / Đánh giá"
        title="Đánh giá khóa học"
        subtitle="Gửi nhận xét ẩn danh sau khi hoàn thành khóa học."
        back
      />
      <InfoPanel title="Đánh giá ẩn danh">
        Danh tính của bạn được giữ kín khi gửi đánh giá này.
      </InfoPanel>
      <div className="course-evaluation-card">
        <h3>Chấm điểm từng tiêu chí</h3>
        {criteria.map((criterion) => (
          <div className="course-evaluation-row" key={criterion.key}>
            <span>{criterion.label}</span>
            <StarRating label={criterion.label} value={ratings[criterion.key]} onChange={(value) => rate(criterion.key, value)} />
          </div>
        ))}
        <span className="course-evaluation-comments-label">Nhận xét bổ sung (không bắt buộc)</span>
        <Input.TextArea
          rows={4}
            maxLength={maxCommentLength}
          placeholder="Nhập nhận xét…"
          value={comments}
          onChange={(event) => setComments(event.target.value)}
        />
        <div className="course-evaluation-actions course-evaluation-actions-split">
          <LearnerButton onClick={() => navigate(`/learner/courses/${course.id}/progress`)}>
            Bỏ qua
          </LearnerButton>
          <LearnerButton type="primary" onClick={submit}>
            Gửi đánh giá
          </LearnerButton>
        </div>
      </div>
    </LearnerPage>
  );
};

export default CourseEvaluation;
