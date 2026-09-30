import { CheckOutlined } from "@ant-design/icons";
import { Button } from "antd";
import "@/components/guest/registration/plan.card.scss";

type PlanDetails = {
  name: string;
  description: string;
  price: string;
  priceNote: string;
  limits: Array<[string, string]>;
  footer: string;
};

type PlanCardProps = {
  selected?: boolean;
  home?: boolean;
  featured?: boolean;
  onSelect?: () => void;
  details?: PlanDetails;
};

export default function PlanCard({
  selected = false,
  home = false,
  featured = false,
  onSelect,
  details,
}: PlanCardProps) {
  const className = [
    "plan-card",
    selected && "plan-card-selected",
    featured && "plan-card-featured",
    details && "plan-card-home",
  ]
    .filter(Boolean)
    .join(" ");
  const limits = details?.limits ?? [
    ["Learner seats", "[Limit]"],
    ["Instructor seats", "[Limit]"],
    ["Courses", "[Limit]"],
    ["Storage", "[Limit]"],
  ];

  return (
    <article className={className}>
      <div className="plan-card-heading">
        {selected && <h2>Your selection</h2>}
        {details && featured && (
          <span className="plan-card-badge">Popular</span>
        )}
        {!details && <span className="plan-card-badge">Available</span>}
      </div>
      <h3>{details?.name ?? "[Configured plan name]"}</h3>
      <p className="plan-card-term">{details?.description ?? "[Plan term]"}</p>
      <p className="plan-card-price">
        {details?.price ?? "[Configured price]"}
      </p>
      <span className="plan-card-caption">
        {details?.priceNote ?? "per organization"}
      </span>
      <dl className="plan-card-limits">
        {limits.map(([label, value]) => (
          <div key={label}>
            <dt>
              <CheckOutlined /> {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {details && <p className="plan-card-footer">{details.footer}</p>}
      {selected && (
        <dl className="plan-card-payment">
          <div>
            <dt>Plan total</dt>
            <dd>{details?.price ?? "[Configured price]"}</dd>
          </div>
        </dl>
      )}
      {onSelect && (
        <Button
          block
          onClick={onSelect}
        >
          {home ? `Choose ${details?.name ?? "plan"}` : "Continue with plan"}
          <span aria-hidden="true">{"\u2192"}</span>
        </Button>
      )}
    </article>
  );
}
