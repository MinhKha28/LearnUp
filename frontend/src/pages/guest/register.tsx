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
} from "@/services/organization.service";
import type {
  IApiError,
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
    eyebrow: "STEP 1 OF 5",
    title: "Choose the right plan for your organization",
    description: "Compare plan duration and capacity before registration.",
  },
  organization: {
    eyebrow: "STEP 2 OF 5",
    title: "Organization details",
    description: "Tell us about the organization that will use LearnUP.",
  },
  organizer: {
    eyebrow: "STEP 3 OF 5",
    title: "Organizer account",
    description:
      "Create the person who will manage training for the organization.",
  },
  "account-review": {
    eyebrow: "STEP 3 OF 5",
    title: "Check account details",
    description: "Correct the highlighted fields to continue.",
  },
  payment: {
    eyebrow: "STEP 4 OF 5",
    title: "Complete mock payment",
    description: "Review your registration and use the simulated payment flow.",
  },
  "payment-failed": {
    eyebrow: "STEP 4 OF 5",
    title: "Payment was unsuccessful",
    description: "Your registration is still pending, so you can try again.",
  },
  "pending-payment": {
    eyebrow: "STEP 4 OF 5",
    title: "Pending payment",
    description: "This registration is still active and waiting for payment.",
  },
  "payment-completed": {
    eyebrow: "STEP 5 OF 5",
    title: "Payment completed",
    description: "Verify the Organizer email to activate your workspace.",
  },
  "no-plans": {
    eyebrow: "SUBSCRIPTION PLANS",
    title: "Choose a plan for your organization",
    description: "",
  },
};

const resultContent = {
  "payment-failed": {
    icon: "×",
    tone: "error",
    title: "Payment could not be completed",
    text: "The payment was rejected by the mock payment service.",
    action: "Try mock payment again",
    to: "/register/payment",
  },
  "registration-expired": {
    icon: "!",
    tone: "warning",
    title: "Registration expired",
    text: "The pending registration passed its validity period.",
    action: "View available plans",
    to: "/register",
  },
  "payment-completed": {
    icon: "✓",
    tone: "success",
    title: "Payment completed",
    text: "Your registration has moved to email verification.",
    action: "",
    to: "",
  },
  "email-verified": {
    icon: "✓",
    tone: "success",
    title: "Email verified",
    text: "The Organizer account for LearnUP is now active.",
    action: "Sign in",
    to: "/login",
  },
  "invalid-verification-link": {
    icon: "×",
    tone: "error",
    title: "Verification link is invalid",
    text: "The link may have expired or already been used.",
    action: "View available plans",
    to: "/register",
  },
  "no-plans": {
    icon: "i",
    tone: "info",
    title: "No subscription plans are available",
    text: "Please check again later or contact the LearnUP team.",
    action: "Back to Home",
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
  // UC01: nếu đi từ trang chủ (bấm "Choose ...") thì gói được gửi kèm qua router state
  const location = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<ISubscriptionPlan | null>(
    () => (location.state as { plan?: ISubscriptionPlan } | null)?.plan ?? null,
  );
  // UC02: trạng thái gửi đăng ký
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resentNotice, setResentNotice] = useState(false);
  // UC02 → UC02.1: token thanh toán backend trả về, dùng ở màn payment (Bước 9)
  const [paymentToken, setPaymentToken] = useState<string | null>(null);
  // UC02.1: tóm tắt đăng ký (lấy từ backend theo token) và trạng thái thanh toán
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<IRegistrationSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false); // chỉ hiện khi chạy dev

  const account = screen === "organizer" || screen === "account-review";
  const standalone = [
    "registration-expired",
    "email-verified",
    "invalid-verification-link",
    "no-plans",
  ].includes(screen);
  const showProgress = ![
    "plans",
    "registration-expired",
    "invalid-verification-link",
    "no-plans",
  ].includes(screen);
  const current =
    screen === "plans"
      ? 0
      : screen === "email-verified" || screen === "payment-completed"
        ? 4
        : screen.includes("payment")
          ? 3
          : account
            ? 2
            : 1;
  const heading = titles[account && accountError ? "account-review" : screen];
  const organizationName =
    summary?.organizationName ||
    draft.organization.name ||
    "[Organization name]";
  const email =
    summary?.organizerEmail || draft.organizer.email || "[Organizer email]";
  // Gói hiển thị bên phải: ở màn thanh toán dùng gói đã chốt trong đăng ký, trước đó dùng gói vừa chọn
  const displayPlan: ISubscriptionPlan | null = summary
    ? { id: summary.registrationId, ...summary.plan }
    : selectedPlan;

  useEffect(() => {
    window.scrollTo(0, 0);
    setAccountError(screen === "account-review");
    if (screen === "account-review") {
      organizerForm.setFields([
        { name: "fullName", value: draft.organizer.fullName || "Alex Morgan" },
        {
          name: "email",
          value: "invalid-email",
          errors: ["Enter a valid email address."],
        },
        { name: "password", value: "", errors: ["Password is required."] },
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
          setPlanError("Could not load subscription plans. Please try again.");
        } else if (res.data.length === 0) {
          navigate("/register/no-plans", { replace: true });
        } else {
          setPlans(res.data);
        }
      } catch {
        setPlanError(
          "Could not connect to the server. Please try again later.",
        );
      } finally {
        setLoadingPlans(false);
      }
    };
    loadPlans();
  }, [screen, navigate]);

  // BR-4: chưa chọn gói mà vào thẳng các bước sau thì quay về bước chọn gói.
  // UC02: chưa tạo đăng ký (chưa có paymentToken) thì không được vào màn thanh toán.
  useEffect(() => {
    const missingPlan = screensNeedingPlan.includes(screen) && !selectedPlan;
    const missingRegistration = screen === "payment" && !paymentToken;
    if (missingPlan || missingRegistration) {
      navigate("/register", { replace: true });
    }
  }, [screen, selectedPlan, paymentToken, navigate]);

  // UC02.1 (đường B): mở từ email 1 → lấy token trên URL ?token=...
  useEffect(() => {
    if (screen !== "pending-payment") return;
    const urlToken = searchParams.get("token");
    if (urlToken) setPaymentToken(urlToken);
    else
      setSummaryError(
        "This payment link is incomplete. Please open the link from your email again.",
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
            "This payment link is invalid or has been replaced by a newer one. Please use the latest email.",
          );
        }
      } catch {
        setSummaryError(
          "Could not connect to the server. Please try again later.",
        );
      } finally {
        setLoadingSummary(false);
      }
    };
    loadSummary();
  }, [screen, paymentToken, navigate]);

  // UC01: bấm "Continue with plan" thì ghi nhớ gói đã chọn và sang bước 2
  function selectPlan(plan: ISubscriptionPlan) {
    setSelectedPlan(plan);
    setSummary(null);
    navigate("/register/organization");
  }

  function saveOrganization(values: OrganizationFields) {
    setDraft((previous) => ({ ...previous, organization: values }));
    navigate("/register/organizer");
  }

  // UC02: bấm "Create registration" → gửi đăng ký lên tenant-service
  async function saveOrganizer(values: OrganizerFields) {
    if (!selectedPlan) return;
    setDraft((previous) => ({
      ...previous,
      organizer: { fullName: values.fullName, email: values.email },
    }));
    setSubmitting(true);
    setSubmitError(null);
    setResentNotice(false);
    try {
      const res = await createRegistrationAPI({
        planId: selectedPlan.id,
        organization: draft.organization,
        organizer: values,
      });
      const result = res.data;
      if (result?.resent === false) {
        // GĐ5 thành công: giữ token để thanh toán ngay (UC02.1)
        organizerForm.resetFields(["password"]);
        setAccountError(false);
        setPaymentToken(result.paymentToken);
        navigate("/register/payment");
      } else if (result?.resent === true) {
        // BR-276: email đang có đăng ký chờ thanh toán → backend đã gửi lại liên kết
        organizerForm.resetFields(["password"]);
        setResentNotice(true);
      } else {
        showRegistrationError((res as unknown as { error?: IApiError }).error);
      }
    } catch {
      setSubmitError(
        "Could not connect to the server. Please try again later.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // UC02: đổi mã lỗi backend thành thông báo tiếng Anh, đặt đúng chỗ
  function showRegistrationError(error?: IApiError) {
    switch (error?.code) {
      case "EMAIL_ALREADY_USED":
        setAccountError(true);
        organizerForm.setFields([
          {
            name: "email",
            errors: ["This email is already used by another account."],
          },
        ]);
        return;
      case "PLAN_NOT_AVAILABLE":
        setSubmitError(
          "The selected plan is no longer available. Please choose another plan.",
        );
        return;
      case "IDENTITY_UNAVAILABLE":
        setSubmitError(
          "The account service is temporarily unavailable. Please try again later.",
        );
        return;
      default:
        setSubmitError(
          "Some registration details are invalid. Please review them and try again.",
        );
    }
  }

  // UC02.1: bấm "Pay with mock service" → gọi backend thanh toán
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
        } else {
          setPayError("The payment could not be processed. Please try again.");
        }
      }
    } catch {
      setPayError("Could not connect to the server. Please try again later.");
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
            Start a new registration to choose another available plan.
          </div>
        )}
        {resultScreen === "payment-completed" && (
          <div className="register-notice">
            <b>Check your inbox</b>
            <p>A verification link will be sent to {email}.</p>
          </div>
        )}
        {resultScreen === "payment-failed" && (
          <div className="register-notice register-notice-warning">
            <b>Registration remains available</b>
            <p>Retry before its configured expiration time.</p>
          </div>
        )}
        {resultScreen === "email-verified" && (
          <div className="register-notice register-notice-success">
            <b>Organization: {organizationName}</b>
            <p>The Organizer can now access the workspace.</p>
          </div>
        )}
        {resultScreen === "invalid-verification-link" && (
          <div className="register-notice register-notice-error">
            If the email was already verified, try signing in.
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
        {pending && <span className="register-pending">PENDING PAYMENT</span>}
        <h2>Registration summary</h2>
        {loadingSummary && <Spin />}
        {summaryError && (
          <Alert
            type="error"
            showIcon
            message={summaryError}
            action={<Link to="/register">Start again</Link>}
          />
        )}
        {summary && (
          <dl className="register-summary">
            <div>
              <dt>Organization</dt>
              <dd>{summary.organizationName}</dd>
            </div>
            <div>
              <dt>Organizer</dt>
              <dd>{summary.organizerEmail}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>{summary.plan.name}</dd>
            </div>
            <div>
              <dt>Amount due</dt>
              <dd>{formatVnd(summary.plan.price)}</dd>
            </div>
          </dl>
        )}
        <div className="register-notice">
          <b>{pending ? "Resume securely" : "This is a mock payment"}</b>
          <p>
            {pending
              ? "Your saved registration is ready to continue."
              : "No real gateway or transaction will be used."}
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
            Simulate a failed payment (development only)
          </Checkbox>
        )}
        <div className="register-actions">
          {!pending && (
            <Button onClick={() => navigate("/register/organizer")}>
              Back
            </Button>
          )}
          <Button
            type="primary"
            loading={paying}
            disabled={!canPay}
            onClick={pending ? () => navigate("/register/payment") : pay}
          >
            {pending ? "Continue to payment" : "Pay with mock service"}
          </Button>
        </div>
      </section>
    );
  }

  function renderAccount() {
    return (
      <section className="register-card">
        {accountError ? (
          <Alert
            type="error"
            message="This account needs attention"
            description="Review the highlighted fields before continuing."
            role="alert"
          />
        ) : (
          <>
            <h2>Account details</h2>
            <p className="register-card-description">
              The Organizer manages members, courses, approvals and
              subscriptions.
            </p>
          </>
        )}
        {resentNotice && (
          <Alert
            type="info"
            showIcon
            message="Check your inbox"
            description="If this email has a registration waiting for payment, the payment link has been sent again."
          />
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
            label="Full name"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Enter your full name.",
              },
              {
                max: 100,
                message: "Full name must be at most 100 characters.",
              },
            ]}
          >
            <Input autoComplete="name" placeholder="Alex Morgan" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email address"
            rules={[
              { required: true, message: "Enter your email address." },
              { type: "email", message: "Enter a valid email address." },
              { max: 254, message: "Email must be at most 254 characters." },
            ]}
          >
            <Input
              autoComplete="email"
              placeholder="alex.morgan@organization.example"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: "Password is required." },
              { min: 8, message: "Password must be at least 8 characters." },
              { max: 72, message: "Password must be at most 72 characters." },
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              placeholder="Create a secure password"
            />
          </Form.Item>
          <p className="register-consent">
            By continuing, you confirm that you are authorized to register this
            organization.
          </p>
          <div className="register-actions">
            <Button onClick={() => navigate("/register/organization")}>
              Back
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Create registration
            </Button>
          </div>
        </Form>
      </section>
    );
  }

  function renderOrganization() {
    return (
      <section className="register-card">
        <h2>Account information</h2>
        <p className="register-card-description">
          These details identify your organization and contact person.
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
            label="Organization name"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Enter your organization name.",
              },
              {
                max: 200,
                message: "Organization name must be at most 200 characters.",
              },
            ]}
          >
            <Input
              autoComplete="organization"
              placeholder="Example Training Co."
            />
          </Form.Item>
          <div className="register-field-grid">
            <Form.Item
              name="taxCode"
              label="Tax identification number"
              rules={[
                {
                  required: true,
                  message: "Enter the tax identification number.",
                },
                {
                  validator: (_, value?: string) =>
                    !value ||
                    /^\d{10}(\d{3})?$/.test(value.replace(/[\s-]/g, ""))
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error("Tax number must have 10 or 13 digits."),
                        ),
                },
              ]}
            >
              <Input placeholder="0123456789" />
            </Form.Item>
            <Form.Item
              name="contactPhone"
              label="Contact phone"
              rules={[
                { required: true, message: "Enter a contact phone number." },
                {
                  pattern: /^\+?[\d\s().-]{9,20}$/,
                  message: "Enter a valid phone number.",
                },
              ]}
            >
              <Input autoComplete="tel" placeholder="0901 234 567" />
            </Form.Item>
          </div>
          <Form.Item
            name="address"
            label="Business address"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Enter the business address.",
              },
              { max: 300, message: "Address must be at most 300 characters." },
            ]}
          >
            <Input
              autoComplete="street-address"
              placeholder="123 Example Street"
            />
          </Form.Item>
          <div className="register-notice">
            <b>Secure details</b>
            <p>
              Organization and contact details are used to complete this
              registration.
            </p>
          </div>
          <div className="register-actions">
            <Button onClick={() => navigate("/register")}>Back</Button>
            <Button type="primary" htmlType="submit">
              Continue <span aria-hidden="true">→</span>
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
        <span className="guest-eyebrow">REGISTRATION LINK</span>
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
            <b>Simple plan selection</b>
            <p>Review capacity and continue with one available plan.</p>
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
                  details={displayPlan ? toPlanDetails(displayPlan) : undefined}
                  onSelect={() => selectPlan(plan)}
                />
              ))}
            </div>
          )}
          <p className="guest-note">
            Only plans offered by the platform appear here.
          </p>
        </>
      ) : (
        <div
          className={standalone ? "register-standalone" : "register-columns"}
        >
          <div>
            {isResult(screen)
              ? renderResult(screen)
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
                details={selectedPlan ? toPlanDetails(selectedPlan) : undefined}
              />
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
