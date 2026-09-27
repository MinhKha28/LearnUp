import { Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./content.reports.scss";

type Report = {
  key: string;
  id: string;
  content: string;
  instructor: string;
  status: "Pending" | "Resolved" | "Dismissed";
  deadline: string;
  mine: boolean;
  result?: string;
};

const reports: Report[] = [
  { key: "rep-220", id: "REP-220", content: "Reading: Locked steps", instructor: "An Tran", status: "Pending", deadline: "8h", mine: false },
  { key: "rep-217", id: "REP-217", content: "Quiz question 6", instructor: "Linh Phan", status: "Pending", deadline: "1d", mine: false },
  { key: "rep-216", id: "REP-216", content: "Assignment brief", instructor: "Giao Le", status: "Resolved", deadline: "Closed", mine: true, result: "Violation confirmed" },
  { key: "rep-164", id: "REP-164", content: "Lesson video", instructor: "Vy Nguyen", status: "Resolved", deadline: "Closed", mine: true, result: "No violation" },
];

const statusTone = (status: Report["status"]) =>
  status === "Pending" ? "warning" : status === "Resolved" ? "success" : "neutral";

const ContentReports = () => {
  const navigate = useNavigate();
  const [mineOnly, setMineOnly] = useState(false);
  const rows = useMemo(
    () => reports.filter((item) => (mineOnly ? item.mine : true)),
    [mineOnly],
  );
  const columns: ColumnsType<Report> = [
    { title: "Report", dataIndex: "id" },
    { title: "Content", dataIndex: "content" },
    { title: "Instructor", dataIndex: "instructor" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: Report["status"]) => (
        <StatusTag tone={statusTone(status)}>{status}</StatusTag>
      ),
    },
    mineOnly
      ? { title: "Result", dataIndex: "result", render: (value?: string) => value || "—" }
      : { title: "Deadline", dataIndex: "deadline" },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: (_, item) => (
        <button
          className="organizer-link"
          onClick={() => navigate(`/organizer/content-reports/${item.key}`)}
        >
          View →
        </button>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-content-reports">
      <PageHeader
        title={mineOnly ? "My Reports" : "Content Reports"}
        subtitle={
          mineOnly
            ? "Reports submitted by this Organizer, with proceeding status and result."
            : "Review all reports in the Organization and their handling deadlines."
        }
        actions={
          <OrganizerButton onClick={() => setMineOnly((value) => !value)}>
            {mineOnly ? "All reports" : "My reports"}
          </OrganizerButton>
        }
      />
      {!mineOnly && (
        <div className="organizer-content-reports-filters">
          <Input className="organizer-content-reports-search" placeholder="Search report" />
          <div className="organizer-content-reports-filter-item">
            <span>Status</span>
            <Select
              variant="borderless"
              defaultValue="all"
              options={[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "resolved", label: "Resolved" },
                { value: "dismissed", label: "Dismissed" },
              ]}
            />
          </div>
          <div className="organizer-content-reports-filter-item">
            <span>Severity</span>
            <Select
              variant="borderless"
              defaultValue="all"
              options={[{ value: "all", label: "All" }]}
            />
          </div>
          <div className="organizer-content-reports-filter-item">
            <span>Instructor / Deadline</span>
            <Select
              variant="borderless"
              defaultValue="any"
              options={[{ value: "any", label: "Any" }]}
            />
          </div>
        </div>
      )}
      <SectionCard>
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={false} />
        {mineOnly && (
          <p className="organizer-note organizer-content-reports-note">
            Organizer may submit a report when personally discovering
            problematic content. Content can only be disabled after a report
            has been confirmed as a violation.
          </p>
        )}
      </SectionCard>
    </OrganizerPage>
  );
};

export default ContentReports;
