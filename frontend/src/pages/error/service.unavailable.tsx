import { CloudOutlined, HomeOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ErrorPage from "@/components/layout/error.page";

const ServiceUnavailablePage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPage
      tone="amber"
      badgeLabel="Dịch vụ gián đoạn"
      headerRight="Nền tảng LearnUP"
      title={
        <>
          LearnUP đang<br />tạm thời gián đoạn.
        </>
      }
      description={
        <>
          Hiện chưa thể sử dụng dịch vụ. Vui lòng thử lại sau ít phút.
        </>
      }
      primaryAction={{
        label: "Thử lại",
        icon: <ReloadOutlined />,
        onClick: () => window.location.reload(),
      }}
      secondaryAction={{ label: "Về trang chủ", icon: <HomeOutlined />, onClick: () => navigate("/") }}
      footnote="Vui lòng đợi một lúc rồi thử lại."
      errorCode="LearnUP / Lỗi 503"
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
                  <strong>Dịch vụ đang tạm ngưng</strong>
                  <p>Vui lòng thử lại sau ít phút</p>
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
