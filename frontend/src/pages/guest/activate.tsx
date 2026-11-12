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
import { roleLabel } from "@/utils/helper";

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
    title: "Lời mời đã hết hạn",
    lines: [
      "Liên kết mời này đã hết hạn và không còn dùng được.",
      "Hãy liên hệ quản lý đào tạo để được gửi lời mời mới.",
    ],
  },
  revoked: {
    title: "Đã có lời mời mới hơn",
    lines: [
      "Liên kết này đã được thay bằng một lời mời mới hơn.",
      "Hãy mở email mời gần nhất.",
    ],
  },
  "not-pending": {
    title: "Không thể kích hoạt tài khoản này",
    lines: [
      "Tài khoản này không còn ở trạng thái chờ kích hoạt.",
      "Hãy liên hệ quản lý đào tạo để được hỗ trợ.",
    ],
  },
  invalid: {
    title: "Liên kết mời không dùng được",
    lines: [
      "Liên kết mời này không hợp lệ.",
      "Hãy kiểm tra bạn đã mở đủ liên kết trong email.",
    ],
  },
  network: {
    title: "Không tải được lời mời",
    lines: ["Không kết nối được với máy chủ. Vui lòng thử lại sau ít phút."],
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
          "Dịch vụ tài khoản đang tạm thời gián đoạn. Vui lòng thử lại sau.",
        );
      } else if (problemByCode[code]) {
        setState({ kind: "problem", problem: problemByCode[code] }); // liên kết hỏng giữa chừng
      } else {
        setSubmitError(
          "Không lưu được mật khẩu. Vui lòng kiểm tra lại rồi thử lại.",
        );
      }
    } catch {
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <AuthCard>
        <div className="activate-loading" role="status">
          <Spin size="large" />
          <p>Đang tải lời mời…</p>
        </div>
      </AuthCard>
    );
  }

  if (state.kind === "problem") {
    if (state.problem === "already-used") {
      return (
        <AuthCard>
          <AuthResult
            icon={<CheckOutlined aria-hidden="true" />}
            tone="success"
            title="Tài khoản đã được kích hoạt"
            action={
              <Button type="primary" onClick={() => navigate("/login")}>
                Tiếp tục đăng nhập
              </Button>
            }
          >
            <p>
              Lời mời này đã được sử dụng. Bạn có thể đăng nhập bằng tài khoản
              của mình.
            </p>
          </AuthResult>
        </AuthCard>
      );
    }
    const content = problemContent[state.problem];
    return (
      <AuthCard>
        <AuthResult
          icon={<ExclamationCircleFilled aria-hidden="true" />}
          title={content.title}
          action={
            state.problem === "network" ? (
              <Button type="primary" onClick={() => window.location.reload()}>
                Thử lại
              </Button>
            ) : (
              <Button onClick={() => navigate("/login")}>
                Quay lại đăng nhập
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
      <span className="auth-badge">Lời mời {roleLabel(invitation.role).toLowerCase()}</span>
      <h1>Kích hoạt tài khoản LearnUP</h1>
      <p>
        {invitation.organizationName} mời bạn tham gia không gian đào tạo của tổ
        chức.
        <br />
        Hãy đặt mật khẩu để kích hoạt tài khoản{" "}
        {roleLabel(invitation.role).toLowerCase()} này.
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
        <Form.Item label="Tổ chức">
          <Input value={invitation.organizationName} disabled />
        </Form.Item>
        <Form.Item label="Địa chỉ email">
          <Input value={invitation.email} disabled />
        </Form.Item>
        <Form.Item
          label="Mật khẩu"
          name="password"
          rules={[
            { required: true, message: "Hãy nhập mật khẩu." },
            { min: 8, message: "Mật khẩu cần ít nhất 8 ký tự." },
            { max: 72, message: "Mật khẩu tối đa 72 ký tự." },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="Nhập lại mật khẩu"
          name="confirm"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Hãy nhập lại mật khẩu." },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue("password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("Mật khẩu nhập lại không khớp."));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          Kích hoạt tài khoản
        </Button>
      </Form>
      <p className="auth-hint">Liên kết mời gắn với địa chỉ email này.</p>
    </AuthCard>
  );
}
