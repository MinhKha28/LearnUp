import { Alert, Button, Empty, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AdminButton,
  AdminPage,
  PageHeader,
  SectionCard,
  StatusTag,
  WarningPanel,
} from "@/components/admin/admin.ui";
import { getAdminPlansAPI } from "@/services/subscription.service";
import type { IAdminPlan } from "@/types/organization.types";
import { formatStorage, formatVnd } from "@/utils/helper";
import { organizationsUsingLabel } from "@/utils/plan.view";
import "./plans.scss";

const Plans = () => {
  const [plans, setPlans] = useState<IAdminPlan[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setPlans(null);
      setFailed(false);
      try {
        const res = await getAdminPlansAPI();
        if (ignore) return;
        if (Array.isArray(res.data)) setPlans(res.data);
        else setFailed(true);
      } catch {
        if (!ignore) setFailed(true);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const renderBody = () => {
    if (failed) {
      return (
        <Alert
          type="error"
          showIcon
          message="Không tải được danh sách gói."
          description="Hãy kiểm tra kết nối rồi thử lại."
          action={
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Thử lại
            </Button>
          }
        />
      );
    }
    if (!plans) {
      return (
        <SectionCard>
          <Skeleton active />
        </SectionCard>
      );
    }
    if (plans.length === 0) {
      return (
        <SectionCard>
          <Empty description="Chưa có gói nào" />
        </SectionCard>
      );
    }
    return (
      <div className="admin-plan-grid">
        {plans.map((plan) => (
          <SectionCard
            key={plan.id}
            className="admin-plan-card"
            title={plan.name}
            extra={
              plan.isOffered ? (
                <StatusTag tone="success">Đang cung cấp</StatusTag>
              ) : (
                <StatusTag tone="neutral">Ngừng cung cấp</StatusTag>
              )
            }
          >
            <p>{organizationsUsingLabel(plan.organizationCount)}</p>
            <dl>
              <div>
                <dt>Giá</dt>
                <dd>{formatVnd(plan.price)}</dd>
              </div>
              <div>
                <dt>Thời hạn</dt>
                <dd>{plan.durationDays} ngày</dd>
              </div>
              <div>
                <dt>Học viên</dt>
                <dd>{plan.maxLearners.toLocaleString("vi-VN")}</dd>
              </div>
              <div>
                <dt>Giảng viên</dt>
                <dd>{plan.maxInstructors.toLocaleString("vi-VN")}</dd>
              </div>
              <div>
                <dt>Khóa học</dt>
                <dd>{plan.maxCourseChains.toLocaleString("vi-VN")}</dd>
              </div>
              <div>
                <dt>Dung lượng lưu trữ</dt>
                <dd>{formatStorage(plan.maxStorageBytes)}</dd>
              </div>
            </dl>
          </SectionCard>
        ))}
      </div>
    );
  };

  return (
    <AdminPage className="admin-plans">
      <PageHeader
        title="Danh sách gói"
        subtitle="Quản lý các gói cung cấp cho lượt đăng ký mới và các lần gia hạn sau này."
        actions={
          <Link to="create">
            <AdminButton type="primary">Tạo gói</AdminButton>
          </Link>
        }
      />
      {renderBody()}
      <WarningPanel title="Thay đổi gói chỉ áp dụng về sau">
        Sửa gói chỉ áp dụng cho lượt đăng ký mới và các lần gia hạn sau đó. Tổ
        chức đang dùng gói giữ nguyên giới hạn đã chốt lúc kích hoạt cho tới hết
        kỳ hiện tại.
      </WarningPanel>
    </AdminPage>
  );
};

export default Plans;
