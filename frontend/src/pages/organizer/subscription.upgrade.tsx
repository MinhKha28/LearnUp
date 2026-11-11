import { Alert, App, Button, Checkbox, Empty, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import {
  getUpgradeOptionsAPI,
  upgradeSubscriptionAPI,
} from "@/services/subscription.service";
import type { IApiError } from "@/types/organization.types";
import type { IUpgradeOptions } from "@/types/subscription.types";
import { formatDateVN, formatVnd } from "@/utils/helper";
import {
  UPGRADE_NOT_APPLIED,
  blockedLimitLines,
  planLimitsLine,
  planPriceLine,
  upgradeBlockedMessage,
  upgradeErrorMessage,
  upgradeFormulaLine,
} from "@/utils/upgrade.view";
import "./subscription.upgrade.scss";

const SubscriptionUpgrade = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [view, setView] = useState<IUpgradeOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [chargedNotApplied, setChargedNotApplied] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setView(null);
      setLoadError(null);
      setSelectedId(null);
      try {
        const res = await getUpgradeOptionsAPI();
        if (ignore) return;
        if (res.data?.options) {
          setView(res.data);
        } else {
          const code = (res as unknown as { error?: IApiError }).error?.code;
          setLoadError(upgradeErrorMessage(code));
        }
      } catch {
        if (!ignore) {
          setLoadError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
        }
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const selected =
    view?.options.find((option) => option.id === selectedId) ?? null;

  const pay = async () => {
    if (!selected) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await upgradeSubscriptionAPI(selected.id, simulateFailure);
      const status = res.data?.paymentStatus;
      if (status === "Succeeded" || status === "NotRequired") {
        message.success(
          `Đã nâng cấp lên gói ${selected.name}. Giới hạn mới áp dụng ngay.`,
        );
        navigate("/organizer/subscription");
        return;
      }
      if (status === "Failed") {
        setPayError(
          "Thanh toán bị từ chối và chưa có gì thay đổi. Bạn có thể thử lại.",
        );
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      setPayError(upgradeErrorMessage(code));
      if (code === UPGRADE_NOT_APPLIED) {
        setChargedNotApplied(true);
        return;
      }
      setReloadKey((key) => key + 1);
    } catch {
      setPayError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setPaying(false);
    }
  };

  const renderBody = () => {
    if (loadError) {
      return (
        <Alert
          type="error"
          showIcon
          message={loadError}
          action={
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Thử lại
            </Button>
          }
        />
      );
    }
    if (!view) {
      return (
        <SectionCard>
          <Skeleton active />
        </SectionCard>
      );
    }
    const blockedMessage = upgradeBlockedMessage(view.blockedReason);
    return (
      <>
        <p className="organizer-note">
          Gói hiện tại: <strong>{view.currentPlanName}</strong>. Ngày hết hạn
          giữ nguyên là {formatDateVN(view.expiresAt)}; bạn trả phần chênh lệch
          giá cho {view.remainingDays} ngày còn lại.
        </p>
        {blockedMessage && (
          <Alert type="info" showIcon message={blockedMessage} />
        )}
        {!view.usageAvailable && (
          <Alert
            type="warning"
            showIcon
            message="Hiện chưa kiểm tra được số khóa học và dung lượng đang dùng nên yêu cầu nâng cấp có thể bị từ chối. Vui lòng thử lại sau."
          />
        )}
        {view.options.length === 0 ? (
          <SectionCard>
            <Empty description="Không có gói nào khác" />
          </SectionCard>
        ) : (
          <div className="organizer-plan-grid">
            {view.options.map((option) => {
              const disabled =
                blockedMessage !== null || option.blockedBy.length > 0;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  className={`organizer-plan-card ${
                    selectedId === option.id
                      ? "organizer-plan-card-selected"
                      : ""
                  }`}
                  onClick={() => setSelectedId(option.id)}
                >
                  <div className="organizer-plan-card-heading">
                    <h2>{option.name}</h2>
                    {option.blockedBy.length > 0 && (
                      <StatusTag tone="neutral">Không chọn được</StatusTag>
                    )}
                    {selectedId === option.id && (
                      <span className="organizer-plan-card-badge">Đã chọn</span>
                    )}
                  </div>
                  <p className="organizer-plan-limits">
                    {planPriceLine(option)}
                  </p>
                  <p className="organizer-plan-limits">
                    {planLimitsLine(option)}
                  </p>
                  <p className="organizer-note">
                    {option.amount > 0
                      ? `Thanh toán ${formatVnd(option.amount)} ngay`
                      : "Không cần thanh toán, áp dụng ngay"}
                  </p>
                  {blockedLimitLines(option.blockedBy).map((line) => (
                    <p className="organizer-note" key={line}>
                      {line}
                    </p>
                  ))}
                </button>
              );
            })}
          </div>
        )}
        {payError && (
          <Alert type="error" showIcon message={payError} role="alert" />
        )}
        {import.meta.env.DEV && !blockedMessage && (
          <Checkbox
            checked={simulateFailure}
            onChange={(event) => setSimulateFailure(event.target.checked)}
          >
            Giả lập thanh toán thất bại (chỉ khi phát triển)
          </Checkbox>
        )}
        {selected && selected.amount > 0 && (
          <p className="organizer-note">
            {upgradeFormulaLine(
              selected,
              {
                price: view.currentPrice,
                durationDays: view.currentDurationDays,
              },
              view.remainingDays,
            )}
          </p>
        )}
        <div className="organizer-upgrade-footer">
          <div>
            <strong>Giới hạn mới áp dụng ngay</strong>
            <p className="organizer-note">
              Không hỗ trợ hạ cấp. Không chọn được gói có giới hạn thấp hơn mức
              bạn đang dùng hoặc đang có.
            </p>
          </div>
          <OrganizerButton
            type="primary"
            loading={paying}
            disabled={!selected || chargedNotApplied}
            onClick={pay}
          >
            {selected && selected.amount > 0
              ? `Thanh toán mô phỏng ${formatVnd(selected.amount)}`
              : "Nâng cấp"}
          </OrganizerButton>
        </div>
      </>
    );
  };

  return (
    <OrganizerPage className="organizer-subscription-upgrade">
      <PageHeader
        title="Nâng cấp gói dịch vụ"
        subtitle="Chọn gói có giới hạn đủ cho mức bạn đang dùng và đang có."
        actions={
          <OrganizerButton onClick={() => navigate(-1)}>
            Quay lại
          </OrganizerButton>
        }
      />
      {renderBody()}
    </OrganizerPage>
  );
};

export default SubscriptionUpgrade;
