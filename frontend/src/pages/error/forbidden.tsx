import { ArrowLeftOutlined, HomeOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ErrorPage from "@/components/layout/error.page";

const ForbiddenPage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPage
      tone="blue"
      badgeLabel="Hạn chế truy cập"
      headerRight={
        <span className="error-page-header-signed-in">
          <span className="error-page-header-avatar">U</span>
          Đã đăng nhập
        </span>
      }
      title={
        <>
          Bạn không có quyền<br />truy cập trang này.
        </>
      }
      description={
        <>
          Vai trò của bạn chưa được cấp quyền truy cập trang này. Hãy quay lại hoặc liên hệ quản trị viên để được hỗ trợ.
        </>
      }
      primaryAction={{
        label: "Quay lại",
        icon: <ArrowLeftOutlined aria-hidden="true" />,
        onClick: () => navigate(-1),
      }}
      secondaryAction={{ label: "Về trang chủ", icon: <HomeOutlined aria-hidden="true" />, onClick: () => navigate("/") }}
      footnote="Quyền truy cập phụ thuộc vào vai trò và tổ chức của bạn."
      errorCode="LearnUP / Lỗi 403"
      illustration={
        <>
          <span className="error-page-illustration-circle error-page-illustration-circle-a" />
          <span className="error-page-illustration-tag error-page-illustration-tag-blue">
            Hạn chế truy cập
          </span>
          <div className="error-page-illustration-body">
            <div className="error-page-illustration-panel">
              <div className="error-page-illustration-skeleton-row" style={{ width: "70%", marginBottom: 16 }} />
              <div className="error-page-illustration-skeleton-row" style={{ width: "50%", marginBottom: 10 }} />
              <div className="error-page-illustration-skeleton-row" style={{ width: "60%", marginBottom: 20 }} />
              <div className="error-page-illustration-card">
                <span className="error-page-illustration-lock">
                  <LockOutlined aria-hidden="true" />
                </span>
                <span className="error-page-illustration-card-label">Cần có quyền truy cập</span>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
};

export default ForbiddenPage;
