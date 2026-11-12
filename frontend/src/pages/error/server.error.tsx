import { HomeOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ErrorPage from "@/components/layout/error.page";

const ServerErrorPage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPage
      tone="red"
      badgeLabel="Lỗi hệ thống"
      headerRight="Nền tảng LearnUP"
      title={
        <>
          Không tải được<br />trang này.
        </>
      }
      description={
        <>
          Đã xảy ra lỗi khi xử lý yêu cầu. Hãy thử lại. Nếu lỗi vẫn tiếp diễn, vui lòng liên hệ quản trị viên.
        </>
      }
      primaryAction={{
        label: "Thử lại",
        icon: <ReloadOutlined />,
        onClick: () => window.location.reload(),
      }}
      secondaryAction={{ label: "Về trang chủ", icon: <HomeOutlined />, onClick: () => navigate("/") }}
      footnote="Bạn có thể cần gửi lại yêu cầu."
      errorCode="LearnUP / Lỗi 500"
      illustration={
        <>
          <span className="error-page-illustration-circle error-page-illustration-circle-a" />
          <span className="error-page-illustration-tag error-page-illustration-tag-red">
            Yêu cầu bị gián đoạn
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
