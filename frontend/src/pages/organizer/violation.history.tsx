import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./violation.history.scss";

type InstructorViolations = {
  key: string;
  instructor: string;
  confirmed: number;
  minor: number;
  serious: number;
  latest: string;
};

const rows: InstructorViolations[] = [
  { key: "an-tran", instructor: "An Tran", confirmed: 3, minor: 2, serious: 1, latest: "11 Sep 2026" },
  { key: "linh-phan", instructor: "Linh Phan", confirmed: 1, minor: 1, serious: 0, latest: "02 Aug 2026" },
  { key: "giao-le", instructor: "Giao Le", confirmed: 0, minor: 0, serious: 0, latest: "—" },
];

const ViolationHistory = () => {
  const columns: ColumnsType<InstructorViolations> = [
    { title: "Instructor", dataIndex: "instructor" },
    { title: "Confirmed", dataIndex: "confirmed" },
    { title: "Minor", dataIndex: "minor" },
    { title: "Serious", dataIndex: "serious" },
    { title: "Latest", dataIndex: "latest" },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: () => <button className="organizer-link">View history →</button>,
    },
  ];
  return (
    <OrganizerPage className="organizer-violation-history">
      <PageHeader
        title="Violation History"
        subtitle="Confirmed violations by Instructor. Data supports decisions; no automatic sanctions."
        actions={
          <Link to="/organizer/content-reports">
            <OrganizerButton>Content reports</OrganizerButton>
          </Link>
        }
      />
      <SectionCard title="Instructor violations">
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={false} />
      </SectionCard>
      <WarningPanel title="Configured warning threshold reached by An Tran">
        This warning does not automatically stop the Instructor or any
        Course.
      </WarningPanel>
    </OrganizerPage>
  );
};

export default ViolationHistory;
