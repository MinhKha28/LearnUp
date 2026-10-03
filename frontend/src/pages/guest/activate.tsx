import { useEffect, useState } from "react";
import { CheckOutlined, ExclamationCircleFilled } from "@ant-design/icons";
import { Alert, Button, Form, Input, Spin } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { AuthCard, AuthResult } from "@/components/guest/auth";
import "@/pages/guest/activate.scss";
import {
  acceptInvitationAPI,
  getInvitationAPI,
} from "@/services/organization.service";
import type { IApiError, IInvitationInfo } from "@/types/organization.types";

type ActivateFields = { password: string; confirm: string };

// UC04: các trạng thái của trang kích hoạt
type LinkProblem =
  | "expired"
  | "revoked"
  | "already-used"
  | "not-pending"
  | "invalid"
  | "network";
type PageState =
  | { kind: "loading" }
  | { kind: "ready"; invitation: IInvitationInfo }
  | { kind: "problem"; problem: LinkProblem };

// Mã lỗi backend (AccountTokensService.findUsable, InvitationsService.accept) → màn lỗi
const problemByCode: Record<string, LinkProblem> = {
  LINK_EXPIRED: "expired",
  LINK_REVOKED: "revoked",
  LINK_ALREADY_USED: "already-used",
  ACCOUNT_NOT_PENDING: "not-pending",
  INVALID_LINK: "invalid",
};

const problemContent: Record<
  Exclude<LinkProblem, "already-used">,
  { title: string; lines: string[] }
> = {
  expired: {
    title: "Invitation link expired",
    lines: [
      "This invitation link has expired and can no longer be used.",
      "Contact your Organizer to receive a new invitation.",
    ],
  },
  revoked: {
    title: "A newer invitation was sent",
    lines: [
      "This link was replaced by a newer invitation.",
      "Please open the most recent invitation email.",
    ],
  },
  "not-pending": {
    title: "This account cannot be activated",
    lines: [
      "The account is no longer waiting for activation.",
      "Contact your Organizer for help.",
    ],
  },
  invalid: {
    title: "Invitation link unavailable",
    lines: [
      "This invitation link is not valid.",
      "Check that you opened the complete link from your email.",
    ],
  },
  network: {
    title: "Could not load the invitation",
    lines: ["Could not connect to the server. Please try again in a moment."],
  },
};

const readErrorCode = (res: unknown) =>
  (res as { error?: IApiError }).error?.code ?? "";

export default function ActivatePage() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<ActivateFields>();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ① Mở trang: hỏi backend lời mời này của ai, tổ chức nào, vai trò gì
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getInvitationAPI(token);
        if (res.data) {
          setState({ kind: "ready", invitation: res.data });
        } else {
          setState({
            kind: "problem",
            problem: problemByCode[readErrorCode(res)] ?? "invalid",
          });
        }
      } catch {
        setState({ kind: "problem", problem: "network" });
      }
    };
    load();
  }, [token]);

  // ② Đặt mật khẩu → kích hoạt tài khoản
  async function submit(values: ActivateFields) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await acceptInvitationAPI({
        token,
        password: values.password,
      });
      if (res.data) {
        navigate(`/activate/${token}/success`, {
          state: { role: res.data.role },
        });
        return;
      }
      const code = readErrorCode(res);
      if (code === "IDENTITY_UNAVAILABLE") {
        setSubmitError(
          "The account service is temporarily unavailable. Please try again later.",
        );
      } else if (problemByCode[code]) {
        setState({ kind: "problem", problem: problemByCode[code] }); // liên kết hỏng giữa chừng
      } else {
        setSubmitError(
          "The password could not be saved. Please review it and try again.",
        );
      }
    } catch {
      setSubmitError(
        "Could not connect to the server. Please try again later.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <AuthCard>
        <div className="activate-loading" role="status">
          <Spin size="large" />
          <p>Loading your invitation…</p>
        </div>
      </AuthCard>
    );
  }

  if (state.kind === "problem") {
    if (state.problem === "already-used") {
      return (
        <AuthCard>
          <AuthResult
            icon={<CheckOutlined />}
            tone="success"
            title="Account already activated"
            action={
              <Button type="primary" onClick={() => navigate("/login")}>
                Continue to sign in
              </Button>
            }
          >
            <p>
              This invitation has already been used. You can sign in with your
              account.
            </p>
          </AuthResult>
        </AuthCard>
      );
    }
    const content = problemContent[state.problem];
    return (
      <AuthCard>
        <AuthResult
          icon={<ExclamationCircleFilled />}
          title={content.title}
          action={
            state.problem === "network" ? (
              <Button type="primary" onClick={() => window.location.reload()}>
                Try again
              </Button>
            ) : (
              <Button onClick={() => navigate("/login")}>
                Back to sign in
              </Button>
            )
          }
        >
          {content.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </AuthResult>
      </AuthCard>
    );
  }

  const { invitation } = state;
  return (
    <AuthCard>
      <span className="auth-badge">
        INVITED {invitation.role.toUpperCase()}
      </span>
      <h1>Activate your LearnUP account</h1>
      <p>
        {invitation.organizationName} invited you to join its training
        workspace.
        <br />
        Set your password to activate this {invitation.role} account.
      </p>
      {submitError && (
        <Alert
          className="activate-alert"
          type="error"
          showIcon
          message={submitError}
        />
      )}
      <Form<ActivateFields>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ password: "", confirm: "" }}
        onFinish={submit}
      >
        <Form.Item label="Organization">
          <Input value={invitation.organizationName} disabled />
        </Form.Item>
        <Form.Item label="Email address">
          <Input value={invitation.email} disabled />
        </Form.Item>
        <Form.Item
          label="Password"
          name="password"
          rules={[
            { required: true, message: "Enter a password." },
            { min: 8, message: "Use at least 8 characters." },
            { max: 72, message: "Use at most 72 characters." },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="Confirm password"
          name="confirm"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Confirm your password." },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue("password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("Passwords do not match"));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          Activate account
        </Button>
      </Form>
      <p className="auth-hint">
        The invitation link is associated with this email address.
      </p>
    </AuthCard>
  );
}
