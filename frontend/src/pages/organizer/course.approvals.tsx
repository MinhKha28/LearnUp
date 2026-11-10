import { Alert, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { fetchOrganizationCoursesAPI } from "@/services/course.service";
import type { IOrganizationCourseListItem } from "@/types/course.types";

const isSuccess = (statusCode: unknown) => {
  const status = Number(statusCode);
  return Number.isInteger(status) && status >= 200 && status < 300;
};

const CourseApprovals = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<IOrganizationCourseListItem[]>([]);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchOrganizationCoursesAPI({
        current, pageSize, status: "Submitted",
      });

      // The project interceptor may return a 4xx body without throwing.
      if (
        !isSuccess(response.statusCode) ||
        !response.data ||
        !Array.isArray(response.data.result) ||
        !response.data.meta ||
        !Number.isFinite(response.data.meta.total)
      ) {
        setCourses([]);
        setTotal(0);
        setErrorMessage("Unable to load pending approval Courses.");
        return;
      }

      // Do not offer Review links to Courses that are no longer Submitted.
      setCourses(response.data.result.filter((item) => item.status === "Submitted"));
      setTotal(response.data.meta.total);
    } catch {
      setCourses([]);
      setTotal(0);
      setErrorMessage("Course Service is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [current, pageSize]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const columns: ColumnsType<IOrganizationCourseListItem> = [
    {
      title: "Course",
      dataIndex: "name",
      render: (name: string, item) => (
        <div>
          <strong>{name}</strong>
          <div>Version {item.versionNumber}</div>
        </div>
      ),
    },
    {
      title: "Instructor",
      dataIndex: "instructor",
      render: (value: IOrganizationCourseListItem["instructor"]) =>
        value?.fullName ?? "—",
    },
    {
      title: "Submitted",
      dataIndex: "submittedAt",
      render: (value: string | null) =>
        value ? new Date(value).toLocaleDateString("en-GB") : "—",
    },
    {
      title: "Type",
      dataIndex: "courseType",
      render: (type: IOrganizationCourseListItem["courseType"]) => (
        <StatusTag tone={type === "Public" ? "info" : "neutral"}>
          {type}
        </StatusTag>
      ),
    },
    {
      title: "Action",
      align: "right",
      render: (_, item) => (
        <button
          type="button"
          className="organizer-link"
          onClick={() =>
            navigate(`/organizer/courses/${encodeURIComponent(item.id)}/review`)
          }
        >
          Review
        </button>
      ),
    },
  ];

  const onPageChange = (pagination: TablePaginationConfig) => {
    const nextPageSize = pagination.pageSize ?? pageSize;
    setCurrent(nextPageSize === pageSize ? (pagination.current ?? 1) : 1);
    setPageSize(nextPageSize);
  };

  return (
    <OrganizerPage className="organizer-course-approvals">
      <PageHeader
        title="Courses Awaiting Approval"
        subtitle="Review Courses currently in Submitted status."
        actions={
          <Link to="/organizer/courses">
            <OrganizerButton>All Courses</OrganizerButton>
          </Link>
        }
      />

      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          action={
            <OrganizerButton size="small" onClick={() => void loadCourses()}>
              Retry
            </OrganizerButton>
          }
        />
      )}

      <SectionCard title={`${total} submitted Courses`}>
        <Table
          rowKey="id"
          className="organizer-table"
          columns={columns}
          dataSource={courses}
          loading={loading}
          locale={{ emptyText: "No Courses awaiting approval." }}
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
          }}
          onChange={onPageChange}
        />
      </SectionCard>
    </OrganizerPage>
  );
};

export default CourseApprovals;
