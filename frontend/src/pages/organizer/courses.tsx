import { Empty, Input, Select, Table } from "antd";
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

import { courseStatusText, courseTypeText } from "@/utils/organizer.labels";
import "./courses.scss";
import { VietnameseAlert, VietnameseRangePicker, vietnameseClear, vietnamesePageItem } from "@/components/vietnamese.controls";

const statusTone = (
  status: CourseStatus,
): "neutral" | "success" | "warning" | "error" | "info" => {
  switch (status) {
    case "Published":
      return "success";

    case "Submitted":
      return "info";

    case "Rejected":
    case "Disabled":
      return "error";

    case "Archived":
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
    typeParam === "Public" || typeParam === "Private" ? typeParam : undefined;

  const status =
    statusParam === "Draft" ||
    statusParam === "Submitted" ||
    statusParam === "Published" ||
    statusParam === "Rejected" ||
    statusParam === "Archived" ||
    statusParam === "Disabled"
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
          response.message || "Không thể tải danh sách khóa học của tổ chức.",
        );

        return;
      }

      setCourses(response.data.result);

      setTotal(response.data.meta.total);
    } catch (error) {
      console.error("Fetch Organization Courses error:", error);

      setCourses([]);
      setTotal(0);

      setErrorMessage("Không thể tải danh sách khóa học của tổ chức.");
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
      status: "Submitted",
      current: "1",
    });
  };

  const submittedRange: [Dayjs, Dayjs] | null =
    submittedFrom && submittedTo
      ? [dayjs(submittedFrom), dayjs(submittedTo)]
      : null;

  const columns: ColumnsType<IOrganizationCourseListItem> = [
    {
      title: "Khóa học",
      dataIndex: "name",
      key: "name",
      render: (name: string, course) => (
        <div className="organizer-course-name">
          <strong>{name}</strong>
          <span>Phiên bản {course.versionNumber}</span>
        </div>
      ),
    },

    {
      title: "Loại",
      dataIndex: "courseType",
      key: "courseType",
      width: 110,
      render: (type: CourseType) => (
        <span className="organizer-course-type">{courseTypeText(type)}</span>
      ),
    },

    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value: CourseStatus) => (
        <StatusTag tone={statusTone(value)}>
          {courseStatusText(value)}
        </StatusTag>
      ),
    },

    {
      title: "Giảng viên",
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
      title: "Học viên",
      dataIndex: "learnerCount",
      key: "learnerCount",
      width: 100,
      align: "center",
      render: (learnerCount: number) => (
        <span className="organizer-course-learners">{learnerCount}</span>
      ),
    },

    {
      title: "Ngày gửi phê duyệt",
      dataIndex: "submittedAt",
      key: "submittedAt",
      width: 145,
      render: (value: string | null) =>
        value ? dayjs(value).format("DD/MM/YYYY") : "—",
    },

    {
      title: "Thao tác",
      key: "action",
      width: 100,
      align: "right",
      render: (_, course) => {
        const isPendingApproval =
          status === "Submitted" && course.status === "Submitted";

        const handleViewCourse = () => {
          if (isPendingApproval) {
            navigate(`/organizer/courses/${course.id}/review`);
            return;
          }

          navigate(`/organizer/courses/${course.id}`);
        };

        return (
          <button
            type="button"
            className="organizer-course-action"
            onClick={handleViewCourse}
          >
            {isPendingApproval ? "Xem xét" : "Xem"}
          </button>
        );
      },
    },
  ];

  return (
    <OrganizerPage className="organizer-courses">
      <PageHeader
        title="Khóa học của tổ chức"
        subtitle="Xem và lọc các khóa học do tổ chức quản lý."
      />

      <div className="organizer-course-view-tabs">
        <button
          type="button"
          className={
            status !== "Submitted"
              ? "organizer-course-view-tab active"
              : "organizer-course-view-tab"
          }
          onClick={handleAllCourses}
        >
          Tất cả khóa học
        </button>

        <button
          type="button"
          className={
            status === "Submitted"
              ? "organizer-course-view-tab active"
              : "organizer-course-view-tab"
          }
          onClick={handlePendingApproval}
        >
          Chờ phê duyệt
        </button>
      </div>

      {errorMessage && (
        <VietnameseAlert
          className="organizer-courses-alert"
          type="error"
          showIcon
          message="Không thể tải danh sách khóa học"
          description={errorMessage}
          action={
            <OrganizerButton size="small" onClick={() => void loadCourses()}>
              Thử lại
            </OrganizerButton>
          }
        />
      )}

      <SectionCard
        title={status === "Submitted" ? "Chờ phê duyệt" : "Tất cả khóa học"}
        extra={
          <span className="organizer-course-count">
            {total} khóa học
          </span>
        }
      >
        <div className="organizer-courses-filters">
          <Input
            allowClear={vietnameseClear}
            placeholder="Tìm khóa học"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />

          <Select
            allowClear
            placeholder="Tất cả loại khóa học"
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
                value: "Public",
                label: courseTypeText("Public"),
              },
              {
                value: "Private",
                label: courseTypeText("Private"),
              },
            ]}
          />

          <Select
            allowClear
            placeholder="Tất cả trạng thái"
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
                value: "Draft",
                label: courseStatusText("Draft"),
              },
              {
                value: "Submitted",
                label: courseStatusText("Submitted"),
              },
              {
                value: "Published",
                label: courseStatusText("Published"),
              },
              {
                value: "Rejected",
                label: courseStatusText("Rejected"),
              },
              {
                value: "Archived",
                label: courseStatusText("Archived"),
              },
              {
                value: "Disabled",
                label: courseStatusText("Disabled"),
              },
            ]}
          />

          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả giảng viên"
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

          <VietnameseRangePicker
            value={submittedRange}
            placeholder={["Gửi phê duyệt từ ngày", "Gửi phê duyệt đến ngày"]}
            onChange={(range) => {
              setCurrent(1);

              updateParams({
                submittedFrom: range?.[0]?.format("YYYY-MM-DD"),
                submittedTo: range?.[1]?.format("YYYY-MM-DD"),
                current: "1",
              });
            }}
          />

          <OrganizerButton onClick={handleReset}>Đặt lại</OrganizerButton>
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
                description="Không tìm thấy khóa học"
              />
            ),
          }}
          pagination={{
            itemRender: vietnamesePageItem,
            current,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (count) => `${count} khóa học`,
            position: ["bottomRight"],
          }}
          onChange={handleTableChange}
        />
      </SectionCard>
    </OrganizerPage>
  );
};

export default OrganizationCourses;
