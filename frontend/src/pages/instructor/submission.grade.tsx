import { Input, InputNumber, message } from "antd";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderAssignment,
  findCourseStructure,
  findSubmission,
  saveDirectGrade,
} from "@/components/instructor/instructor.data";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import "./submissions.scss";

const SubmissionGrade = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const submission = findSubmission(submissionId);
  const structure = submission ? findCourseStructure(submission.courseId) : undefined;
  const assignment =
    structure && submission ? findBuilderAssignment(structure, submission.assignmentId) : undefined;

  const criteria = useMemo(
    () =>
      assignment && assignment.rubric.length > 0
        ? assignment.rubric.map((criterion, index) => ({ id: criterion.id, label: `Criterion ${index + 1}` }))
        : [
            { id: "c1", label: "Criterion 1" },
            { id: "c2", label: "Criterion 2" },
            { id: "c3", label: "Criterion 3" },
          ],
    [assignment],
  );

  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [feedback, setFeedback] = useState("");

  if (!submission) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="SUBMISSIONS / DIRECT GRADING"
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

  const handleSave = () => {
    const values = Object.values(scores).filter((value): value is number => typeof value === "number");
    const average = values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;
    saveDirectGrade(submission, average, feedback);
    message.success("Draft grade saved.");
    navigate(`/instructor/submissions/${submission.id}`);
  };

  if (submission.isResubmission) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="SUBMISSIONS / RESUBMISSION"
          title="Direct Grade: Resubmission"
          subtitle={`${submission.assignmentTitle} / Original peer cycle has closed.`}
          back
        />
        <WarningPanel title="Resubmission routing">
          This latest submission goes to the Instructor, not into Peer Review.
        </WarningPanel>
        <div className="instructor-submission-detail-grid" style={{ marginTop: 16 }}>
          <SectionCard title="Latest Learner submission">
            <p className="instructor-submission-meta">
              Learner: {submission.learnerName} • Submitted: [Date &amp; time]
            </p>
            <div className="instructor-submission-body">
              <p>[Revised answer and attachment]</p>
              <p>Original cycle: Closed • Latest score will replace prior result.</p>
            </div>
          </SectionCard>
          <SectionCard title="Grade with Rubric">
            <div className="instructor-submission-grade-form">
              {criteria.map((criterion) => (
                <div className="instructor-grade-field" key={criterion.id}>
                  <label>{criterion.label} [Score]</label>
                  <InputNumber
                    style={{ width: "100%" }}
                    placeholder="Enter score"
                    min={0}
                    value={scores[criterion.id] ?? undefined}
                    onChange={(value) =>
                      setScores((prev) => ({ ...prev, [criterion.id]: typeof value === "number" ? value : null }))
                    }
                  />
                </div>
              ))}
              <div className="instructor-grade-actions">
                <InstructorButton type="primary" onClick={handleSave}>
                  Save direct grade
                </InstructorButton>
              </div>
            </div>
          </SectionCard>
        </div>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="SUBMISSIONS / DIRECT GRADING"
        title="Grade Submission Directly"
        subtitle={`${submission.assignmentTitle} / Rubric grading`}
        back
      />
      <div className="instructor-submission-detail-grid">
        <SectionCard title="Learner work">
          <div className="instructor-submission-body">
            <p>[Submission body and attachments displayed here.]</p>
            <p className="instructor-grade-reason">Reason for direct grading: [Applicable rule].</p>
          </div>
          <InfoPanel title="Direct grading cases">
            Peer Review off, insufficient cycle, missed review or score discrepancy.
          </InfoPanel>
        </SectionCard>
        <SectionCard title="Rubric">
          <div className="instructor-submission-grade-form">
            {criteria.map((criterion) => (
              <div className="instructor-grade-field" key={criterion.id}>
                <label>{criterion.label}</label>
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="Enter score"
                  min={0}
                  value={scores[criterion.id] ?? undefined}
                  onChange={(value) =>
                    setScores((prev) => ({ ...prev, [criterion.id]: typeof value === "number" ? value : null }))
                  }
                />
              </div>
            ))}
            <div className="instructor-grade-field">
              <label>Feedback</label>
              <Input.TextArea
                rows={4}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
            </div>
            <div className="instructor-grade-actions">
              <InstructorButton type="primary" onClick={handleSave}>
                Save draft grade
              </InstructorButton>
            </div>
          </div>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default SubmissionGrade;
