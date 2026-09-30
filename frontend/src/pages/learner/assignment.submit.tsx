import { useState } from "react";
import { Input, Upload, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { courseDetails, findAssignment } from "@/components/learner/learner.data";
import { DetailItem, InfoPanel, LearnerButton, PageHeader } from "@/components/learner/learner.ui";
import "./assignment.submit.scss";

const AssignmentSubmit = () => {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const assignment = course ? findAssignment(course, assignmentId) : undefined;
  const [answer, setAnswer] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);

  if (!course || !assignment) {
    return null;
  }

  const submit = () => {
    if (!answer.trim()) {
      message.warning("Write your response before submitting.");
      return;
    }
    navigate(`/learner/courses/${course.id}/assignments/${assignment.id}/submitted`);
  };

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / SUBMIT"
        title={`Submit ${assignment.title}`}
        subtitle="Complete your answer and attach your work."
        back
      />
      <div className="course-learning-main">
          <div className="course-learning-content assignment-submit-card">
            <h3>Your answer</h3>
            <Input.TextArea
              rows={8}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Write your response here..."
            />
            <h3>Attachments</h3>
            <Upload.Dragger
              multiple={false}
              beforeUpload={(file) => {
                setFileName(file.name);
                return false;
              }}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Upload supporting file</p>
              <p className="ant-upload-hint">
                {fileName ? `Attached: ${fileName}` : "Attached files appear here before submission."}
              </p>
            </Upload.Dragger>
            <InfoPanel title="Assessment result">
              Your latest submission determines the recorded Assignment score.
            </InfoPanel>
            <div className="assignment-submit-actions">
              <LearnerButton type="primary" onClick={submit}>
                Submit work
              </LearnerButton>
            </div>
          </div>
          <div className="course-learning-side">
            <div className="assignment-submit-info">
              <h3>Submission information</h3>
              <DetailItem label="Estimated effort">{assignment.estimatedEffort}</DetailItem>
              <DetailItem label="Minimum score">{assignment.minScore}%</DetailItem>
              <DetailItem label="Attempts remaining">{assignment.attemptsRemaining}</DetailItem>
            </div>
          </div>
        </div>
    </>
  );
};

export default AssignmentSubmit;
