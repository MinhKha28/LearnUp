import { HomeOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ErrorPage from "@/components/layout/error.page";

const ServerErrorPage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPage
      tone="red"
      badgeLabel="System error"
      headerRight="LearnUP platform"
      title={
        <>
          We couldn&apos;t load
          <br />
          this page.
        </>
      }
      description={
        <>
          An unexpected error interrupted your request. Try again. If it continues, contact your
          workspace administrator.
        </>
      }
      primaryAction={{
        label: "Try again",
        icon: <ReloadOutlined />,
        onClick: () => window.location.reload(),
      }}
      secondaryAction={{ label: "Go to Home", icon: <HomeOutlined />, onClick: () => navigate("/") }}
      footnote="Your current request may need to be submitted again."
      errorCode="LearnUP / Error 500"
      illustration={
        <>
          <span className="error-page-illustration-circle error-page-illustration-circle-a" />
          <span className="error-page-illustration-tag error-page-illustration-tag-red">
            Request interrupted
          </span>
          <div className="error-page-illustration-body">
            <div className="error-page-illustration-panel">
              <div className="error-page-illustration-columns">
                {[0, 1, 2].map((column) => (
                  <div className="error-page-illustration-column" key={column}>
                    {[0, 1, 2].map((row) => (
                      <div className="error-page-illustration-row" key={row}>
                        <span
                          className={`error-page-illustration-row-dot${
                            column === 1 && row === 1 ? " error-page-illustration-row-dot-red" : ""
                          }`}
                        />
                        <span className="error-page-illustration-skeleton-row" style={{ flex: 1 }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="error-page-illustration-warning">
                <WarningOutlined />
              </div>
            </div>
          </div>
        </>
      }
    />
  );
};

export default ServerErrorPage;
