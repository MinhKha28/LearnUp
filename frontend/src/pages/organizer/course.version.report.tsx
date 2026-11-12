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
import { courseStatusText } from "@/utils/organizer.labels";
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
  { key: "trang-nguyen", learner: "Trang Nguyễn", certificate: "CERT-2026-0048", version: "v1", issued: "18/03/2026" },
  { key: "bao-tran", learner: "Bảo Trần", certificate: "CERT-2026-0051", version: "v1", issued: "18/03/2026" },
];

const CourseVersionReport = () => {
  const versionColumns: ColumnsType<VersionRow> = [
    { title: "Phiên bản", dataIndex: "version" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status: VersionRow["status"]) => (
        <StatusTag tone={status === "Published" ? "info" : "neutral"}>{courseStatusText(status)}</StatusTag>
      ),
    },
    { title: "Chứng chỉ", dataIndex: "certificates" },
    { title: "Học viên hiện tại", dataIndex: "currentLearners" },
    { title: "Người có Chứng chỉ phiên bản cũ", dataIndex: "holdersOfOldCert" },
  ];
  const holderColumns: ColumnsType<CertificateHolderRow> = [
    { title: "Học viên", dataIndex: "learner" },
    { title: "Chứng chỉ", dataIndex: "certificate" },
    { title: "Phiên bản", dataIndex: "version" },
    { title: "Ngày cấp", dataIndex: "issued" },
    {
      title: "Thao tác",
      key: "action",
      align: "right",
      render: () => <button className="organizer-link">Phân công v2 →</button>,
    },
  ];
  return (
    <OrganizerPage className="organizer-course-version-report">
      <PageHeader
        title="Báo cáo phiên bản"
        subtitle="Theo dõi Chứng chỉ và Học viên qua các phiên bản Khóa học."
        back
        actions={<OrganizerButton type="primary">Xuất báo cáo</OrganizerButton>}
      />
      <SectionCard title="Kiến thức cơ bản về an toàn lao động" className="organizer-course-version-report-chain">
        <span className="organizer-note organizer-course-version-report-label">Chuỗi phiên bản</span>
        <Table className="organizer-table" columns={versionColumns} dataSource={versions} pagination={false} />
        <WarningPanel title="Chứng chỉ của phiên bản đã lưu trữ">
          42 Học viên có Chứng chỉ của phiên bản 1 đã lưu trữ. Quản lý đào tạo có thể quyết định phân công học phiên bản 2.
        </WarningPanel>
      </SectionCard>
      <SectionCard title="Học viên có Chứng chỉ của phiên bản cũ">
        <Table className="organizer-table" columns={holderColumns} dataSource={certificateHolders} pagination={false} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default CourseVersionReport;
