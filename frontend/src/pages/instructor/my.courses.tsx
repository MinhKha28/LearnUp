import { ApartmentOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Select, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { isCourseQuotaReached } from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import { fetchManagedCoursesAPI } from "@/services/course.service";
import type {
  CourseStatus,
  CourseType,
  IInstructorCourseListItem,
} from "@/types/course.types";

import "./my.courses.scss";

const courseTypeLabel: Record<CourseType, string> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
};

const courseStatusLabel: Record<CourseStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
  DISABLED: "Disabled",
};

const courseStatusTone = (
  status: CourseStatus,
): "neutral" | "success" | "warning" | "error" | "info" => {
  switch (status) {
    case "PUBLISHED":
      return "success";
    case "SUBMITTED":
      return "info";
    case "REJECTED":
    case "DISABLED":
      return "error";
    case "ARCHIVED":
      return "warning";
    default:
      return "neutral";
  }
};

const MyCourses = () => {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<IInstructorCourseListItem[]>([]);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [courseType, setCourseType] = useState<"ALL" | CourseType>("ALL");
  const [status, setStatus] = useState<"ALL" | CourseStatus>("ALL");
  const [locked, setLocked] = useState<"ALL" | "LOCKED" | "UNLOCKED">("ALL");

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchManagedCoursesAPI({
        current,
        pageSize,
        search: search.trim() !== "" ? search.trim() : undefined,
        courseType: courseType !== "ALL" ? courseType : undefined,
        status: status !== "ALL" ? status : undefined,
        locked: locked === "ALL" ? undefined : locked === "LOCKED",
      });

      if (!response.data) {
        setCourses([]);
        setTotal(0);
        setErrorMessage(response.message || "Unable to load Courses.");
        return;
      }

      setCourses(response.data.result);
      setTotal(response.data.meta.total);
    } catch (error) {
      console.error("Fetch managed courses error:", error);
      setCourses([]);
      setTotal(0);
      setErrorMessage("Unable to load Courses. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, search, courseType, status, locked]);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  const handleSearch = () => {
    setCurrent(1);
    setSearch(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setCourseType("ALL");
    setStatus("ALL");
    setLocked("ALL");
    setCurrent(1);
  };

  const handleCreateCourse = () => {
    if (isCourseQuotaReached()) {
      navigate("/instructor/courses/create/quota-blocked");
      return;
    }

    navigate("/instructor/courses/create");
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    const nextPageSize = pagination.pageSize ?? pageSize;
    const nextCurrent =
      nextPageSize !== pageSize ? 1 : (pagination.current ?? current);

    setPageSize(nextPageSize);
    setCurrent(nextCurrent);
  };

  const columns: ColumnsType<IInstructorCourseListItem> = [
    {
      title: "Course",
      dataIndex: "name",
      render: (name: string) => (
        <div className="instructor-courses-name">
          <strong>{name}</strong>
        </div>
      ),
    },
    {
      title: "Version",
      dataIndex: "versionNumber",
      render: (versionNumber: number) => `Version ${versionNumber}`,
    },
    {
      title: "Type",
      dataIndex: "courseType",
      width: 120,
      render: (courseType: CourseType) => courseTypeLabel[courseType],
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 140,
      render: (status: CourseStatus) => (
        <StatusTag tone={courseStatusTone(status)}>
          {courseStatusLabel[status]}
        </StatusTag>
      ),
    },
    {
      title: "Locked",
      dataIndex: "locked",
      width: 110,
      render: (locked: boolean) => (
        <StatusTag tone={locked ? "warning" : "neutral"}>
          {locked ? "Locked" : "Unlocked"}
        </StatusTag>
      ),
    },
    {
      title: "Learners",
      dataIndex: "learnerCount",
      width: 110,
      align: "right",
      render: (learnerCount?: number) => learnerCount ?? "—",
    },
    {
      title: "Action",
      key: "action",
      width: 160,
      render: (_, course) => (
        <button
          type="button"
          className="instructor-courses-action"
          onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
        >
          <ApartmentOutlined />
          <span>View Structure</span>
        </button>
      ),
    },
  ];

  return (
    <InstructorPage className="instructor-courses">
      <PageHeader
        eyebrow="INSTRUCTOR"
        title="My Courses"
        subtitle="Courses currently under your responsibility."
        actions={
          <InstructorButton type="primary" onClick={handleCreateCourse}>
            + Create Course
          </InstructorButton>
        }
      />

      {errorMessage && (
        <Alert
          className="instructor-courses-alert"
          type="error"
          showIcon
          message="Could not load Courses"
          description={errorMessage}
          action={
            <InstructorButton size="small" onClick={() => void fetchCourses()}>
              Retry
            </InstructorButton>
          }
        />
      )}

      <div className="my-courses__filters">
        <Input
          className="my-courses__search"
          placeholder="Search Course name"
          prefix={<SearchOutlined />}
          value={searchInput}
          allowClear
          onChange={(event) => {
            const value = event.target.value;
            setSearchInput(value);

            if (value === "") {
              setCurrent(1);
              setSearch("");
            }
          }}
          onPressEnter={handleSearch}
        />

        <Select
          className="my-courses__filter"
          value={courseType}
          onChange={(value) => {
            setCurrent(1);
            setCourseType(value);
          }}
          options={[
            { value: "ALL", label: "All types" },
            { value: "PUBLIC", label: "Public" },
            { value: "PRIVATE", label: "Private" },
          ]}
        />

        <Select
          className="my-courses__filter"
          value={status}
          onChange={(value) => {
            setCurrent(1);
            setStatus(value);
          }}
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "SUBMITTED", label: "Submitted" },
            { value: "PUBLISHED", label: "Published" },
            { value: "REJECTED", label: "Rejected" },
            { value: "ARCHIVED", label: "Archived" },
            { value: "DISABLED", label: "Disabled" },
          ]}
        />

        <Select
          className="my-courses__filter"
          value={locked}
          onChange={(value) => {
            setCurrent(1);
            setLocked(value);
          }}
          options={[
            { value: "ALL", label: "All lock statuses" },
            { value: "LOCKED", label: "Locked" },
            { value: "UNLOCKED", label: "Unlocked" },
          ]}
        />

        <Button type="primary" onClick={handleSearch}>
          Search
        </Button>

        <Button onClick={handleResetFilters}>Reset</Button>
      </div>

      <Table<IInstructorCourseListItem>
        className="instructor-table"
        rowKey="id"
        columns={columns}
        dataSource={courses}
        loading={loading}
        locale={{
          emptyText: (
            <div className="instructor-courses-empty">
              <div className="instructor-courses-empty-icon">
                <SearchOutlined />
              </div>
              <h2>No Courses yet</h2>
              <p>Courses assigned to you will appear here.</p>
            </div>
          ),
        }}
        pagination={{
          current,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50"],
          showTotal: (value) => `${value} Courses`,
          position: ["bottomRight"],
        }}
        onChange={handleTableChange}
      />
    </InstructorPage>
  );
};

export default MyCourses;
