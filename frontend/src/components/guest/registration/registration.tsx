import { CheckOutlined } from "@ant-design/icons";
import "@/components/guest/registration/registration.scss";

const steps = [
  "Select plan",
  "Organization",
  "Organizer",
  "Verify email",
  "Payment",
];

export default function RegistrationSteps({ current }: { current: number }) {
  return (
    <ol className="register-progress" aria-label="Registration progress">
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
            <span>{complete ? <CheckOutlined /> : index + 1}</span>
            <small>{label}</small>
          </li>
        );
      })}
    </ol>
  );
}
