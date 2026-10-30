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
          message="Could not load organization details."
          description="Please check your connection and try again."
          action={
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Try again
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
            <span>Organization profile</span>
          </div>
        </div>
        <div className="organizer-divider" />
        <div className="organizer-detail-grid">
          <div className="organizer-detail-item">
            <span>Organization name</span>
            <strong>{profile.name}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Tax code</span>
            <strong>{profile.taxCode}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Contact phone</span>
            <strong>{profile.contactPhone}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Contact email</span>
            <strong>{profile.contactEmail ?? "—"}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Address</span>
            <strong>{profile.address}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Timezone</span>
            <strong>{profile.timezone}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Legal note</span>
            <strong>
              Tax code is identity information only, invoicing is outside MVP.
            </strong>
          </div>
        </div>
      </SectionCard>
    );
  };

  return (
    <OrganizerPage className="organizer-organization">
      <PageHeader
        title="Organization"
        subtitle="View organization identity, contact details, logo, and timezone."
        actions={
          <Link to="/organizer/organization/edit">
            <OrganizerButton type="primary">Edit organization</OrganizerButton>
          </Link>
        }
      />
      {renderBody()}
      <WarningPanel title="Timezone affects deadlines">
        Organization timezone determines Required Course completion deadlines
        and Peer Review cycle review deadlines.
      </WarningPanel>
    </OrganizerPage>
  );
};

export default Organization;
