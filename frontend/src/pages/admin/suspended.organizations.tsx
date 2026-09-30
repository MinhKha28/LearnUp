import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AdminPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/admin/admin.ui";
import "./suspended.organizations.scss";

type Suspended = {
  key: string;
  organization: string;
  id: string;
  date: string;
  reason: string;
};
const data: Suspended[] = [
  {
    key: "greenfield",
    organization: "Greenfield Services",
    id: "ORG-004",
    date: "12 Sep 2026",
    reason: "Repeated overdue report handling",
  },
  {
    key: "metro",
    organization: "Metro Skills Center",
    id: "ORG-017",
    date: "03 Sep 2026",
    reason: "System-wide violation",
  },
];
const SuspendedOrganizations = () => {
  const columns: ColumnsType<Suspended> = [
    {
      title: "Organization",
      dataIndex: "organization",
      render: (_, item) => (
        <div className="admin-report-id">
          <strong>{item.organization}</strong>
          <span>{item.id}</span>
        </div>
      ),
    },
    { title: "Suspended since", dataIndex: "date" },
    { title: "Reason", dataIndex: "reason" },
    {
      title: "Action",
      align: "right",
      render: () => <button className="admin-link">Review →</button>,
    },
  ];
  return (
    <AdminPage className="admin-suspended">
      <PageHeader
        title="Suspended Organizations"
        subtitle="Organizations currently suspended at platform level."
      />
      <WarningPanel title="Platform-level suspension">
        Do not suspend isolated report handling or single-user violations.
        Suspension blocks the Organization across LearnUP. After corrective
        action, authorized Organizer members are notified by the investigation
        decision.
      </WarningPanel>
      <SectionCard title="2 suspended organizations">
        <Table
          className="admin-table"
          columns={columns}
          dataSource={data}
          pagination={false}
        />
      </SectionCard>
      <p className="admin-note">
        Restoration is performed after the violation is corrected.
      </p>
    </AdminPage>
  );
};
export default SuspendedOrganizations;
