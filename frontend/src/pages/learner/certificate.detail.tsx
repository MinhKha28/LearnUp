import { useNavigate, useParams } from "react-router-dom";
import { findCertificate } from "@/components/learner/learner.data";
import { DetailItem, LearnerButton, LearnerPage, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import "./certificate.detail.scss";

const CertificateDetail = () => {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const certificate = findCertificate(certificateId);
  const learnerName = "Alex Morgan";

  if (!certificate) {
    return (
      <LearnerPage className="certificate-detail">
        <PageHeader eyebrow="CERTIFICATES / DETAIL" title="Certificate not found" subtitle="" back />
        <LearnerButton onClick={() => navigate("/learner/certificates")}>
          Back to My Certificates
        </LearnerButton>
      </LearnerPage>
    );
  }

  const downloadCertificate = () => {
    const content = [
      "LEARNUP",
      "Certificate of Completion",
      `Awarded to: ${learnerName}`,
      `${certificate.courseTitle} • Course version ${certificate.version}`,
      certificate.completionLabel,
      `Completion date: ${certificate.completionDate}`,
      `Issue date: ${certificate.issuedDate}`,
      `Certificate ID: ${certificate.certificateId}`,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${certificate.certificateId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <LearnerPage className="certificate-detail">
      <PageHeader
        eyebrow="CERTIFICATES / DETAIL"
        title="Certificate Details"
        subtitle={`Issued Certificate / Course version ${certificate.version}`}
        back
        actions={
          <LearnerButton type="primary" onClick={downloadCertificate}>
            Download PDF
          </LearnerButton>
        }
      />
      <div className="certificate-detail-card">
        <span className="certificate-detail-bar" />
        <span className="certificate-detail-brand">LEARNUP</span>
        <h2>Certificate of Completion</h2>
        <span className="certificate-detail-awarded">Awarded to</span>
        <strong className="certificate-detail-name">{learnerName}</strong>
        <p className="certificate-detail-course">
          {certificate.courseTitle} • Course version {certificate.version}
        </p>
        <StatusTag tone={certificate.completionLabel === "On time" ? "success" : "warning"}>
          {certificate.completionLabel}
        </StatusTag>
        <hr />
        <div className="certificate-detail-meta">
          <DetailItem label="Completion date">{certificate.completionDate}</DetailItem>
          <DetailItem label="Issue date">{certificate.issuedDate}</DetailItem>
          <DetailItem label="Certificate ID">{certificate.certificateId}</DetailItem>
        </div>
      </div>
    </LearnerPage>
  );
};

export default CertificateDetail;
