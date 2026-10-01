import { CheckOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthCard, AuthResult } from "@/components/guest/auth";

export default function ActivationSuccess() {
  const navigate = useNavigate();
  // UC04: vai trò gửi kèm từ trang activate (mở thẳng URL thì không có → dùng chữ chung)
  const role = (useLocation().state as { role?: string } | null)?.role;

  return (
    <AuthCard>
      <AuthResult
        icon={<CheckOutlined />}
        tone="success"
        title="Account activated"
        action={
          <Button type="primary" onClick={() => navigate("/login")}>
            Continue to sign in
          </Button>
        }
      >
        <p>Your {role ?? "LearnUP"} account is ready to use.</p>
      </AuthResult>
    </AuthCard>
  );
}
