import { GoldOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { certificates } from "@/components/learner/learner.data";
import { InfoPanel, LearnerButton, LearnerPage, PageHeader } from "@/components/learner/learner.ui";
import "./certificates.scss";

const Certificates = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Demo-only: append ?empty=1 to preview the empty state without earned Certificates.
  const forceEmpty = searchParams.get("empty") === "1";
  const list = forceEmpty ? [] : certificates;
  const hasCertificates = list.length > 0;

  return (
    <LearnerPage className="learner-certificates">
      <PageHeader
        eyebrow="LEARNER"
        title="My Certificates"
        subtitle={
          hasCertificates
            ? "Issued Certificates for completed Course versions."
            : "Your issued Certificates will appear here."
        }
      />
      {hasCertificates ? (
        <>
          <InfoPanel title="Keep a copy">
            You can download each issued Certificate as a PDF.
          </InfoPanel>
          <div className="learner-certificates-card">
            <table className="learner-certificates-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Version</th>
                  <th>Issued</th>
                  <th>Completion</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((certificate) => (
                  <tr key={certificate.id}>
                    <td>
                      <strong>{certificate.courseTitle}</strong>
                    </td>
                    <td>{certificate.version}</td>
                    <td>{certificate.issuedDate}</td>
                    <td>{certificate.completionLabel}</td>
                    <td>
                      <LearnerButton
                        onClick={() => navigate(`/learner/certificates/${certificate.id}`)}
                      >
                        View Certificate
                      </LearnerButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="learner-certificates-empty">
          <div className="learner-certificates-empty-icon">
            <GoldOutlined />
          </div>
          <h2>No Certificates yet</h2>
          <p>Complete all required Course conditions to receive a Certificate.</p>
          <LearnerButton onClick={() => navigate("/learner/courses")}>
            View My Courses
          </LearnerButton>
        </div>
      )}
    </LearnerPage>
  );
};

export default Certificates;
