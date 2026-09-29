import { useState } from "react";
import { Input, Upload, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { courseDetails, findAssignment } from "@/components/learner/learner.data";
import { LearnerButton, PageHeader, WarningPanel } from "@/components/learner/learner.ui";
import "./assignment.resubmit.scss";

const AssignmentResubmit = () => {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const assignment = course ? findAssignment(course, assignmentId) : undefined;
  const [answer, setAnswer] = useState(assignment?.submission?.answer ?? "");
  const [fileName, setFileName] = useState<string | undefined>(assignment?.submission?.fileName);

  if (!course || !assignment) {
    return null;
  }

  const resubmit = () => {
    if (!answer.trim()) {
      message.warning("Update your answer before resubmitting.");
      return;
    }
    navigate(`/learner/courses/${course.id}/assignments/${assignment.id}/submitted`);
  };

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / RESUBMIT"
        title={`Resubmit ${assignment.title}`}
        subtitle="Your new submission replaces the current recorded version."
        back
      />
      <div className="course-learning-main">
          <div className="course-learning-content assignment-resubmit-card">
            <WarningPanel title="Latest submission rule">
              The new submission becomes the recorded Assignment attempt.
            </WarningPanel>
            <h3>Revised answer</h3>
            <Input.TextArea
              rows={8}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Enter your updated answer..."
            />
            <Upload.Dragger
              multiple={false}
              beforeUpload={(file) => {
                setFileName(file.name);
                return false;
              }}
              showUploadList={false}
              className="assignment-resubmit-upload"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Replace or attach files</p>
              {fileName && <p className="ant-upload-hint">Attached: {fileName}</p>}
            </Upload.Dragger>
            <div className="assignment-resubmit-actions">
              <LearnerButton type="primary" onClick={resubmit}>
                Resubmit
              </LearnerButton>
            </div>
          </div>
          <div className="course-learning-side">
            <div className="assignment-resubmit-info">
              <h3>Submission handling</h3>
              <p>
                If the original peer review cycle has closed, the Instructor grades the resubmission
                directly.
              </p>
              <hr />
              <p>If the cycle remains open, the new submission enters the current open cycle.</p>
            </div>
          </div>
        </div>
    </>
  );
};

export default AssignmentResubmit;
