import { CheckOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { AuthCard, AuthResult } from "@/components/guest/auth";

export default function ActivationSuccess() {
  const navigate = useNavigate();

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
        <p>Your Learner account is ready to use.</p>
      </AuthResult>
    </AuthCard>
  );
}
