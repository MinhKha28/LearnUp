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
  { key: "usefulness", label: "Usefulness of the content" },
  { key: "difficulty", label: "Appropriateness of the difficulty" },
  { key: "quality", label: "Quality of the learning materials" },
];

const StarRating = ({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
}) => (
  <div className="course-evaluation-stars">
    {[1, 2, 3, 4].map((star) => (
      <button
        key={star}
        type="button"
        disabled={disabled}
        aria-label={`${star} star`}
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
        <PageHeader eyebrow="COMPLETED COURSE / EVALUATION" title="Evaluation not available" subtitle="" back />
        <LearnerButton onClick={() => navigate("/learner/courses")}>Back to My Courses</LearnerButton>
      </LearnerPage>
    );
  }

  if (evaluation.status === "closed") {
    return (
      <LearnerPage className="course-evaluation">
        <PageHeader
          eyebrow="COMPLETED COURSE / EVALUATION"
          title="Course Evaluation"
          subtitle="The evaluation window is closed."
          back
        />
        <div className="course-evaluation-closed-card">
          <StatusTag tone="neutral">Closed</StatusTag>
          <h3>Your submitted evaluation can no longer be edited.</h3>
          <p>Evaluation completion does not affect your Certificate.</p>
          <InfoPanel title="Privacy">Evaluation content remains anonymous.</InfoPanel>
        </div>
      </LearnerPage>
    );
  }

  const rate = (key: keyof ICourseEvaluationRatings, value: number) =>
    setRatings((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    const missing = criteria.some((criterion) => ratings[criterion.key] === 0);
    if (missing) {
      message.warning("Rate every criterion before submitting.");
      return;
    }
    message.success(submitted ? "Evaluation updated." : "Feedback submitted. Thank you.");
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <LearnerPage className="course-evaluation">
        <PageHeader
          eyebrow="COMPLETED COURSE / EVALUATION"
          title="Edit Course Evaluation"
          subtitle="This evaluation is editable while the configured window is open."
          back
        />
        <InfoPanel title="Evaluation window open">
          You can update your feedback until {evaluation.windowCloseDate ?? "the configured closing date"}.
        </InfoPanel>
        <div className="course-evaluation-card">
          <h3>Your anonymous ratings</h3>
          {criteria.map((criterion) => (
            <div className="course-evaluation-row" key={criterion.key}>
              <span>{criterion.label}</span>
              <StarRating value={ratings[criterion.key]} onChange={(value) => rate(criterion.key, value)} />
            </div>
          ))}
          <span className="course-evaluation-comments-label">Comments</span>
          <Input.TextArea
            rows={4}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
          />
          <div className="course-evaluation-actions">
            <LearnerButton type="primary" onClick={submit}>
              Save changes
            </LearnerButton>
          </div>
        </div>
      </LearnerPage>
    );
  }

  return (
    <LearnerPage className="course-evaluation">
      <PageHeader
        eyebrow="COMPLETED COURSE / EVALUATION"
        title="Course Evaluation"
        subtitle="Share anonymous feedback after Course completion."
        back
      />
      <InfoPanel title="Anonymous evaluation">
        Your identity is not linked to the content of this evaluation.
      </InfoPanel>
      <div className="course-evaluation-card">
        <h3>Rate each criterion</h3>
        {criteria.map((criterion) => (
          <div className="course-evaluation-row" key={criterion.key}>
            <span>{criterion.label}</span>
            <StarRating value={ratings[criterion.key]} onChange={(value) => rate(criterion.key, value)} />
          </div>
        ))}
        <span className="course-evaluation-comments-label">Additional comments (optional)</span>
        <Input.TextArea
          rows={4}
          placeholder="Your feedback..."
          value={comments}
          onChange={(event) => setComments(event.target.value)}
        />
        <div className="course-evaluation-actions course-evaluation-actions-split">
          <LearnerButton onClick={() => navigate(`/learner/courses/${course.id}/progress`)}>
            Skip
          </LearnerButton>
          <LearnerButton type="primary" onClick={submit}>
            Submit feedback
          </LearnerButton>
        </div>
      </div>
    </LearnerPage>
  );
};

export default CourseEvaluation;
