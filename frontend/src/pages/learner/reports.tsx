import { useState } from "react";
import { Modal } from "antd";
import { useNavigate } from "react-router-dom";
import { contentReports, type IContentReport } from "@/components/learner/learner.data";
import { LearnerButton, LearnerPage, PageHeader } from "@/components/learner/learner.ui";
import { reportContentTypeLabel, reportDecisionLabel } from "@/components/learner/report.labels";
import "./reports.scss";

const statusLabel: Record<IContentReport["status"], string> = {
  pending: "Chờ xem xét",
  dismissed: "Đã bác bỏ",
  resolved: "Đã xử lý",
};

const Reports = () => {
  const navigate = useNavigate();
  const [viewing, setViewing] = useState<IContentReport | undefined>(undefined);

  return (
    <LearnerPage className="learner-reports">
      <PageHeader
        eyebrow="Học viên"
        title="Báo cáo của tôi"
        subtitle="Theo dõi các báo cáo đã gửi và quyết định xử lý."
      />
      <div className="learner-reports-card">
        <table className="learner-reports-table">
          <thead>
            <tr>
              <th>Nội dung được báo cáo</th>
              <th>Đã nộp</th>
              <th>Trạng thái</th>
              <th>Quyết định</th>
              <th>Thao tác</th>
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
                <td>{report.decision ? reportDecisionLabel[report.decision] : "—"}</td>
                <td>
                  <div className="learner-reports-actions">
                    <LearnerButton onClick={() => setViewing(report)}>Xem báo cáo</LearnerButton>
                    {report.status === "dismissed" && (
                      <LearnerButton
                        onClick={() => navigate(`/learner/reports/${report.id}/escalate`)}
                      >
                        Chuyển cấp xử lý
                      </LearnerButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {contentReports.length === 0 && (
              <tr>
                <td colSpan={5}>Bạn chưa gửi báo cáo nội dung nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Modal
        open={Boolean(viewing)}
        onCancel={() => setViewing(undefined)}
        footer={null}
        title="Chi tiết báo cáo"
      >
        {viewing && (
          <div className="learner-reports-modal">
            <p>
              Nội dung được báo cáo: <strong>{viewing.reportedItem}</strong>
            </p>
            <p>
              Loại nội dung: <strong>{reportContentTypeLabel[viewing.contentType]}</strong>
            </p>
            <p>
              Khóa học: <strong>{viewing.courseTitle}</strong>
            </p>
            <p>
              Trạng thái: <strong>{statusLabel[viewing.status]}</strong>
            </p>
            {viewing.decision && (
              <p>
                Quyết định của Quản lý đào tạo: <strong>{reportDecisionLabel[viewing.decision]}</strong>
              </p>
            )}
            <p>Lý do: {viewing.reason}</p>
          </div>
        )}
      </Modal>
    </LearnerPage>
  );
};

export default Reports;
