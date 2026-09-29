import { CloudOutlined, HomeOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ErrorPage from "@/components/layout/error.page";

const ServiceUnavailablePage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPage
      tone="amber"
      badgeLabel="Service unavailable"
      headerRight="LearnUP platform"
      title={
        <>
          LearnUP is
          <br />
          temporarily unavailable.
        </>
      }
      description={
        <>
          The service isn&apos;t available right now. Please try again in a little while.
        </>
      }
      primaryAction={{
        label: "Try again",
        icon: <ReloadOutlined />,
        onClick: () => window.location.reload(),
      }}
      secondaryAction={{ label: "Go to Home", icon: <HomeOutlined />, onClick: () => navigate("/") }}
      footnote="Please wait a moment before retrying."
      errorCode="LearnUP / Error 503"
      illustration={
        <>
          <span className="error-page-illustration-circle error-page-illustration-circle-a" />
          <span className="error-page-illustration-circle error-page-illustration-circle-b" />
          <div className="error-page-illustration-body">
            <CloudOutlined className="error-page-illustration-cloud" />
            <div className="error-page-illustration-status">
              <div className="error-page-illustration-status-row">
                <span className="error-page-illustration-status-dot" />
                <div>
                  <strong>Service temporarily offline</strong>
                  <p>Please try again shortly</p>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
};

export default ServiceUnavailablePage;
