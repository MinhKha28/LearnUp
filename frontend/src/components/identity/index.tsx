import { Button, Result } from "antd";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useCurrentApp } from "@/components/context/app.context";
import type { UserRole } from "@/types/identity.types";
import { homePathForRole } from "@/utils/auth";

// Chỉ khi chạy vite dev: nhóm đang dùng danh tính giả (proxy D37 cho learner, x-dev-user-id cho tenant)
// thì không chặn, để vẫn code được các màn khi chưa đăng nhập thật. Bản build luôn kiểm tra.
const devIdentityBypass =
  import.meta.env.DEV &&
  (import.meta.env.VITE_DEV_IDENTITY_PROXY === "1" ||
    Boolean(import.meta.env.VITE_DEV_FAKE_USER_ID));

interface IProps {
  roles: UserRole[]; // các vai trò được vào khu này
  children: React.ReactNode;
}

// UC05: chặn khu làm việc khi chưa đăng nhập hoặc đăng nhập sai vai trò
const ProtectedRoute = ({ roles, children }: IProps) => {
  const { isAuthenticated, user } = useCurrentApp();
  const location = useLocation();

  if (devIdentityBypass) return <>{children}</>;
  // Chưa đăng nhập: về màn login, đăng nhập xong quay lại đúng trang đang định vào
  if (!isAuthenticated || !user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  // Sai vai trò (ví dụ Learner mở /admin): báo 403, chỉ đường về khu của mình
  if (!roles.includes(user.role)) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="You do not have access to this page."
        extra={
          <Link to={homePathForRole(user.role)}>
            <Button type="primary">Go to your workspace</Button>
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
