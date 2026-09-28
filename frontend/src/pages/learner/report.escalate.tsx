import { useState } from "react";
import { Input, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { findContentReport } from "@/components/learner/learner.data";
import { LearnerButton, LearnerPage, PageHeader, SectionCard, StatusTag } from "@/components/learner/learner.ui";
import "./report.escalate.scss";

const ReportEscalate = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const report = findContentReport(reportId);
  const [reason, setReason] = useState("");

  if (!report || report.status !== "dismissed") {
    return (
      <LearnerPage className="report-escalate">
        <PageHeader
          eyebrow="MY REPORTS / ESCALATE"
          title="This report cannot be escalated"
          subtitle="Only dismissed reports can be sent to the platform Admin."
          back
        />
        <LearnerButton onClick={() => navigate("/learner/reports")}>Back to My Reports</LearnerButton>
      </LearnerPage>
    );
  }

  const submit = () => {
    if (!reason.trim()) {
      message.warning("Explain why this decision should be reviewed.");
      return;
    }
    message.success("Escalation sent to the platform Admin.");
    navigate("/learner/reports");
  };

  return (
    <LearnerPage className="report-escalate">
      <PageHeader
        eyebrow="MY REPORTS / ESCALATE"
        title="Escalate Report"
        subtitle="Ask the platform Admin to review a decision you disagree with."
        back
      />
      <div className="report-escalate-body">
        <div className="report-escalate-card">
          <StatusTag tone="neutral">Dismissed</StatusTag>
          <h3>{report.reportedItem}</h3>
          <p>Organizer decision: {report.decision}</p>
          <hr />
          <span>Reason for escalation</span>
          <Input.TextArea
            rows={6}
            placeholder="Explain why this decision should be reviewed..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="report-escalate-actions">
            <LearnerButton type="primary" onClick={submit}>
              Send to platform Admin
            </LearnerButton>
          </div>
        </div>
        <SectionCard title="Escalation" className="report-escalate-side">
          <p>Admin makes the final decision.</p>
          <p>You will see the result in My Reports when it is resolved.</p>
        </SectionCard>
      </div>
    </LearnerPage>
  );
};

export default ReportEscalate;
