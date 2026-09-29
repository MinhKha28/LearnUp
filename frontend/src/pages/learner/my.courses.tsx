import { SearchOutlined } from "@ant-design/icons";
import { Input, Select } from "antd";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CourseListItem,
  LearnerButton,
  LearnerPage,
  PageHeader,
} from "@/components/learner/learner.ui";
import "./my.courses.scss";

type CourseType = "required" | "optional";
type CourseStatus = "overdue" | "in-progress" | "completed" | "disabled";

interface IMyCourse {
  id: string;
  title: string;
  type: CourseType;
  status: CourseStatus;
  meta: string;
  progress: number;
  withdrawable?: boolean;
}

const myCourses: IMyCourse[] = [
  {
    id: "workplace-safety",
    title: "Workplace Safety Essentials",
    type: "required",
    status: "overdue",
    meta: "Due 23 Sep 2026",
    progress: 65,
  },
  {
    id: "operational-procedures",
    title: "Operational Procedures",
    type: "required",
    status: "in-progress",
    meta: "Due 30 Sep 2026",
    progress: 32,
  },
  {
    id: "data-protection",
    title: "Data Protection Basics",
    type: "optional",
    status: "in-progress",
    meta: "No deadline",
    progress: 48,
    withdrawable: true,
  },
  {
    id: "service-communication",
    title: "Service Communication",
    type: "optional",
    status: "completed",
    meta: "No deadline",
    progress: 100,
    withdrawable: true,
  },
  {
    id: "vendor-compliance",
    title: "Vendor Compliance Training",
    type: "required",
    status: "disabled",
    meta: "Access disabled",
    progress: 40,
  },
];

const statusPill: Record<
  CourseStatus,
  { label: string; tone: "error" | "neutral" | "success" }
> = {
  overdue: { label: "Overdue", tone: "error" },
  "in-progress": { label: "In Progress", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  disabled: { label: "Disabled", tone: "neutral" },
};

const typePill: Record<CourseType, { label: string; tone: "warning" | "neutral" }> = {
  required: { label: "Required", tone: "warning" },
  optional: { label: "Optional", tone: "neutral" },
};

const MyCourses = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | CourseType>("all");
  const [status, setStatus] = useState<"all" | CourseStatus>("all");
  const [sort, setSort] = useState<"recent" | "az" | "za">("recent");

  const courses = useMemo(() => {
    let list = myCourses.filter((course) =>
      course.title.toLowerCase().includes(search.trim().toLowerCase()),
    );
    if (type !== "all") list = list.filter((course) => course.type === type);
    if (status !== "all") list = list.filter((course) => course.status === status);
    if (sort === "az") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "za") list = [...list].sort((a, b) => b.title.localeCompare(a.title));
    return list;
  }, [search, type, status, sort]);

  return (
    <LearnerPage className="learner-courses">
      <PageHeader
        eyebrow="LEARNER"
        title="My Courses"
        subtitle="Your assigned training and self-enrolled Courses."
        actions={
          <Link to="/learner/catalog">
            <LearnerButton type="primary">Browse Catalog</LearnerButton>
          </Link>
        }
      />
      <div className="learner-courses-filters">
        <Input
          className="learner-courses-search"
          prefix={<SearchOutlined />}
          placeholder="Search Course name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          allowClear
        />
        <Select<"all" | CourseType>
          className="learner-courses-filter"
          variant="borderless"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All types" },
            { value: "required", label: "Required" },
            { value: "optional", label: "Optional" },
          ]}
        />
        <Select<"all" | CourseStatus>
          className="learner-courses-filter"
          variant="borderless"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "overdue", label: "Overdue" },
            { value: "in-progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
            { value: "disabled", label: "Disabled" },
          ]}
        />
        <Select<"recent" | "az" | "za">
          className="learner-courses-sort"
          variant="borderless"
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Sort: Recent" },
            { value: "az", label: "Sort: A to Z" },
            { value: "za", label: "Sort: Z to A" },
          ]}
        />
      </div>
      {courses.length === 0 && (
        <div className="learner-courses-empty">No Courses match your filters.</div>
      )}
      <div className="learner-course-list">
        {courses.map((course) => (
          <CourseListItem
            key={course.id}
            title={course.title}
            pills={[typePill[course.type], statusPill[course.status]]}
            meta={course.meta}
            progress={course.progress}
            to={`/learner/courses/${course.id}`}
            secondary={
              course.withdrawable
                ? {
                    label: "Withdraw",
                    onClick: () => navigate(`/learner/courses/${course.id}/withdraw`),
                  }
                : undefined
            }
          />
        ))}
      </div>
      <div className="learner-courses-info">
        <strong>Required and Optional Courses</strong>
        <p>Optional Courses have no completion deadline and never become overdue.</p>
      </div>
    </LearnerPage>
  );
};

export default MyCourses;
