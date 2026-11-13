import { ApartmentOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Select, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useEffect, useState } from "react";
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

const SEARCH_DEBOUNCE_MS = 400;

const courseTypeLabel: Record<CourseType, string> = {
  Public: "Công khai",
  Private: "Nội bộ",
};

const courseStatusLabel: Record<CourseStatus, string> = {
  Draft: "Bản nháp",
  Submitted: "Chờ phê duyệt",
  Published: "Đã phát hành",
  Rejected: "Bị từ chối",
  Archived: "Đã lưu trữ",
  Disabled: "Đã vô hiệu hóa",
};

const courseStatusTone = (
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

const MyCourses = () => {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<IInstructorCourseListItem[]>([]);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // UC14.4 - searchInput là giá trị đang gõ; search là giá trị đã debounce dùng để gọi API
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [courseType, setCourseType] = useState<"ALL" | CourseType>("ALL");
  const [status, setStatus] = useState<"ALL" | CourseStatus>("ALL");
  const [locked, setLocked] = useState<"ALL" | "LOCKED" | "UNLOCKED">("ALL");
  const hasFilter =
    search !== "" ||
    courseType !== "ALL" ||
    status !== "ALL" ||
    locked !== "ALL";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = searchInput.trim().replace(/\s+/g, " ");
      if (normalized !== search) {
        setSearch(normalized);
        setCurrent(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    // ignore: bỏ kết quả của request cũ khi bộ lọc / trang đổi trước lúc nó trả về
    let ignore = false;
    const fetchCourses = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await fetchManagedCoursesAPI({
          current,
          pageSize,
          search: search || undefined,
          courseType: courseType !== "ALL" ? courseType : undefined,
          status: status !== "ALL" ? status : undefined,
          locked: locked === "ALL" ? undefined : locked === "LOCKED",
        });
        if (ignore) return;

        if (!response.data) {
          setCourses([]);
          setTotal(0);
          setErrorMessage(response.message || "Không thể tải danh sách khóa học.");
          return;
        }

        setCourses(response.data.result);
        setTotal(response.data.meta.total);
      } catch (error) {
        if (ignore) return;
        console.error("Fetch managed courses error:", error);
        setCourses([]);
        setTotal(0);
        setErrorMessage("Không thể tải danh sách khóa học. Vui lòng thử lại.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    void fetchCourses();
    return () => {
      ignore = true;
    };
  }, [current, pageSize, search, courseType, status, locked, reloadKey]);

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
      title: "Khóa học",
      dataIndex: "name",
      render: (name: string) => (
        <div className="instructor-courses-name">
          <strong>{name}</strong>
        </div>
      ),
    },
    {
      title: "Phiên bản",
      dataIndex: "versionNumber",
      render: (versionNumber: number) => `Phiên bản ${versionNumber}`,
    },
    {
      title: "Loại",
      dataIndex: "courseType",
      width: 120,
      render: (courseType: CourseType) => courseTypeLabel[courseType],
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      render: (status: CourseStatus) => (
        <StatusTag tone={courseStatusTone(status)}>
          {courseStatusLabel[status]}
        </StatusTag>
      ),
    },
    {
      title: "Đã khóa",
      dataIndex: "locked",
      width: 110,
      render: (locked: boolean) => (
        <StatusTag tone={locked ? "warning" : "neutral"}>
          {locked ? "Đã khóa" : "Chưa khóa"}
        </StatusTag>
      ),
    },
    {
      title: "Học viên",
      dataIndex: "learnerCount",
      width: 110,
      align: "right",
      render: (learnerCount?: number) => learnerCount ?? "—",
    },
    {
      title: "Thao tác",
      key: "action",
      width: 160,
      render: (_, course) => (
        <button
          type="button"
          className="instructor-courses-action"
          onClick={() => navigate(`/instructor/courses/${course.id}`)}
        >
          <ApartmentOutlined />
          <span>Xem chi tiết</span>
        </button>
      ),
    },
  ];

  return (
    <InstructorPage className="instructor-courses">
      <PageHeader
        eyebrow="Giảng viên"
        title="Khóa học của tôi"
        subtitle="Danh sách khóa học bạn đang phụ trách."
        actions={
          <>
            <InstructorButton
              onClick={() => navigate("/instructor/courses/trash")}
            >
              Thùng rác
            </InstructorButton>

            <InstructorButton type="primary" onClick={handleCreateCourse}>
              + Tạo khóa học
            </InstructorButton>
          </>
        }
      />

      {errorMessage && (
        <Alert
          className="instructor-courses-alert"
          type="error"
          showIcon
          message="Không thể tải danh sách khóa học"
          description={errorMessage}
          action={
            <InstructorButton
              size="small"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Thử lại
            </InstructorButton>
          }
        />
      )}

      {/* UC14.4 */}
      <div className="my-courses__filters">
        <Input
          className="my-courses__search"
          placeholder="Tìm theo tên khóa học"
          prefix={<SearchOutlined />}
          value={searchInput}
          allowClear
          maxLength={200}
          onChange={(event) => setSearchInput(event.target.value)}
        />

        <Select
          className="my-courses__filter"
          value={courseType}
          onChange={(value) => {
            setCurrent(1);
            setCourseType(value);
          }}
          options={[
            { value: "ALL", label: "Tất cả loại khóa học" },
            { value: "Public", label: "Công khai" },
            { value: "Private", label: "Nội bộ" },
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
            { value: "ALL", label: "Tất cả trạng thái" },
            { value: "Draft", label: "Bản nháp" },
            { value: "Submitted", label: "Chờ phê duyệt" },
            { value: "Published", label: "Đã phát hành" },
            { value: "Rejected", label: "Bị từ chối" },
            { value: "Archived", label: "Đã lưu trữ" },
            { value: "Disabled", label: "Đã vô hiệu hóa" },
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
            { value: "ALL", label: "Tất cả trạng thái khóa" },
            { value: "LOCKED", label: "Đã khóa" },
            { value: "UNLOCKED", label: "Chưa khóa" },
          ]}
        />

        <Button onClick={handleResetFilters}>Đặt lại</Button>
      </div>

      <Table<IInstructorCourseListItem>
        className="instructor-table"
        rowKey="id"
        columns={columns}
        dataSource={courses}
        loading={loading}
        locale={{
          emptyText: hasFilter ? (
            <div className="instructor-courses-empty">
              <div className="instructor-courses-empty-icon">
                <SearchOutlined />
              </div>
              <h2>Không tìm thấy khóa học phù hợp.</h2>
              <p>Thử tên khóa học khác hoặc xóa bộ lọc.</p>
              <InstructorButton onClick={handleResetFilters}>
                Xóa bộ lọc
              </InstructorButton>
            </div>
          ) : (
            <div className="instructor-courses-empty">
              <div className="instructor-courses-empty-icon">
                <SearchOutlined />
              </div>
              <h2>Chưa có khóa học</h2>
              <p>Các khóa học được phân công sẽ hiển thị tại đây.</p>
            </div>
          ),
        }}
        pagination={{
          current,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50"],
          showTotal: (value) => `${value} khóa học`,
          position: ["bottomRight"],
        }}
        onChange={handleTableChange}
      />
    </InstructorPage>
  );
};

export default MyCourses;
