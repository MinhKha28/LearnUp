import { Alert, Empty, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { fetchOrganizationCoursesAPI } from "@/services/course.service";
import type {
  CourseStatus,
  CourseType,
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

  const [courses, setCourses] = useState<IOrganizationCourseListItem[]>([]);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchOrganizationCoursesAPI({
        current,
        pageSize,
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
  }, [current, pageSize]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    const nextPageSize = pagination.pageSize ?? pageSize;

    if (nextPageSize !== pageSize) {
      setPageSize(nextPageSize);
      setCurrent(1);
      return;
    }

    setCurrent(pagination.current ?? 1);
  };

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
      render: (courseType: CourseType) => (
        <span className="organizer-course-type">
          {courseTypeLabel[courseType]}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: CourseStatus) => (
        <StatusTag tone={statusTone(status)}>
          {courseStatusLabel[status]}
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
        subtitle="View all Courses managed by your Organization."
      />

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
        title="All Courses"
        extra={
          <span className="organizer-course-count">
            {total} {total === 1 ? "Course" : "Courses"}
          </span>
        }
      >
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
