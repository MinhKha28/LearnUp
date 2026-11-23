import { CheckOutlined } from "@ant-design/icons";
import "@/components/guest/registration/registration.scss";

const steps = [
  "Chọn gói",
  "Tổ chức",
  "Quản lý đào tạo",
  "Xác thực email",
  "Thanh toán",
];

export default function RegistrationSteps({ current }: { current: number }) {
  return (
    <ol className="register-progress" aria-label="Tiến trình đăng ký">
      {steps.map((label, index) => {
        const complete = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            className={
              index <= current ? "register-progress-active" : undefined
            }
            aria-current={active ? "step" : undefined}
          >
            <span>{complete ? <CheckOutlined role="img" aria-label="Bước đã hoàn thành" /> : index + 1}</span>
            <small>{label}</small>
          </li>
        );
      })}
    </ol>
  );
}
