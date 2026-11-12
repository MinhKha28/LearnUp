import { CheckOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthCard, AuthResult } from "@/components/guest/auth";
import { roleLabel } from "@/utils/helper";

export default function ActivationSuccess() {
  const navigate = useNavigate();
  // UC04: vai trò gửi kèm từ trang activate (mở thẳng URL thì không có → dùng chữ chung)
  const role = (useLocation().state as { role?: string } | null)?.role;

  return (
    <AuthCard>
      <AuthResult
        icon={<CheckOutlined aria-hidden="true" />}
        tone="success"
        title="Đã kích hoạt tài khoản"
        action={
          <Button type="primary" onClick={() => navigate("/login")}>
            Tiếp tục đăng nhập
          </Button>
        }
      >
        <p>
          Tài khoản {role ? roleLabel(role).toLowerCase() : "LearnUP"} của bạn
          đã sẵn sàng sử dụng.
        </p>
      </AuthResult>
    </AuthCard>
  );
}
