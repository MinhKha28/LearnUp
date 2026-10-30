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
          setLoadError(
            "Could not connect to the server. Please try again later.",
          );
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
        message.success(`Upgraded to ${selected.name}. New limits apply now.`);
        navigate("/organizer/subscription");
        return;
      }
      if (status === "Failed") {
        setPayError(
          "The payment was declined and nothing changed. You can try again.",
        );
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      setPayError(upgradeErrorMessage(code));
      setReloadKey((key) => key + 1);
    } catch {
      setPayError("Could not connect to the server. Please try again later.");
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
              Try again
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
          Current plan: <strong>{view.currentPlanName}</strong>. The expiry date
          stays {formatDateVN(view.expiresAt)}; you pay the price difference for
          the {view.remainingDays} remaining days.
        </p>
        {blockedMessage && (
          <Alert type="info" showIcon message={blockedMessage} />
        )}
        {!view.usageAvailable && (
          <Alert
            type="warning"
            showIcon
            message="Course and storage usage could not be checked right now, so upgrades may be refused. Please try again later."
          />
        )}
        {view.options.length === 0 ? (
          <SectionCard>
            <Empty description="No other plan is available" />
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
                      <StatusTag tone="neutral">Not available</StatusTag>
                    )}
                    {selectedId === option.id && (
                      <span className="organizer-plan-card-badge">
                        Selected
                      </span>
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
                      ? `Pay ${formatVnd(option.amount)} now`
                      : "No payment needed, applies right away"}
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
            Simulate a failed payment (development only)
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
            <strong>New limits apply immediately</strong>
            <p className="organizer-note">
              Downgrades are not supported. Plans below your current usage or
              limits cannot be chosen.
            </p>
          </div>
          <OrganizerButton
            type="primary"
            loading={paying}
            disabled={!selected}
            onClick={pay}
          >
            {selected && selected.amount > 0
              ? `Pay ${formatVnd(selected.amount)} with mock payment`
              : "Upgrade"}
          </OrganizerButton>
        </div>
      </>
    );
  };

  return (
    <OrganizerPage className="organizer-subscription-upgrade">
      <PageHeader
        title="Upgrade Subscription"
        subtitle="Choose a plan whose limits cover your current usage and limits."
        actions={
          <OrganizerButton onClick={() => navigate(-1)}>Back</OrganizerButton>
        }
      />
      {renderBody()}
    </OrganizerPage>
  );
};

export default SubscriptionUpgrade;
