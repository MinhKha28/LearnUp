import { Alert, Button, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import { OrganizationLogo } from "@/components/organizer/organization.logo";
import { getMyOrganizationAPI } from "@/services/organization.service";
import type { IOrganizationProfile } from "@/types/organization.types";
import "./organization.scss";

const Organization = () => {
  const [profile, setProfile] = useState<IOrganizationProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setProfile(null);
      setFailed(false);
      try {
        const res = await getMyOrganizationAPI();
        if (ignore) return;
        if (res.data?.id) setProfile(res.data);
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
          message="Không tải được thông tin tổ chức."
          description="Hãy kiểm tra kết nối rồi thử lại."
          action={
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Thử lại
            </Button>
          }
        />
      );
    }
    if (!profile) {
      return (
        <SectionCard>
          <Skeleton active />
        </SectionCard>
      );
    }
    return (
      <SectionCard>
        <div className="organizer-org-identity">
          <OrganizationLogo name={profile.name} logoUrl={profile.logoUrl} />
          <div>
            <h2>{profile.name}</h2>
            <span>Hồ sơ tổ chức</span>
          </div>
        </div>
        <div className="organizer-divider" />
        <div className="organizer-detail-grid">
          <div className="organizer-detail-item">
            <span>Tên tổ chức</span>
            <strong>{profile.name}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Mã số thuế</span>
            <strong>{profile.taxCode}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Số điện thoại liên hệ</span>
            <strong>{profile.contactPhone}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Email liên hệ</span>
            <strong>{profile.contactEmail ?? "—"}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Địa chỉ</span>
            <strong>{profile.address}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Múi giờ</span>
            <strong>{profile.timezone}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Lưu ý pháp lý</span>
            <strong>
              Mã số thuế chỉ để định danh, MVP không có nghiệp vụ xuất hóa đơn.
            </strong>
          </div>
        </div>
      </SectionCard>
    );
  };

  return (
    <OrganizerPage className="organizer-organization">
      <PageHeader
        title="Tổ chức"
        subtitle="Xem thông tin định danh, liên hệ, logo và múi giờ của tổ chức."
        actions={
          <Link to="/organizer/organization/edit">
            <OrganizerButton type="primary">
              Sửa thông tin tổ chức
            </OrganizerButton>
          </Link>
        }
      />
      {renderBody()}
      <WarningPanel title="Múi giờ ảnh hưởng tới các hạn">
        Múi giờ của tổ chức quyết định thời điểm kết thúc hạn hoàn thành khóa
        học bắt buộc và hạn chấm của các chu kỳ chấm chéo.
      </WarningPanel>
    </OrganizerPage>
  );
};

export default Organization;
