import { useState } from "react";
import { Modal } from "antd";
import { useNavigate } from "react-router-dom";
import { contentReports, type IContentReport } from "@/components/learner/learner.data";
import { LearnerButton, LearnerPage, PageHeader } from "@/components/learner/learner.ui";
import "./reports.scss";

const statusLabel: Record<IContentReport["status"], string> = {
  pending: "Pending",
  dismissed: "Dismissed",
  resolved: "Resolved",
};

const Reports = () => {
  const navigate = useNavigate();
  const [viewing, setViewing] = useState<IContentReport | undefined>(undefined);

  return (
    <LearnerPage className="learner-reports">
      <PageHeader
        eyebrow="LEARNER"
        title="My Reports"
        subtitle="Track the reports you submitted and their decisions."
      />
      <div className="learner-reports-card">
        <table className="learner-reports-table">
          <thead>
            <tr>
              <th>Reported item</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Decision</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {contentReports.map((report) => (
              <tr key={report.id}>
                <td>
                  <strong>{report.reportedItem}</strong>
                </td>
                <td>{report.submittedDate}</td>
                <td>{statusLabel[report.status]}</td>
                <td>{report.decision ?? "—"}</td>
                <td>
                  <div className="learner-reports-actions">
                    <LearnerButton onClick={() => setViewing(report)}>View report</LearnerButton>
                    {report.status === "dismissed" && (
                      <LearnerButton
                        onClick={() => navigate(`/learner/reports/${report.id}/escalate`)}
                      >
                        Escalate
                      </LearnerButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {contentReports.length === 0 && (
              <tr>
                <td colSpan={5}>You have not submitted any content reports yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Modal
        open={Boolean(viewing)}
        onCancel={() => setViewing(undefined)}
        footer={null}
        title="Report details"
      >
        {viewing && (
          <div className="learner-reports-modal">
            <p>
              Reported item: <strong>{viewing.reportedItem}</strong>
            </p>
            <p>
              Content type: <strong>{viewing.contentType}</strong>
            </p>
            <p>
              Course: <strong>{viewing.courseTitle}</strong>
            </p>
            <p>
              Status: <strong>{statusLabel[viewing.status]}</strong>
            </p>
            {viewing.decision && (
              <p>
                Organizer decision: <strong>{viewing.decision}</strong>
              </p>
            )}
            <p>Reason: {viewing.reason}</p>
          </div>
        )}
      </Modal>
    </LearnerPage>
  );
};

export default Reports;
