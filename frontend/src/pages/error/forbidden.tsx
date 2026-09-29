import { ArrowLeftOutlined, HomeOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ErrorPage from "@/components/layout/error.page";

const ForbiddenPage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPage
      tone="blue"
      badgeLabel="Access restricted"
      headerRight={
        <span className="error-page-header-signed-in">
          <span className="error-page-header-avatar">U</span>
          Signed in
        </span>
      }
      title={
        <>
          You don&apos;t have
          <br />
          access to this page.
        </>
      }
      description={
        <>
          Your account is signed in, but this page isn&apos;t available to your role. Go back or
          contact your workspace administrator if you believe you should have access.
        </>
      }
      primaryAction={{
        label: "Go back",
        icon: <ArrowLeftOutlined />,
        onClick: () => navigate(-1),
      }}
      secondaryAction={{ label: "Go to Home", icon: <HomeOutlined />, onClick: () => navigate("/") }}
      footnote="Access depends on your assigned role and organization."
      errorCode="LearnUP / Error 403"
      illustration={
        <>
          <span className="error-page-illustration-circle error-page-illustration-circle-a" />
          <span className="error-page-illustration-tag error-page-illustration-tag-blue">
            Restricted
          </span>
          <div className="error-page-illustration-body">
            <div className="error-page-illustration-panel">
              <div className="error-page-illustration-skeleton-row" style={{ width: "70%", marginBottom: 16 }} />
              <div className="error-page-illustration-skeleton-row" style={{ width: "50%", marginBottom: 10 }} />
              <div className="error-page-illustration-skeleton-row" style={{ width: "60%", marginBottom: 20 }} />
              <div className="error-page-illustration-card">
                <span className="error-page-illustration-lock">
                  <LockOutlined />
                </span>
                <span className="error-page-illustration-card-label">Role access required</span>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
};

export default ForbiddenPage;
