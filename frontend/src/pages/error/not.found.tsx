import { ArrowLeftOutlined, FileSearchOutlined, HomeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ErrorPage from "@/components/layout/error.page";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPage
      tone="amber"
      badgeLabel="Không tìm thấy trang"
      headerRight="Nền tảng LearnUP"
      title={
        <>
          Không tìm thấy<br />trang này.
        </>
      }
      description={
        <>
          Đường dẫn có thể đã hết hiệu lực hoặc được nhập sai. Hãy kiểm tra địa chỉ hoặc về trang chủ LearnUP.
        </>
      }
      primaryAction={{ label: "Về trang chủ", icon: <HomeOutlined aria-hidden="true" />, onClick: () => navigate("/") }}
      secondaryAction={{
        label: "Quay lại",
        icon: <ArrowLeftOutlined aria-hidden="true" />,
        onClick: () => navigate(-1),
      }}
      footnote="Bạn cũng có thể dùng nút Quay lại của trình duyệt."
      errorCode="LearnUP / Lỗi 404"
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
                /…
              </div>
              <div className="error-page-illustration-card">
                <FileSearchOutlined aria-hidden="true" style={{ color: "var(--color-accent)" }} />
                <span className="error-page-illustration-card-label">Không tìm thấy trang</span>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
};

export default NotFoundPage;
