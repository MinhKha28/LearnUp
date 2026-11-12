import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Form, Input, Spin } from "antd";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import PlanCard from "@/components/guest/registration/plan.card";
import RegistrationSteps from "@/components/guest/registration/registration";
import "@/pages/guest/register.scss";
import {
  createRegistrationAPI,
  getRegistrationByTokenAPI,
  getSubscriptionPlansAPI,
  payRegistrationAPI,
  resendRegistrationEmailAPI,
  verifyEmailOtpAPI,
} from "@/services/organization.service";
import type {
  IApiError,
  ICreateRegistrationReq,
  IRegistrationSummary,
  ISubscriptionPlan,
} from "@/types/organization.types";

import { formatVnd, toPlanDetails } from "@/utils/helper";

type OrganizationFields = {
  name: string;
  taxCode: string;
  contactPhone: string;
  address: string;
};
type OrganizerFields = { fullName: string; email: string; password: string };
type RegistrationDraft = {
  organization: OrganizationFields;
  organizer: Omit<OrganizerFields, "password">;
};
// UC03: thông tin lần gửi mã gần nhất (để hiện email và đếm ngược hạn mã)
type VerificationInfo = { email: string; ttlMinutes: number; sentAt: number };

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_MS = 60 * 1000; // chống bấm "Gửi lại mã" liên tục ở phía giao diện

const emptyOrganization: OrganizationFields = {
  name: "",
  taxCode: "",
  contactPhone: "",
  address: "",
};

const titles: Record<
  string,
  { eyebrow: string; title: string; description: string }
> = {
  plans: {
    eyebrow: "Bước 1/5",
    title: "Chọn gói phù hợp với tổ chức của bạn",
    description: "So sánh thời hạn và giới hạn của các gói trước khi đăng ký.",
  },
  organization: {
    eyebrow: "Bước 2/5",
    title: "Thông tin tổ chức",
    description: "Cho chúng tôi biết về tổ chức sẽ sử dụng LearnUP.",
  },
  organizer: {
    eyebrow: "Bước 3/5",
    title: "Tài khoản quản lý đào tạo",
    description: "Tạo tài khoản cho người sẽ quản lý đào tạo của tổ chức.",
  },
  "account-review": {
    eyebrow: "Bước 3/5",
    title: "Kiểm tra thông tin tài khoản",
    description: "Sửa các ô được đánh dấu để tiếp tục.",
  },
  "verify-email": {
    eyebrow: "Bước 4/5",
    title: "Xác thực email",
    description:
      "Nhập mã 6 chữ số chúng tôi đã gửi để xác thực email của quản lý đào tạo trước khi thanh toán.",
  },
  payment: {
    eyebrow: "Bước 5/5",
    title: "Thanh toán mô phỏng",
    description:
      "Kiểm tra thông tin đăng ký và thanh toán qua dịch vụ mô phỏng.",
  },
  "payment-failed": {
    eyebrow: "Bước 5/5",
    title: "Thanh toán không thành công",
    description:
      "Đăng ký của bạn vẫn đang chờ thanh toán nên bạn có thể thử lại.",
  },
  "pending-payment": {
    eyebrow: "Bước 5/5",
    title: "Chờ thanh toán",
    description: "Đăng ký này vẫn còn hiệu lực và đang chờ thanh toán.",
  },
  "payment-completed": {
    eyebrow: "Đã hoàn tất đăng ký",
    title: "Đã thanh toán",
    description:
      "Tổ chức và tài khoản quản lý đào tạo của bạn đã được kích hoạt.",
  },
  "no-plans": {
    eyebrow: "Các gói",
    title: "Chọn gói cho tổ chức của bạn",
    description: "",
  },
};

const resultContent = {
  "payment-failed": {
    icon: "×",
    tone: "error",
    title: "Chưa thanh toán được",
    text: "Dịch vụ thanh toán mô phỏng đã từ chối giao dịch.",
    action: "Thử thanh toán lại",
    to: "/register/payment",
  },
  "registration-expired": {
    icon: "!",
    tone: "warning",
    title: "Đăng ký đã hết hạn",
    text: "Đăng ký đang chờ thanh toán đã quá thời hạn hiệu lực.",
    action: "Xem các gói đang cung cấp",
    to: "/register",
  },
  "payment-completed": {
    icon: "✓",
    tone: "success",
    title: "Không gian làm việc đã sẵn sàng",
    text: "Gói dịch vụ đã bắt đầu và tài khoản quản lý đào tạo đã được kích hoạt.",
    action: "Đăng nhập",
    to: "/login",
  },
  "no-plans": {
    icon: "i",
    tone: "info",
    title: "Hiện chưa có gói nào",
    text: "Vui lòng quay lại sau hoặc liên hệ đội ngũ LearnUP.",
    action: "Về trang chủ",
    to: "/",
  },
} as const;

type ResultScreen = keyof typeof resultContent;

// BR-4: Các bước khai thông tin cần đã chọn gói (chọn gói trước rồi mới khai thông tin).
// Màn thanh toán không cần: gói và giá lấy từ đăng ký đã tạo (UC02.1).
const screensNeedingPlan = ["organization", "organizer", "account-review"];

const isResult = (screen: string): screen is ResultScreen =>
  Object.hasOwn(resultContent, screen);

export default function RegisterPage() {
  const { screen = "plans" } = useParams<{ screen: string }>();
  const navigate = useNavigate();
  const [organizationForm] = Form.useForm<OrganizationFields>();
  const [organizerForm] = Form.useForm<OrganizerFields>();
  const [draft, setDraft] = useState<RegistrationDraft>({
    organization: emptyOrganization,
    organizer: { fullName: "", email: "" },
  });
  const [accountError, setAccountError] = useState(screen === "account-review");
  const [paying, setPaying] = useState(false);
  // UC01: danh sách gói, trạng thái tải, lỗi, gói đã chọn
  const [plans, setPlans] = useState<ISubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  // UC01: nếu đi từ trang chủ (bấm "Chọn gói ...") thì gói được gửi kèm qua router state
  const location = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<ISubscriptionPlan | null>(
    () => (location.state as { plan?: ISubscriptionPlan } | null)?.plan ?? null,
  );
  // UC02: trạng thái gửi đăng ký
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailInUse, setEmailInUse] = useState(false); // UC02 trường hợp F: 409 EMAIL_ALREADY_USED
  const [verification, setVerification] = useState<VerificationInfo | null>(
    null,
  );
  // UC03: ô nhập mã, trạng thái gửi mã, lỗi, đồng hồ đếm ngược
  const [otp, setOtp] = useState("");
  const [otpReady, setOtpReady] = useState(false); // đủ 6 ô thì mới cho bấm "Xác thực email"
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resentNotice, setResentNotice] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // UC03 → UC02.1: token thanh toán, chỉ có sau khi nhập mã đúng (hoặc mở liên kết trong email)
  const [paymentToken, setPaymentToken] = useState<string | null>(null);
  // UC02.1: tóm tắt đăng ký (lấy từ backend theo token) và trạng thái thanh toán
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<IRegistrationSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false); // chỉ hiện khi chạy dev

  const account = screen === "organizer" || screen === "account-review";
  const standalone = ["registration-expired", "no-plans"].includes(screen);
  const showProgress = !["plans", "registration-expired", "no-plans"].includes(
    screen,
  );
  // Thứ tự mới (BR-6): chọn gói → tổ chức → Organizer → xác thực email → thanh toán
  const current =
    screen === "plans"
      ? 0
      : screen === "payment-completed"
        ? 5 // cả 5 bước đều có dấu ✓
        : screen.includes("payment")
          ? 4
          : screen === "verify-email"
            ? 3
            : account
              ? 2
              : 1;
  const heading = titles[account && accountError ? "account-review" : screen];
  const email =
    summary?.organizerEmail ||
    draft.organizer.email ||
    "[Email quản lý đào tạo]";
  // Gói hiển thị bên phải: ở màn thanh toán dùng gói đã chốt trong đăng ký, trước đó dùng gói vừa chọn
  const displayPlan: ISubscriptionPlan | null = summary
    ? { id: summary.registrationId, ...summary.plan }
    : selectedPlan;

  useEffect(() => {
    window.scrollTo(0, 0);
    setAccountError(screen === "account-review");
    if (screen === "account-review") {
      organizerForm.setFields([
        {
          name: "fullName",
          value: draft.organizer.fullName || "Nguyễn Văn An",
        },
        {
          name: "email",
          value: "invalid-email",
          errors: ["Địa chỉ email không hợp lệ."],
        },
        { name: "password", value: "", errors: ["Hãy nhập mật khẩu."] },
      ]);
    }
  }, [screen, organizerForm, draft.organizer.fullName]);

  // UC01: vào bước chọn gói thì gọi API lấy các gói đang được cung cấp
  useEffect(() => {
    if (screen !== "plans") return;
    const loadPlans = async () => {
      setLoadingPlans(true);
      setPlanError(null);
      try {
        const res = await getSubscriptionPlansAPI();
        if (!res.data) {
          setPlanError("Không tải được danh sách gói. Vui lòng thử lại.");
        } else if (res.data.length === 0) {
          navigate("/register/no-plans", { replace: true });
        } else {
          setPlans(res.data);
        }
      } catch {
        setPlanError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
      } finally {
        setLoadingPlans(false);
      }
    };
    loadPlans();
  }, [screen, navigate]);

  // BR-4: chưa chọn gói mà vào thẳng các bước sau thì quay về bước chọn gói.
  // UC02: chưa gửi đăng ký thì không có màn nhập mã.
  // BR-6: chưa xác thực email (chưa có paymentToken) thì không được vào màn thanh toán.
  useEffect(() => {
    const missingPlan = screensNeedingPlan.includes(screen) && !selectedPlan;
    const missingVerification = screen === "verify-email" && !verification;
    const missingToken = screen === "payment" && !paymentToken;
    if (missingPlan || missingVerification || missingToken) {
      navigate("/register", { replace: true });
    }
  }, [screen, selectedPlan, verification, paymentToken, navigate]);

  // UC03: đồng hồ đếm ngược hạn mã, chỉ chạy khi đang ở màn nhập mã
  useEffect(() => {
    if (screen !== "verify-email") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  // UC02.1 (đường B): mở từ email 1 → lấy token trên URL ?token=...
  useEffect(() => {
    if (screen !== "pending-payment") return;
    const urlToken = searchParams.get("token");
    if (urlToken) setPaymentToken(urlToken);
    else
      setSummaryError(
        "Liên kết thanh toán bị thiếu. Hãy mở lại liên kết trong email của bạn.",
      );
  }, [screen, searchParams]);

  // UC02.1: vào màn thanh toán → hỏi backend tóm tắt đăng ký theo token
  useEffect(() => {
    if ((screen !== "payment" && screen !== "pending-payment") || !paymentToken)
      return;
    const loadSummary = async () => {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const res = await getRegistrationByTokenAPI(paymentToken);
        if (res.data) {
          if (res.data.status === "Paid") {
            navigate("/register/payment-completed", { replace: true });
          }
          setSummary(res.data);
          return;
        }
        const error = (res as unknown as { error?: IApiError }).error;
        if (error?.code === "REGISTRATION_EXPIRED") {
          navigate("/register/registration-expired", { replace: true });
        } else {
          setSummaryError(
            "Liên kết thanh toán không hợp lệ hoặc đã được thay bằng liên kết mới hơn. Hãy dùng email gần nhất.",
          );
        }
      } catch {
        setSummaryError(
          "Không kết nối được với máy chủ. Vui lòng thử lại sau.",
        );
      } finally {
        setLoadingSummary(false);
      }
    };
    loadSummary();
  }, [screen, paymentToken, navigate]);

  // UC01: bấm "Tiếp tục với gói này" thì ghi nhớ gói đã chọn và sang bước 2
  function selectPlan(plan: ISubscriptionPlan) {
    setSelectedPlan(plan);
    setSummary(null);
    navigate("/register/organization");
  }

  function saveOrganization(values: OrganizationFields) {
    setDraft((previous) => ({ ...previous, organization: values }));
    navigate("/register/organizer");
  }

  // UC02: bấm "Tạo đăng ký" → gửi đăng ký lên tenant-service
  async function saveOrganizer(values: OrganizerFields) {
    if (!selectedPlan) return;
    setDraft((previous) => ({
      ...previous,
      organizer: { fullName: values.fullName, email: values.email },
    }));
    setSubmitting(true);
    setSubmitError(null);
    setEmailInUse(false);
    const request: ICreateRegistrationReq = {
      planId: selectedPlan.id,
      organization: draft.organization,
      organizer: values,
    };
    try {
      const res = await createRegistrationAPI(request);
      if (res.data) {
        // BR-276: phản hồi trung tính → luôn sang màn nhập mã, không lộ email đã có đăng ký hay chưa
        organizerForm.resetFields(["password"]);
        setAccountError(false);
        startVerification(res.data.email, res.data.otpTtlMinutes);
        navigate("/register/verify-email");
      } else {
        showRegistrationError((res as unknown as { error?: IApiError }).error);
      }
    } catch {
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  // UC03: mỗi lần backend gửi mã mới → đặt lại ô nhập, lỗi và đồng hồ
  function startVerification(email: string, ttlMinutes: number) {
    const sentAt = Date.now();
    setVerification({ email, ttlMinutes, sentAt });
    setNow(sentAt);
    setOtp("");
    setOtpReady(false);
    setOtpError(null);
  }

  // UC03: nhập đủ 6 số (hoặc bấm "Xác thực email") → gửi mã lên backend
  async function verifyOtp(code: string) {
    if (!verification || code.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    setOtpError(null);
    setResentNotice(false);
    try {
      const res = await verifyEmailOtpAPI({
        email: verification.email,
        otp: code,
      });
      if (res.data) {
        // Mã đúng: email đã xác thực, có token để thanh toán (UC02.1). Mật khẩu không cần giữ nữa.
        setPaymentToken(res.data.paymentToken);
        navigate("/register/payment");
        return;
      }
      const error = (res as unknown as { error?: IApiError }).error;
      setOtp(""); // xóa 6 ô để nhập lại
      setOtpReady(false);
      setOtpError(
        error?.code === "OTP_EXPIRED"
          ? "Mã này đã hết hạn. Hãy yêu cầu mã mới bên dưới."
          : "Mã không đúng. Hãy kiểm tra email gần nhất rồi thử lại. Nếu nhập sai quá nhiều lần, hãy yêu cầu mã mới.",
      );
    } catch {
      setOtpError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setVerifying(false);
    }
  }

  async function resendOtp() {
    if (!verification) {
      navigate("/register/organizer");
      return;
    }
    setResending(true);
    setOtpError(null);
    setResentNotice(false);
    try {
      const res = await resendRegistrationEmailAPI(verification.email);
      if (res.data) {
        startVerification(res.data.email, res.data.otpTtlMinutes);
        setResentNotice(true);
      } else {
        setOtpError("Chưa gửi được mã mới. Vui lòng thử lại sau.");
      }
    } catch {
      setOtpError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setResending(false);
    }
  }

  // UC02: đổi mã lỗi backend thành thông báo tiếng Việt, đặt đúng chỗ
  function showRegistrationError(error?: IApiError) {
    switch (error?.code) {
      case "EMAIL_ALREADY_USED":
        // Trường hợp F: email thuộc tài khoản đã hoạt động → báo rõ ở đầu form và tại ô email
        setAccountError(true);
        setEmailInUse(true);
        organizerForm.setFields([
          {
            name: "email",
            errors: ["Email này đã được một tài khoản khác sử dụng."],
          },
        ]);
        return;
      case "PLAN_NOT_AVAILABLE":
        setSubmitError(
          "Gói bạn chọn không còn được cung cấp. Hãy chọn gói khác.",
        );
        return;
      case "IDENTITY_UNAVAILABLE":
        setSubmitError(
          "Dịch vụ tài khoản đang tạm thời gián đoạn. Vui lòng thử lại sau.",
        );
        return;
      default:
        setSubmitError(
          "Một số thông tin đăng ký chưa hợp lệ. Hãy kiểm tra lại rồi thử lại.",
        );
    }
  }

  // UC02.1: bấm "Thanh toán mô phỏng" → gọi backend thanh toán
  async function pay() {
    if (!paymentToken) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await payRegistrationAPI({
        token: paymentToken,
        simulateFailure,
      });
      const result = res.data;
      if (result?.paymentStatus === "Succeeded") {
        navigate("/register/payment-completed");
      } else if (result?.paymentStatus === "Failed") {
        navigate("/register/payment-failed"); // đăng ký vẫn chờ, token vẫn giữ để thử lại
      } else {
        const error = (res as unknown as { error?: IApiError }).error;
        if (error?.code === "REGISTRATION_ALREADY_PAID") {
          navigate("/register/payment-completed");
        } else if (error?.code === "REGISTRATION_EXPIRED") {
          navigate("/register/registration-expired");
        } else if (error?.code === "EMAIL_NOT_VERIFIED") {
          // BR-6: backend tự kiểm lại, phòng khi gọi thẳng API bỏ qua bước xác thực
          setPayError(
            "Hãy xác thực email của quản lý đào tạo trước khi thanh toán. Mở liên kết trong thư đăng ký của bạn.",
          );
        } else {
          setPayError("Chưa xử lý được thanh toán. Vui lòng thử lại.");
        }
      }
    } catch {
      setPayError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setPaying(false);
    }
  }

  function renderResult(resultScreen: ResultScreen) {
    const result = resultContent[resultScreen];
    return (
      <section
        className={`register-card register-result register-result-${result.tone}`}
        role="status"
      >
        <span className="register-result-icon" aria-hidden="true">
          {result.icon}
        </span>
        <h2>{result.title}</h2>
        <p>{result.text}</p>
        {resultScreen === "registration-expired" && (
          <div className="register-notice register-notice-warning">
            Hãy đăng ký lại để chọn một gói đang được cung cấp.
          </div>
        )}
        {resultScreen === "payment-completed" && (
          <div className="register-notice register-notice-success">
            <b>Đã kích hoạt tài khoản quản lý đào tạo</b>
            <p>
              Thư xác nhận đã được gửi tới {email}. Hãy đăng nhập bằng mật khẩu
              bạn đã tạo khi đăng ký.
            </p>
          </div>
        )}
        {resultScreen === "payment-failed" && (
          <div className="register-notice register-notice-warning">
            <b>Đăng ký vẫn còn hiệu lực</b>
            <p>Hãy thử lại trước khi đăng ký hết hạn.</p>
          </div>
        )}
        {result.action && (
          <Link className="guest-link guest-link-primary" to={result.to}>
            {result.action} <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>
    );
  }

  function renderPayment() {
    const pending = screen === "pending-payment";
    const canPay = summary?.status === "PendingPayment" && !paying;
    return (
      <section className="register-card register-payment">
        {pending && <span className="register-pending">Chờ thanh toán</span>}
        <h2>Tóm tắt đăng ký</h2>
        {loadingSummary && <Spin />}
        {summaryError && (
          <Alert
            type="error"
            showIcon
            message={summaryError}
            action={<Link to="/register">Đăng ký lại</Link>}
          />
        )}
        {summary && (
          <dl className="register-summary">
            <div>
              <dt>Tổ chức</dt>
              <dd>{summary.organizationName}</dd>
            </div>
            <div>
              <dt>Quản lý đào tạo</dt>
              <dd>{summary.organizerEmail}</dd>
            </div>
            <div>
              <dt>Gói</dt>
              <dd>{summary.plan.name}</dd>
            </div>
            <div>
              <dt>Số tiền cần thanh toán</dt>
              <dd>{formatVnd(summary.plan.price)}</dd>
            </div>
          </dl>
        )}
        <div className="register-notice">
          <b>{pending ? "Tiếp tục an toàn" : "Đây là thanh toán mô phỏng"}</b>
          <p>
            {pending
              ? "Đăng ký đã lưu của bạn sẵn sàng để tiếp tục."
              : "Không dùng cổng thanh toán hay giao dịch thật."}
          </p>
        </div>
        {payError && <Alert type="error" showIcon message={payError} />}
        {/* Chỉ khi chạy dev: công tắc demo nhánh thanh toán thất bại (UC02.1) */}
        {import.meta.env.DEV && !pending && (
          <Checkbox
            className="register-dev-option"
            checked={simulateFailure}
            onChange={(event) => setSimulateFailure(event.target.checked)}
          >
            Giả lập thanh toán thất bại (chỉ khi phát triển)
          </Checkbox>
        )}
        {/* Không còn nút Back: đăng ký đã tạo và email đã xác thực ở bước trước */}
        <div className="register-actions register-actions-end">
          <Button
            type="primary"
            loading={paying}
            disabled={!canPay}
            onClick={pending ? () => navigate("/register/payment") : pay}
          >
            {pending ? "Tiếp tục thanh toán" : "Thanh toán mô phỏng"}
          </Button>
        </div>
      </section>
    );
  }

  // UC03: màn nhập mã 6 số
  function renderVerifyEmail() {
    if (!verification) return null;
    const expiresAt = verification.sentAt + verification.ttlMinutes * 60_000;
    const remainingMs = Math.max(0, expiresAt - now);
    const expired = remainingMs === 0;
    const minutes = Math.floor(remainingMs / 60_000);
    const seconds = Math.floor((remainingMs % 60_000) / 1000);
    const resendWaitMs = verification.sentAt + RESEND_COOLDOWN_MS - now;
    return (
      <section className="register-card register-verify">
        <h2>Nhập mã xác thực</h2>
        <p className="register-card-description">
          Nếu thông tin hợp lệ, mã 6 chữ số đã được gửi tới{" "}
          <b>{verification.email}</b>. Bạn cũng có thể mở liên kết trong email
          đó để tiếp tục.
        </p>
        {resentNotice && (
          <Alert
            type="info"
            showIcon
            message="Đã yêu cầu mã mới. Hãy dùng mã trong email gần nhất."
          />
        )}
        {otpError && <Alert type="error" showIcon message={otpError} />}
        {/* antd chỉ gọi onChange khi đủ 6 ô; xóa bớt 1 ô thì bắt sự kiện input để khóa nút */}
        <div
          className="register-otp"
          onInput={(event) => {
            if (!(event.target as HTMLInputElement).value) setOtpReady(false);
          }}
        >
          <Input.OTP
            length={OTP_LENGTH}
            value={otp}
            disabled={verifying || expired}
            formatter={(value) => value.replace(/\D/g, "")}
            onChange={(value) => {
              // chỉ ghi nhận mã, gửi khi bấm "Xác thực email"
              setOtp(value);
              setOtpReady(true);
            }}
          />
          <p
            className={`register-otp-timer${expired ? " register-otp-timer-expired" : ""}`}
            role="timer"
          >
            {expired
              ? "Mã đã hết hạn."
              : `Mã hết hạn sau ${minutes}:${String(seconds).padStart(2, "0")}`}
          </p>
        </div>
        <div className="register-notice">
          <b>Email không có mã?</b>
          <p>
            Nếu email này đã được xác thực, chúng tôi gửi liên kết "Tiếp tục
            thanh toán" thay cho mã. Hãy mở liên kết đó để hoàn tất đăng ký.
          </p>
          <b className="register-notice-next">Không nhận được email?</b>
          <p>
            Hãy kiểm tra thư mục thư rác hoặc yêu cầu mã mới. Mỗi lần yêu cầu sẽ
            gửi mã mới và mã trước đó không còn dùng được.
          </p>
        </div>
        <div className="register-actions">
          <Button onClick={() => navigate("/register/organizer")}>
            Đổi email
          </Button>
          <div className="register-actions-group">
            <Button
              loading={resending}
              disabled={resendWaitMs > 0 || verifying}
              onClick={resendOtp}
            >
              {resendWaitMs > 0
                ? `Gửi lại mã (${Math.ceil(resendWaitMs / 1000)} giây)`
                : "Gửi lại mã"}
            </Button>
            <Button
              type="primary"
              loading={verifying}
              disabled={!otpReady || expired}
              onClick={() => verifyOtp(otp)}
            >
              Xác thực email
            </Button>
          </div>
        </div>
      </section>
    );
  }

  function renderAccount() {
    return (
      <section className="register-card">
        {emailInUse ? (
          <Alert
            type="error"
            message="Email này đã được sử dụng"
            description={
              <>
                Email này đã thuộc một tài khoản LearnUP đang hoạt động. Hãy{" "}
                <Link to="/login">đăng nhập</Link>, hoặc nhập email khác cho
                quản lý đào tạo mới.
              </>
            }
            role="alert"
          />
        ) : accountError ? (
          <Alert
            type="error"
            message="Thông tin tài khoản cần được sửa"
            description="Hãy kiểm tra các ô được đánh dấu trước khi tiếp tục."
            role="alert"
          />
        ) : (
          <>
            <h2>Thông tin tài khoản</h2>
            <p className="register-card-description">
              Quản lý đào tạo quản lý thành viên, khóa học, việc phê duyệt và
              gói dịch vụ.
            </p>
          </>
        )}
        {submitError && <Alert type="error" showIcon message={submitError} />}

        <Form<OrganizerFields>
          form={organizerForm}
          layout="vertical"
          requiredMark={false}
          initialValues={draft.organizer}
          onFinish={saveOrganizer}
          onFinishFailed={() => setAccountError(true)}
        >
          <Form.Item
            name="fullName"
            label="Họ và tên"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Hãy nhập họ và tên.",
              },
              {
                max: 100,
                message: "Họ và tên tối đa 100 ký tự.",
              },
            ]}
          >
            <Input autoComplete="name" placeholder="Nguyễn Văn An" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Địa chỉ email"
            rules={[
              { required: true, message: "Hãy nhập địa chỉ email." },
              { type: "email", message: "Địa chỉ email không hợp lệ." },
              { max: 254, message: "Email tối đa 254 ký tự." },
            ]}
          >
            <Input autoComplete="email" placeholder="nguyen.van.an@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              { required: true, message: "Hãy nhập mật khẩu." },
              { min: 8, message: "Mật khẩu cần ít nhất 8 ký tự." },
              { max: 72, message: "Mật khẩu tối đa 72 ký tự." },
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              placeholder="Tạo mật khẩu an toàn"
            />
          </Form.Item>
          <p className="register-consent">
            Khi tiếp tục, bạn xác nhận mình được phép đăng ký cho tổ chức này.
          </p>
          <div className="register-actions">
            <Button onClick={() => navigate("/register/organization")}>
              Quay lại
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Tạo đăng ký
            </Button>
          </div>
        </Form>
      </section>
    );
  }

  function renderOrganization() {
    return (
      <section className="register-card">
        <h2>Thông tin tổ chức</h2>
        <p className="register-card-description">
          Các thông tin này dùng để xác định tổ chức và người liên hệ.
        </p>
        <Form<OrganizationFields>
          form={organizationForm}
          layout="vertical"
          requiredMark={false}
          initialValues={draft.organization}
          onFinish={saveOrganization}
        >
          <Form.Item
            name="name"
            label="Tên tổ chức"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Hãy nhập tên tổ chức.",
              },
              {
                max: 200,
                message: "Tên tổ chức tối đa 200 ký tự.",
              },
            ]}
          >
            <Input
              autoComplete="organization"
              placeholder="Công ty TNHH Đào tạo ABC"
            />
          </Form.Item>
          <div className="register-field-grid">
            <Form.Item
              name="taxCode"
              label="Mã số thuế"
              rules={[
                {
                  required: true,
                  message: "Hãy nhập mã số thuế.",
                },
                {
                  validator: (_, value?: string) =>
                    !value ||
                    /^\d{10}(\d{3})?$/.test(value.replace(/[\s-]/g, ""))
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error("Mã số thuế gồm 10 hoặc 13 chữ số."),
                        ),
                },
              ]}
            >
              <Input placeholder="0123456789" />
            </Form.Item>
            <Form.Item
              name="contactPhone"
              label="Số điện thoại liên hệ"
              rules={[
                { required: true, message: "Hãy nhập số điện thoại liên hệ." },
                {
                  pattern: /^\+?[\d\s().-]{9,20}$/,
                  message: "Số điện thoại không hợp lệ.",
                },
              ]}
            >
              <Input autoComplete="tel" placeholder="0901 234 567" />
            </Form.Item>
          </div>
          <Form.Item
            name="address"
            label="Địa chỉ"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Hãy nhập địa chỉ.",
              },
              { max: 300, message: "Địa chỉ tối đa 300 ký tự." },
            ]}
          >
            <Input
              autoComplete="street-address"
              placeholder="123 Nguyễn Huệ, Quận 1, TP.HCM"
            />
          </Form.Item>
          <div className="register-notice">
            <b>Thông tin được bảo mật</b>
            <p>
              Thông tin tổ chức và người liên hệ chỉ dùng để hoàn tất đăng ký
              này.
            </p>
          </div>
          <div className="register-actions">
            <Button onClick={() => navigate("/register")}>Quay lại</Button>
            <Button type="primary" htmlType="submit">
              Tiếp tục <span aria-hidden="true">→</span>
            </Button>
          </div>
        </Form>
      </section>
    );
  }

  return (
    <main className={`register register-${screen}`} id="guest-main">
      {showProgress && <RegistrationSteps current={current} />}
      {screen === "registration-expired" && (
        <span className="guest-eyebrow">Liên kết đăng ký</span>
      )}
      {heading && (
        <div className="register-heading">
          <span className="guest-eyebrow">{heading.eyebrow}</span>
          <h1>{heading.title}</h1>
          {heading.description && <p>{heading.description}</p>}
        </div>
      )}
      {screen === "plans" ? (
        <>
          <div className="register-notice register-plan-notice">
            <b>Chọn gói đơn giản</b>
            <p>
              Xem giới hạn của từng gói rồi tiếp tục với một gói đang cung cấp.
            </p>
          </div>
          {/* UC01: đang tải thì hiện vòng xoay, lỗi thì hiện khung đỏ, xong thì vẽ các thẻ gói thật */}
          {loadingPlans && <Spin size="large" />}
          {planError && <Alert type="error" message={planError} showIcon />}
          {!loadingPlans && !planError && (
            <div className="guest-plan-grid">
              {plans.map((plan, index) => (
                <PlanCard
                  key={plan.id}
                  featured={index === 1}
                  details={toPlanDetails(plan)}
                  onSelect={() => selectPlan(plan)}
                />
              ))}
            </div>
          )}
          <p className="guest-note">
            Chỉ các gói đang được nền tảng cung cấp mới hiện ở đây.
          </p>
        </>
      ) : (
        <div
          className={standalone ? "register-standalone" : "register-columns"}
        >
          <div>
            {isResult(screen)
              ? renderResult(screen)
              : screen === "verify-email"
                ? renderVerifyEmail()
                : screen === "payment" || screen === "pending-payment"
                  ? renderPayment()
                  : account
                    ? renderAccount()
                    : renderOrganization()}
          </div>
          {/* UC01: khung bên phải hiện gói đã chọn */}
          {!standalone && (
            <aside className="register-plan">
              <PlanCard
                selected
                details={displayPlan ? toPlanDetails(displayPlan) : undefined}
              />
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
