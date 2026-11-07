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
          message="Could not load Subscription Plans."
          description="Please check your connection and try again."
          action={
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Try again
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
          <Empty description="No Subscription Plan yet" />
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
                <StatusTag tone="success">Available</StatusTag>
              ) : (
                <StatusTag tone="neutral">Discontinued</StatusTag>
              )
            }
          >
            <p>{organizationsUsingLabel(plan.organizationCount)}</p>
            <dl>
              <div>
                <dt>Price</dt>
                <dd>{formatVnd(plan.price)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{plan.durationDays} days</dd>
              </div>
              <div>
                <dt>Learners</dt>
                <dd>{plan.maxLearners.toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt>Instructors</dt>
                <dd>{plan.maxInstructors.toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt>Courses</dt>
                <dd>{plan.maxCourseChains.toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt>Storage</dt>
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
        title="Subscription Plans"
        subtitle="Manage the plans offered to new registrations and future renewals."
        actions={
          <Link to="create">
            <AdminButton type="primary">Create plan</AdminButton>
          </Link>
        }
      />
      {renderBody()}
      <WarningPanel title="Plan changes affect future activity only">
        Editing a Plan applies to new registrations and renewals made afterward.
        Organizations already using the Plan keep the limits captured at
        activation until the current term ends.
      </WarningPanel>
    </AdminPage>
  );
};

export default Plans;
