import { SearchOutlined } from "@ant-design/icons";
import { Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type CourseStatus,
  type CourseVisibility,
  courseStatusLabel,
  findContentModerationCase,
  instructorCourses,
  isCourseQuotaReached,
} from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import "./my.courses.scss";

type LockFilter = "all" | "locked" | "unlocked";

interface IRow {
  key: string;
  title: string;
  visibility: CourseVisibility;
  status: CourseStatus;
  locked: boolean;
  learners: string;
  action: { label: string; onClick: (navigate: ReturnType<typeof useNavigate>) => void };
}

const actionLabel: Record<CourseStatus, string> = {
  draft: "Open Builder",
  submitted: "View Course",
  published: "Open Course",
  rejected: "Review reason",
};

const MyCourses = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | CourseVisibility>("all");
  const [status, setStatus] = useState<"all" | CourseStatus>("all");
  const [lock, setLock] = useState<LockFilter>("all");

  const rows: IRow[] = instructorCourses.map((course) => ({
    key: course.id,
    title: course.title,
    visibility: course.visibility,
    status: course.status,
    locked: course.locked,
    learners: course.status === "published" ? "[Count]" : "—",
    action: {
      label:
        course.status === "draft" && findContentModerationCase(course.id)
          ? "Review Course"
          : actionLabel[course.status],
      onClick: (nav) =>
        course.status === "draft" && !findContentModerationCase(course.id)
          ? nav(`/instructor/courses/${course.id}/builder`)
          : nav(`/instructor/courses/${course.id}`),
    },
  }));

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (search.trim() && !row.title.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      if (type !== "all" && row.visibility !== type) return false;
      if (status !== "all" && row.status !== status) return false;
      if (lock === "locked" && !row.locked) return false;
      if (lock === "unlocked" && row.locked) return false;
      return true;
    });
  }, [rows, search, type, status, lock]);

  const clearFilters = () => {
    setSearch("");
    setType("all");
    setStatus("all");
    setLock("all");
  };

  const columns: ColumnsType<IRow> = [
    { title: "Course", dataIndex: "title", render: (value) => <strong>{value}</strong> },
    { title: "Type", dataIndex: "visibility" },
    {
      title: "Status",
      dataIndex: "status",
      render: (value: CourseStatus) => {
        const tone =
          value === "published"
            ? "success"
            : value === "submitted"
              ? "info"
              : value === "rejected"
                ? "error"
                : "neutral";
        return <StatusTag tone={tone}>{courseStatusLabel[value]}</StatusTag>;
      },
    },
    { title: "Locked", dataIndex: "locked", render: (value: boolean) => (value ? "Yes" : "No") },
    { title: "Learners", dataIndex: "learners" },
    {
      title: "Action",
      dataIndex: "action",
      render: (value: IRow["action"]) => (
        <button
          type="button"
          className="instructor-courses-action"
          onClick={() => value.onClick(navigate)}
        >
          {value.label}
        </button>
      ),
    },
  ];

  const handleCreateCourse = () => {
    if (isCourseQuotaReached()) {
      navigate("/instructor/courses/create/quota-blocked");
      return;
    }
    navigate("/instructor/courses/create");
  };

  return (
    <InstructorPage className="instructor-courses">
      <PageHeader
        eyebrow="INSTRUCTOR"
        title="My Courses"
        subtitle={
          filtered.length === 0
            ? "No Courses match the current filters."
            : "Courses currently under your responsibility."
        }
        actions={
          <InstructorButton type="primary" onClick={handleCreateCourse}>
            + Create Course
          </InstructorButton>
        }
      />
      <div className="instructor-courses-filters">
        <Input
          className="instructor-courses-search"
          prefix={<SearchOutlined />}
          placeholder="Search Course name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          allowClear
        />
        <Select<"all" | CourseVisibility>
          className="instructor-courses-filter"
          variant="borderless"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All types" },
            { value: "Public", label: "Public" },
            { value: "Private", label: "Private" },
          ]}
        />
        <Select<"all" | CourseStatus>
          className="instructor-courses-filter"
          variant="borderless"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "draft", label: "Draft" },
            { value: "submitted", label: "Submitted" },
            { value: "published", label: "Published" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
        <Select<LockFilter>
          className="instructor-courses-filter"
          variant="borderless"
          value={lock}
          onChange={setLock}
          options={[
            { value: "all", label: "Lock status" },
            { value: "locked", label: "Locked" },
            { value: "unlocked", label: "Unlocked" },
          ]}
        />
      </div>
      {filtered.length > 0 ? (
        <Table
          className="instructor-table"
          columns={columns}
          dataSource={filtered}
          pagination={false}
        />
      ) : (
        <div className="instructor-courses-empty">
          <div className="instructor-courses-empty-icon">
            <SearchOutlined />
          </div>
          <h2>No matching Courses</h2>
          <p>Try another name, type, approval status or lock filter.</p>
          <InstructorButton onClick={clearFilters}>Clear filters</InstructorButton>
        </div>
      )}
    </InstructorPage>
  );
};

export default MyCourses;
