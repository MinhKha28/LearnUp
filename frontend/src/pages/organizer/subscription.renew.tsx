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
import { formatDateVN, formatVnd } from "@/utils/helper";
import { planLimitsLine } from "@/utils/upgrade.view";
import {
  RENEWAL_NOT_APPLIED,
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
  const [chargedNotApplied, setChargedNotApplied] = useState(false);
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
          setLoadError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
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
        message.success("Thanh toán thành công. Gói dịch vụ đã được gia hạn.");
        navigate("/organizer/subscription");
        return;
      }
      if (res.data?.paymentStatus === "Failed") {
        setPayError(
          "Thanh toán bị từ chối và chưa có gì thay đổi. Bạn có thể thử lại.",
        );
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      setPayError(renewalErrorMessage(code));
      if (code === RENEWAL_NOT_APPLIED) {
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
          <SectionCard title="Tóm tắt gia hạn">
            <div className="organizer-detail-grid">
              <DetailItem label="Gói hiện tại">
                {quote.planName}
                {!quote.planOffered &&
                  " (không còn cung cấp cho khách hàng mới)"}
              </DetailItem>
              <DetailItem label="Thời hạn gia hạn">
                {quote.durationDays} ngày
              </DetailItem>
              <DetailItem label="Kỳ mới">
                {formatDateVN(quote.startsAt)} - {formatDateVN(quote.expiresAt)}
              </DetailItem>
              <DetailItem label="Giới hạn của gói">
                {planLimitsLine(quote)}
              </DetailItem>
            </div>
          </SectionCard>
          <SectionCard title="Thanh toán">
            <div className="organizer-detail-grid">
              <DetailItem label="Số tiền">{formatVnd(quote.price)}</DetailItem>
              <DetailItem label="Dịch vụ thanh toán">
                Dịch vụ thanh toán mô phỏng
              </DetailItem>
            </div>
            <p className="organizer-note">
              MVP không có hóa đơn thật hay cổng thanh toán thật.
            </p>
          </SectionCard>
        </div>
        {blocked ? (
          <Alert
            type="info"
            showIcon
            message="Đã có kỳ gia hạn được thanh toán"
            description={`Kỳ tiếp theo từ ${formatDateVN(quote.scheduledRenewal!.startsAt)} đến ${formatDateVN(quote.scheduledRenewal!.expiresAt)}. Bạn có thể gia hạn tiếp sau khi kỳ đó bắt đầu.`}
          />
        ) : (
          <WarningPanel title="Khi nào kỳ mới bắt đầu">
            {renewalTermNote(quote.currentStatus)}
          </WarningPanel>
        )}
        {exceeded.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="Một số giới hạn mới thấp hơn mức bạn đang dùng"
            description={
              <>
                <ul>
                  {exceeded.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                Bạn vẫn gia hạn được và không có gì bị vô hiệu hóa hay xóa,
                nhưng bạn không thêm được ở các mục này cho tới khi mức dùng
                thấp hơn giới hạn.
              </>
            }
          />
        )}
        {!quote.usageAvailable && (
          <Alert
            type="info"
            showIcon
            message="Hiện chưa kiểm tra được số khóa học và dung lượng đang dùng."
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
            Giả lập thanh toán thất bại (chỉ khi phát triển)
          </Checkbox>
        )}
        <div className="organizer-form-actions">
          <OrganizerButton
            type="primary"
            loading={paying}
            disabled={blocked || chargedNotApplied}
            onClick={pay}
          >
            Thanh toán mô phỏng {formatVnd(quote.price)}
          </OrganizerButton>
        </div>
      </>
    );
  };

  return (
    <OrganizerPage className="organizer-subscription-renew">
      <PageHeader
        title="Gia hạn gói dịch vụ"
        subtitle="Gia hạn gói hiện tại qua dịch vụ thanh toán mô phỏng."
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

export default SubscriptionRenew;
