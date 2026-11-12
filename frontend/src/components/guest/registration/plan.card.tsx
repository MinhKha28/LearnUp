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
    ["Số học viên", "[Giới hạn]"],
    ["Số giảng viên", "[Giới hạn]"],
    ["Số khóa học", "[Giới hạn]"],
    ["Dung lượng lưu trữ", "[Giới hạn]"],
  ];

  return (
    <article className={className}>
      <div className="plan-card-heading">
        {selected && <h2>Gói bạn chọn</h2>}
        {details && featured && (
          <span className="plan-card-badge">Phổ biến</span>
        )}
        {!details && <span className="plan-card-badge">Đang cung cấp</span>}
      </div>
      <h3>{details?.name ?? "[Tên gói]"}</h3>
      <p className="plan-card-term">
        {details?.description ?? "[Thời hạn gói]"}
      </p>
      <p className="plan-card-price">{details?.price ?? "[Giá gói]"}</p>
      <span className="plan-card-caption">
        {details?.priceNote ?? "cho mỗi tổ chức"}
      </span>
      <dl className="plan-card-limits">
        {limits.map(([label, value]) => (
          <div key={label}>
            <dt>
              <CheckOutlined aria-hidden="true" /> {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {details && <p className="plan-card-footer">{details.footer}</p>}
      {selected && (
        <dl className="plan-card-payment">
          <div>
            <dt>Tổng tiền</dt>
            <dd>{details?.price ?? "[Giá gói]"}</dd>
          </div>
        </dl>
      )}
      {onSelect && (
        <Button block onClick={onSelect}>
          {home
            ? `Chọn gói ${details?.name ?? ""}`.trim()
            : "Tiếp tục với gói này"}
          <span aria-hidden="true">{"\u2192"}</span>
        </Button>
      )}
    </article>
  );
}
