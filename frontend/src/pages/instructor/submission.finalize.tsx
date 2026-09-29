import { Input, InputNumber, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderAssignment,
  findCourseStructure,
  findSubmission,
  publishSubmissionGrade,
} from "@/components/instructor/instructor.data";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";
import "./submissions.scss";

const SubmissionFinalize = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const submission = findSubmission(submissionId);
  const structure = submission ? findCourseStructure(submission.courseId) : undefined;
  const assignment =
    structure && submission ? findBuilderAssignment(structure, submission.assignmentId) : undefined;

  const [finalScore, setFinalScore] = useState<number | null>(submission?.finalScore ?? null);
  const [feedback, setFeedback] = useState(submission?.feedback ?? "");

  if (!submission) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="SUBMISSIONS / FINALIZE"
          title="Submission not found"
          subtitle="This Submission may have been removed."
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/submissions")}>
          Back to Submissions
        </InstructorButton>
      </InstructorPage>
    );
  }

  const handlePublish = () => {
    publishSubmissionGrade(submission, finalScore ?? 0, feedback);
    message.success("Final score published.");
    navigate("/instructor/submissions");
  };

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="SUBMISSIONS / FINALIZE"
        title="Finalize Assignment Score"
        subtitle="Confirm or adjust the summary before publication."
        back
      />
      <SectionCard>
        <div className="instructor-finalize-aggregate">
          <span>Peer Review aggregate</span>
          <strong>[Average of valid reviewer scores]</strong>
        </div>
        <div className="instructor-finalize-fields">
          <div>
            <label>Final score</label>
            <InputNumber
              style={{ width: "100%" }}
              placeholder="[Confirmed or adjusted score]"
              min={0}
              value={finalScore ?? undefined}
              onChange={(value) => setFinalScore(typeof value === "number" ? value : null)}
            />
          </div>
          <div>
            <label>Minimum passing score</label>
            <p className="instructor-finalize-configured">
              {assignment?.passingScore ?? "[Configured score]"}
            </p>
          </div>
        </div>
        <div className="instructor-finalize-feedback">
          <label>Feedback for Learner</label>
          <Input.TextArea
            rows={5}
            placeholder="Explain the final assessment..."
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </div>
        <InfoPanel title="Publication">
          The Learner receives the final score and rubric feedback.
        </InfoPanel>
        <div className="instructor-finalize-actions" style={{ marginTop: 20 }}>
          <InstructorButton type="primary" onClick={handlePublish}>
            Publish final score
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default SubmissionFinalize;
