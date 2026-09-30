import { ArrowLeftOutlined, FileSearchOutlined, HomeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ErrorPage from "@/components/layout/error.page";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPage
      tone="amber"
      badgeLabel="Page not found"
      headerRight="LearnUP platform"
      title={
        <>
          This page isn&apos;t
          <br />
          on the map.
        </>
      }
      description={
        <>
          The link may be outdated or the address may have a typo. Check the URL, or return to
          the LearnUP home page.
        </>
      }
      primaryAction={{ label: "Go to Home", icon: <HomeOutlined />, onClick: () => navigate("/") }}
      secondaryAction={{
        label: "Go back",
        icon: <ArrowLeftOutlined />,
        onClick: () => navigate(-1),
      }}
      footnote="You can also use your browser's Back button."
      errorCode="LearnUP / Error 404"
      illustration={
        <>
          <span className="error-page-illustration-circle error-page-illustration-circle-a" />
          <span className="error-page-illustration-circle error-page-illustration-circle-b" />
          <span className="error-page-illustration-dot error-page-illustration-dot-amber" style={{ bottom: 60, left: 40 }} />
          <span className="error-page-illustration-dot error-page-illustration-dot-dark" style={{ top: 100, right: 60 }} />
          <div className="error-page-illustration-body">
            <div className="error-page-illustration-panel">
              <div className="error-page-illustration-urlbar">
                <span className="error-page-illustration-urlbar-dot" />
                /workspace/course/...
              </div>
              <div className="error-page-illustration-card">
                <FileSearchOutlined style={{ color: "var(--color-accent)" }} />
                <span className="error-page-illustration-card-label">Page not found</span>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
};

export default NotFoundPage;
