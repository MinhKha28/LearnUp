import { Alert, DatePicker, Empty, Input, Select, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import {
  fetchOrganizationCourseInstructorsAPI,
  fetchOrganizationCoursesAPI,
} from "@/services/course.service";
import type {
  CourseStatus,
  CourseType,
  IOrganizationCourseFilterInstructor,
  IOrganizationCourseInstructor,
  IOrganizationCourseListItem,
} from "@/types/course.types";

import "./courses.scss";

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

const statusTone = (
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

const OrganizationCourses = () => {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const typeParam = searchParams.get("courseType");
  const instructorParam = searchParams.get("instructorId");
  const submittedFrom = searchParams.get("submittedFrom");
  const submittedTo = searchParams.get("submittedTo");
  const [courses, setCourses] = useState<IOrganizationCourseListItem[]>([]);

  const [instructors, setInstructors] = useState<
    IOrganizationCourseFilterInstructor[]
  >([]);

  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") ?? "",
  );

  const [current, setCurrent] = useState(
    Number(searchParams.get("current") ?? 1),
  );

  const [pageSize, setPageSize] = useState(
    Number(searchParams.get("pageSize") ?? 10),
  );

  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const courseType =
    typeParam === "PUBLIC" || typeParam === "PRIVATE" ? typeParam : undefined;

  const status =
    statusParam === "DRAFT" ||
    statusParam === "SUBMITTED" ||
    statusParam === "PUBLISHED" ||
    statusParam === "REJECTED" ||
    statusParam === "ARCHIVED" ||
    statusParam === "DISABLED"
      ? statusParam
      : undefined;

  const updateParams = useCallback(
    (values: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(values).forEach(([key, value]) => {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      });

      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchOrganizationCoursesAPI({
        current,
        pageSize,
        search: searchParams.get("search") || undefined,
        courseType,
        status,
        instructorId: instructorParam || undefined,
        submittedFrom: submittedFrom || undefined,
        submittedTo: submittedTo || undefined,
      });

      if (!response.data) {
        setCourses([]);
        setTotal(0);

        setErrorMessage(
          response.message || "Unable to load Organization Courses.",
        );

        return;
      }

      setCourses(response.data.result);

      setTotal(response.data.meta.total);
    } catch (error) {
      console.error("Fetch Organization Courses error:", error);

      setCourses([]);
      setTotal(0);

      setErrorMessage("Unable to load Organization Courses.");
    } finally {
      setLoading(false);
    }
  }, [
    current,
    pageSize,
    searchParams,
    courseType,
    status,
    instructorParam,
    submittedFrom,
    submittedTo,
  ]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    const loadInstructors = async () => {
      try {
        const response = await fetchOrganizationCourseInstructorsAPI();

        setInstructors(response.data ?? []);
      } catch (error) {
        console.error("Fetch Course instructors error:", error);
      }
    };

    void loadInstructors();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = searchInput.trim();

      const currentSearch = searchParams.get("search") ?? "";

      if (normalized === currentSearch) {
        return;
      }

      setCurrent(1);

      updateParams({
        search: normalized || undefined,
        current: "1",
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput, searchParams, updateParams]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    const nextPageSize = pagination.pageSize ?? pageSize;

    const nextCurrent =
      nextPageSize !== pageSize ? 1 : (pagination.current ?? current);

    setCurrent(nextCurrent);
    setPageSize(nextPageSize);

    updateParams({
      current: String(nextCurrent),
      pageSize: String(nextPageSize),
    });
  };

  const handleReset = () => {
    setSearchInput("");
    setCurrent(1);

    setSearchParams({
      current: "1",
      pageSize: String(pageSize),
    });
  };

  const handleAllCourses = () => {
    setCurrent(1);

    updateParams({
      status: undefined,
      current: "1",
    });
  };

  const handlePendingApproval = () => {
    setCurrent(1);

    updateParams({
      status: "SUBMITTED",
      current: "1",
    });
  };

  const submittedRange: [Dayjs, Dayjs] | null =
    submittedFrom && submittedTo
      ? [dayjs(submittedFrom), dayjs(submittedTo)]
      : null;

  const columns: ColumnsType<IOrganizationCourseListItem> = [
    {
      title: "Course",
      dataIndex: "name",
      key: "name",
      render: (name: string, course) => (
        <div className="organizer-course-name">
          <strong>{name}</strong>
          <span>Version {course.versionNumber}</span>
        </div>
      ),
    },

    {
      title: "Type",
      dataIndex: "courseType",
      key: "courseType",
      width: 110,
      render: (type: CourseType) => (
        <span className="organizer-course-type">{courseTypeLabel[type]}</span>
      ),
    },

    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value: CourseStatus) => (
        <StatusTag tone={statusTone(value)}>
          {courseStatusLabel[value]}
        </StatusTag>
      ),
    },

    {
      title: "Instructor",
      dataIndex: "instructor",
      key: "instructor",
      width: 180,
      render: (instructor: IOrganizationCourseInstructor) => (
        <div className="organizer-course-instructor">
          <strong>{instructor.fullName}</strong>
        </div>
      ),
    },

    {
      title: "Learners",
      dataIndex: "learnerCount",
      key: "learnerCount",
      width: 100,
      align: "center",
      render: (learnerCount: number) => (
        <span className="organizer-course-learners">{learnerCount}</span>
      ),
    },

    {
      title: "Submitted",
      dataIndex: "submittedAt",
      key: "submittedAt",
      width: 145,
      render: (value: string | null) =>
        value ? dayjs(value).format("DD MMM YYYY") : "—",
    },

    {
      title: "Action",
      key: "action",
      width: 100,
      align: "right",
      render: (_, course) => (
        <button
          type="button"
          className="organizer-course-action"
          onClick={() => navigate(`/organizer/courses/${course.id}`)}
        >
          View
        </button>
      ),
    },
  ];

  return (
    <OrganizerPage className="organizer-courses">
      <PageHeader
        title="Organization Courses"
        subtitle="View and filter all Courses managed by your Organization."
      />

      <div className="organizer-course-view-tabs">
        <button
          type="button"
          className={
            status !== "SUBMITTED"
              ? "organizer-course-view-tab active"
              : "organizer-course-view-tab"
          }
          onClick={handleAllCourses}
        >
          All Courses
        </button>

        <button
          type="button"
          className={
            status === "SUBMITTED"
              ? "organizer-course-view-tab active"
              : "organizer-course-view-tab"
          }
          onClick={handlePendingApproval}
        >
          Pending Approval
        </button>
      </div>

      {errorMessage && (
        <Alert
          className="organizer-courses-alert"
          type="error"
          showIcon
          message="Could not load Courses"
          description={errorMessage}
          action={
            <OrganizerButton size="small" onClick={() => void loadCourses()}>
              Retry
            </OrganizerButton>
          }
        />
      )}

      <SectionCard
        title={status === "SUBMITTED" ? "Pending Approval" : "All Courses"}
        extra={
          <span className="organizer-course-count">
            {total} {total === 1 ? "Course" : "Courses"}
          </span>
        }
      >
        <div className="organizer-courses-filters">
          <Input
            allowClear
            placeholder="Search Course"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />

          <Select
            allowClear
            placeholder="All types"
            value={courseType}
            onChange={(value) => {
              setCurrent(1);

              updateParams({
                courseType: value || undefined,
                current: "1",
              });
            }}
            options={[
              {
                value: "PUBLIC",
                label: "Public",
              },
              {
                value: "PRIVATE",
                label: "Private",
              },
            ]}
          />

          <Select
            allowClear
            placeholder="All statuses"
            value={status}
            onChange={(value) => {
              setCurrent(1);

              updateParams({
                status: value || undefined,
                current: "1",
              });
            }}
            options={[
              {
                value: "DRAFT",
                label: "Draft",
              },
              {
                value: "SUBMITTED",
                label: "Submitted",
              },
              {
                value: "PUBLISHED",
                label: "Published",
              },
              {
                value: "REJECTED",
                label: "Rejected",
              },
              {
                value: "ARCHIVED",
                label: "Archived",
              },
              {
                value: "DISABLED",
                label: "Disabled",
              },
            ]}
          />

          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="All instructors"
            value={instructorParam || undefined}
            onChange={(value) => {
              setCurrent(1);

              updateParams({
                instructorId: value || undefined,
                current: "1",
              });
            }}
            options={instructors.map((instructor) => ({
              value: instructor.id,
              label: instructor.fullName,
            }))}
          />

          <DatePicker.RangePicker
            value={submittedRange}
            placeholder={["Submitted from", "Submitted to"]}
            onChange={(range) => {
              setCurrent(1);

              updateParams({
                submittedFrom: range?.[0]?.format("YYYY-MM-DD"),
                submittedTo: range?.[1]?.format("YYYY-MM-DD"),
                current: "1",
              });
            }}
          />

          <OrganizerButton onClick={handleReset}>Reset</OrganizerButton>
        </div>

        <Table<IOrganizationCourseListItem>
          className="organizer-table"
          rowKey="id"
          columns={columns}
          dataSource={courses}
          loading={loading}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No Courses found"
              />
            ),
          }}
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (count) => `${count} Courses`,
            position: ["bottomRight"],
          }}
          onChange={handleTableChange}
        />
      </SectionCard>
    </OrganizerPage>
  );
};

export default OrganizationCourses;
