import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./course.version.report.scss";

type VersionRow = {
  key: string;
  version: string;
  status: "Published" | "Archived";
  certificates: string;
  currentLearners: string;
  holdersOfOldCert: string;
};

const versions: VersionRow[] = [
  { key: "v2", version: "v2", status: "Published", certificates: "54", currentLearners: "86", holdersOfOldCert: "—" },
  { key: "v1", version: "v1", status: "Archived", certificates: "42", currentLearners: "0", holdersOfOldCert: "42" },
];

type CertificateHolderRow = {
  key: string;
  learner: string;
  certificate: string;
  version: string;
  issued: string;
};

const certificateHolders: CertificateHolderRow[] = [
  { key: "trang-nguyen", learner: "Trang Nguyen", certificate: "CERT-2026-0048", version: "v1", issued: "18 Mar 2026" },
  { key: "bao-tran", learner: "Bao Tran", certificate: "CERT-2026-0051", version: "v1", issued: "18 Mar 2026" },
];

const CourseVersionReport = () => {
  const versionColumns: ColumnsType<VersionRow> = [
    { title: "Version", dataIndex: "version" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: VersionRow["status"]) => (
        <StatusTag tone={status === "Published" ? "info" : "neutral"}>{status}</StatusTag>
      ),
    },
    { title: "Certificates", dataIndex: "certificates" },
    { title: "Current learners", dataIndex: "currentLearners" },
    { title: "Holders of old cert", dataIndex: "holdersOfOldCert" },
  ];
  const holderColumns: ColumnsType<CertificateHolderRow> = [
    { title: "Learner", dataIndex: "learner" },
    { title: "Certificate", dataIndex: "certificate" },
    { title: "Version", dataIndex: "version" },
    { title: "Issued", dataIndex: "issued" },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: () => <button className="organizer-link">Assign v2 →</button>,
    },
  ];
  return (
    <OrganizerPage className="organizer-course-version-report">
      <PageHeader
        title="Version Report"
        subtitle="Certificates and learners across a Course version chain."
        back
        actions={<OrganizerButton type="primary">Export report</OrganizerButton>}
      />
      <SectionCard title="Workplace Safety Essentials" className="organizer-course-version-report-chain">
        <span className="organizer-note organizer-course-version-report-label">Version chain</span>
        <Table className="organizer-table" columns={versionColumns} dataSource={versions} pagination={false} />
        <WarningPanel title="Archived certificates in use">
          42 Learners hold a Certificate from archived v1. Organizer may decide whether to assign v2.
        </WarningPanel>
      </SectionCard>
      <SectionCard title="Learners holding non-current version Certificates">
        <Table className="organizer-table" columns={holderColumns} dataSource={certificateHolders} pagination={false} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default CourseVersionReport;
