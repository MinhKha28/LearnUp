import { Alert, App, Button, Checkbox, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DetailItem,
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import {
  getRenewalQuoteAPI,
  renewSubscriptionAPI,
} from "@/services/subscription.service";
import type { IApiError } from "@/types/organization.types";
import type { IRenewalQuote } from "@/types/subscription.types";
import { formatDateVN, formatStorage, formatVnd } from "@/utils/helper";
import {
  exceededLimitLines,
  renewalErrorMessage,
  renewalTermNote,
} from "@/utils/renewal.view";
import "./subscription.renew.scss";

const SubscriptionRenew = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [quote, setQuote] = useState<IRenewalQuote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setQuote(null);
      setLoadError(null);
      try {
        const res = await getRenewalQuoteAPI();
        if (ignore) return;
        if (res.data?.planName) {
          setQuote(res.data);
        } else {
          const code = (res as unknown as { error?: IApiError }).error?.code;
          setLoadError(renewalErrorMessage(code));
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

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const res = await renewSubscriptionAPI(simulateFailure);
      if (res.data?.paymentStatus === "Succeeded") {
        message.success("Payment succeeded. Your Subscription is renewed.");
        navigate("/organizer/subscription");
        return;
      }
      if (res.data?.paymentStatus === "Failed") {
        setPayError(
          "The payment was declined and nothing changed. You can try again.",
        );
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      setPayError(renewalErrorMessage(code));
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
    if (!quote) {
      return (
        <SectionCard>
          <Skeleton active />
        </SectionCard>
      );
    }
    const blocked =
      quote.currentStatus === "Active" && quote.scheduledRenewal !== null;
    const exceeded = exceededLimitLines(quote.exceededLimits);
    return (
      <>
        <div className="organizer-content-grid">
          <SectionCard title="Renewal summary">
            <div className="organizer-detail-grid">
              <DetailItem label="Current plan">
                {quote.planName}
                {!quote.planOffered && " (no longer offered to new customers)"}
              </DetailItem>
              <DetailItem label="Renewal duration">
                {quote.durationDays} days
              </DetailItem>
              <DetailItem label="New term">
                {formatDateVN(quote.startsAt)} - {formatDateVN(quote.expiresAt)}
              </DetailItem>
              <DetailItem label="Plan limits">
                {quote.maxLearners} Learners · {quote.maxInstructors}{" "}
                Instructors · {quote.maxCourseChains} Courses ·{" "}
                {formatStorage(quote.maxStorageBytes)}
              </DetailItem>
            </div>
          </SectionCard>
          <SectionCard title="Payment">
            <div className="organizer-detail-grid">
              <DetailItem label="Amount">{formatVnd(quote.price)}</DetailItem>
              <DetailItem label="Payment service">
                Mock Payment Service
              </DetailItem>
            </div>
            <p className="organizer-note">
              No real invoice or real payment gateway is part of MVP.
            </p>
          </SectionCard>
        </div>
        {blocked ? (
          <Alert
            type="info"
            showIcon
            message="A renewal is already paid"
            description={`The next term runs ${formatDateVN(quote.scheduledRenewal!.startsAt)} - ${formatDateVN(quote.scheduledRenewal!.expiresAt)}. You can renew again after it starts.`}
          />
        ) : (
          <WarningPanel title="When the new term starts">
            {renewalTermNote(quote.currentStatus)}
          </WarningPanel>
        )}
        {exceeded.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="Some new limits are below what you currently use"
            description={
              <>
                <ul>
                  {exceeded.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                You can still renew and nothing is disabled or deleted, but you
                cannot add more in these areas until usage is below the limit.
              </>
            }
          />
        )}
        {!quote.usageAvailable && (
          <Alert
            type="info"
            showIcon
            message="Course and storage usage could not be checked right now."
          />
        )}
        {payError && (
          <Alert type="error" showIcon message={payError} role="alert" />
        )}
        {import.meta.env.DEV && !blocked && (
          <Checkbox
            checked={simulateFailure}
            onChange={(event) => setSimulateFailure(event.target.checked)}
          >
            Simulate a failed payment (development only)
          </Checkbox>
        )}
        <div className="organizer-form-actions">
          <OrganizerButton
            type="primary"
            loading={paying}
            disabled={blocked}
            onClick={pay}
          >
            Pay {formatVnd(quote.price)} with mock payment
          </OrganizerButton>
        </div>
      </>
    );
  };

  return (
    <OrganizerPage className="organizer-subscription-renew">
      <PageHeader
        title="Renew Subscription"
        subtitle="Renew the current plan through Mock Payment."
        actions={
          <OrganizerButton onClick={() => navigate(-1)}>Back</OrganizerButton>
        }
      />
      {renderBody()}
    </OrganizerPage>
  );
};

export default SubscriptionRenew;
