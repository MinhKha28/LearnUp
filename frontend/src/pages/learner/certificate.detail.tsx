import { useNavigate, useParams } from "react-router-dom";
import {
  getCertificate,
  certificateDate,
} from "@/services/achievement.service";
import { useApiQuery } from "@/hooks/use.api.query";
import { useCertificateDownload } from "@/hooks/use.certificate.download";
import {
  DetailItem,
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatusTag,
} from "@/components/learner/learner.ui";
import {
  LearnerSkeleton,
  LearnerEmptyState,
  LearnerErrorState,
} from "@/components/learner/learner.states";
import "./certificate.detail.scss";
const CertificateDetail = () => {
  const { certificateId = "" } = useParams();
  const navigate = useNavigate();
  const query = useApiQuery(
    (signal) => getCertificate(certificateId, signal),
    [certificateId],
  );
  const downloads = useCertificateDownload();
  const certificate = query.data;
  return (
    <LearnerPage className="certificate-detail">
      <LearnerButton onClick={() => navigate("/learner/certificates")}>
        Về danh sách chứng chỉ
      </LearnerButton>
      <PageHeader
        title="Chi tiết chứng chỉ"
        subtitle="Thông tin được chốt tại thời điểm cấp chứng chỉ."
        actions={
          certificate && (
            <LearnerButton
              type="primary"
              loading={downloads.busy.has(certificateId)}
              disabled={downloads.busy.has(certificateId)}
              onClick={() => void downloads.download(certificateId)}
            >
              Tải PDF
            </LearnerButton>
          )
        }
      />
      {query.status === "loading" && <LearnerSkeleton variant="detail" />}
      {query.status === "error" &&
        (query.error.status === 404 ? (
          <LearnerEmptyState
            title="Không tìm thấy chứng chỉ"
            description="Chứng chỉ không tồn tại hoặc không thuộc tài khoản của bạn."
          />
        ) : (
          <LearnerErrorState error={query.error} onRetry={query.reload} />
        ))}
      {downloads.messages[certificateId] && (
        <p role="status">{downloads.messages[certificateId]}</p>
      )}
      {certificate && (
        <div className="certificate-detail-card">
          <strong className="certificate-detail-brand">
            {certificate.organizationName}
          </strong>
          <h2>Chứng chỉ hoàn thành</h2>
          <span>Chứng nhận học viên</span>
          <strong className="certificate-detail-name">
            {certificate.recipient}
          </strong>
          <p className="certificate-detail-course">
            {certificate.courseTitle} · Phiên bản {certificate.versionNumber}
          </p>
          <StatusTag tone={certificate.completedLate ? "warning" : "success"}>
            {certificate.completedLate
              ? "Hoàn thành sau hạn"
              : "Hoàn thành đúng hạn"}
          </StatusTag>
          <div className="certificate-detail-meta">
            <DetailItem label="Ngày cấp">
              {certificateDate(certificate.issuedDate)}
            </DetailItem>
            <DetailItem label="Mã chứng chỉ">
              {certificate.certificateCode}
            </DetailItem>
          </div>
          {certificate.signerName && <p>{certificate.signerName}</p>}
          {certificate.signerTitle && <p>{certificate.signerTitle}</p>}
        </div>
      )}
    </LearnerPage>
  );
};
export default CertificateDetail;
