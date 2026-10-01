import { useEffect, useRef, useState } from "react";
import { CheckOutlined, ExclamationOutlined } from "@ant-design/icons";
import { Button, Spin } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard, AuthResult } from "@/components/guest/auth";
import "@/pages/guest/verify.email.scss";
import { verifyEmailAPI } from "@/services/organization.service";
import type { IApiError, IVerifyEmailResult } from "@/types/organization.types";

// UC03: các kết quả có thể có của việc xác thực email Organizer
type VerifyState =
  | { kind: "loading" }
  | { kind: "verified"; result: IVerifyEmailResult }
  | { kind: "already-used" | "expired" | "revoked" | "invalid" | "network" };

// Mã lỗi backend (AccountTokensService.findUsable) → trạng thái màn hình
const errorKinds: Record<string, VerifyState["kind"]> = {
  LINK_ALREADY_USED: "already-used",
  LINK_EXPIRED: "expired",
  LINK_REVOKED: "revoked",
};

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerifyState>({ kind: "loading" });
  // React StrictMode (dev) chạy effect 2 lần; liên kết chỉ dùng được 1 lần → chặn lần gọi thứ hai
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    const verify = async () => {
      try {
        const res = await verifyEmailAPI(token);
        if (res.data) {
          setState({ kind: "verified", result: res.data });
          return;
        }
        const code =
          (res as unknown as { error?: IApiError }).error?.code ?? "";
        setState({ kind: errorKinds[code] ?? "invalid" } as VerifyState);
      } catch {
        setState({ kind: "network" });
      }
    };
    verify();
  }, [token]);

  if (state.kind === "loading") {
    return (
      <AuthCard>
        <div className="verify-email-loading" role="status">
          <Spin size="large" />
          <p>Verifying your email…</p>
        </div>
      </AuthCard>
    );
  }

  const signIn = (
    <Button type="primary" onClick={() => navigate("/login")}>
      Continue to sign in
    </Button>
  );
  const backHome = <Button onClick={() => navigate("/")}>Back to home</Button>;

  if (state.kind === "verified") {
    return (
      <AuthCard>
        <AuthResult
          icon={<CheckOutlined />}
          tone="success"
          title="Email verified"
          action={signIn}
        >
          <p>The Organizer account {state.result.email} is now active.</p>
          <p>Organization: {state.result.organizationName}</p>
        </AuthResult>
      </AuthCard>
    );
  }

  if (state.kind === "already-used") {
    return (
      <AuthCard>
        <AuthResult
          icon={<CheckOutlined />}
          tone="success"
          title="Email already verified"
          action={signIn}
        >
          <p>
            This verification link has already been used. You can sign in with
            your Organizer account.
          </p>
        </AuthResult>
      </AuthCard>
    );
  }

  const failures = {
    expired: {
      title: "Verification link expired",
      text: "This verification link has expired and can no longer be used. A new verification link is needed to activate the Organizer account.",
      action: backHome,
    },
    revoked: {
      title: "A newer link was sent",
      text: "This verification link was replaced by a newer one. Please open the most recent verification email.",
      action: backHome,
    },
    invalid: {
      title: "Verification link is invalid",
      text: "Check that you opened the complete link from your verification email.",
      action: backHome,
    },
    network: {
      title: "Could not verify right now",
      text: "Could not connect to the server. Please try again in a moment.",
      action: (
        <Button type="primary" onClick={() => window.location.reload()}>
          Try again
        </Button>
      ),
    },
  }[state.kind];

  return (
    <AuthCard>
      <AuthResult
        icon={<ExclamationOutlined />}
        tone="warning"
        title={failures.title}
        action={failures.action}
      >
        <p>{failures.text}</p>
      </AuthResult>
    </AuthCard>
  );
}
