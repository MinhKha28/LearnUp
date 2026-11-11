import { DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, App, Button, Empty, Modal, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
  PageHeader,
} from "@/components/instructor/instructor.ui";

import {
  fetchCourseTrashAPI,
  permanentDeleteCourseAPI,
  restoreCourseAPI,
} from "@/services/course.service";

import type { ICourseTrashItem } from "@/types/course.types";

import {
  courseTrashErrorMessage,
  formatTrashDate,
  formatTrashRemaining,
  getCourseApiErrorCode,
  isTrashExpired,
} from "@/utils/course-trash";

import "./course.trash.scss";

const CourseTrash = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [courses, setCourses] = useState<ICourseTrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Update the countdown every minute while the page is open.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const refresh = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetchCourseTrashAPI();

        if (ignore) return;

        if (!Array.isArray(response.data)) {
          setCourses([]);
          setLoadError("Không thể tải thùng rác khóa học.");
          return;
        }

        setCourses(response.data);
        setNow(Date.now());
      } catch {
        if (!ignore) {
          setCourses([]);
          setLoadError("Không thể kết nối máy chủ. Vui lòng thử lại.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleRestore = async (course: ICourseTrashItem) => {
    if (processingId || isTrashExpired(course.purgeAt)) return;

    setProcessingId(course.id);

    try {
      const response = await restoreCourseAPI(course.id);

      if (!response.data?.restored) {
        const code = getCourseApiErrorCode(response);

        message.error(courseTrashErrorMessage(code, "restore"));
        return;
      }

      message.success(`"${course.name}" đã được khôi phục.`);
      refresh();
    } catch (error) {
      const code = getCourseApiErrorCode(error);
      message.error(courseTrashErrorMessage(code, "restore"));
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = (course: ICourseTrashItem) => {
    if (processingId) return;

    Modal.confirm({
      title: "Xóa vĩnh viễn khóa học?",
      content: (
        <>
          <p>
            Bạn có chắc muốn xóa vĩnh viễn{" "}
            <strong>{course.name}</strong>?
          </p>
          <p>
            Thao tác này không thể hoàn tác. Nội dung khóa học và các tệp không còn
            được phiên bản khác sử dụng sẽ bị xóa.
          </p>
        </>
      ),
      okText: "Xóa vĩnh viễn",
      cancelText: "Hủy",
      okButtonProps: {
        danger: true,
      },

      onOk: async () => {
        setProcessingId(course.id);

        try {
          const response = await permanentDeleteCourseAPI(course.id);

          if (!response.data?.permanentlyDeleted) {
            const code = getCourseApiErrorCode(response);

            message.error(courseTrashErrorMessage(code, "permanent"));
            return;
          }

          message.success(`"${course.name}" đã được xóa vĩnh viễn.`);

          refresh();
        } catch (error) {
          const code = getCourseApiErrorCode(error);

          message.error(courseTrashErrorMessage(code, "permanent"));
        } finally {
          setProcessingId(null);
        }
      },
    });
  };

  const columns: ColumnsType<ICourseTrashItem> = [
    {
      title: "Khóa học",
      dataIndex: "name",
      key: "name",
      render: (name: string, course) => (
        <div className="course-trash-name">
          <strong>{name}</strong>
          <span>Phiên bản {course.versionNumber}</span>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: ICourseTrashItem["status"]) => (
        <Tag color={status === "Rejected" ? "red" : "default"}>{status}</Tag>
      ),
    },
    {
      title: "Ngày xóa",
      dataIndex: "deletedAt",
      key: "deletedAt",
      width: 145,
      render: (date: string) => formatTrashDate(date),
    },
    {
      title: "Thời hạn khôi phục",
      dataIndex: "purgeAt",
      key: "purgeAt",
      width: 170,
      render: (purgeAt: string) => {
        const expired = isTrashExpired(purgeAt, now);

        return (
          <Tag color={expired ? "default" : "blue"}>
            {formatTrashRemaining(purgeAt, now)}
          </Tag>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 245,
      render: (_, course) => {
        const expired = isTrashExpired(course.purgeAt, now);
        const isProcessing = processingId === course.id;

        return (
          <div className="course-trash-actions">
            <Button
              size="small"
              disabled={expired || Boolean(processingId)}
              loading={isProcessing}
              onClick={() => void handleRestore(course)}
            >
              Khôi phục
            </Button>

            <Button
              size="small"
              danger
              disabled={Boolean(processingId)}
              icon={<DeleteOutlined />}
              onClick={() => handlePermanentDelete(course)}
            >
              Xóa vĩnh viễn
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <InstructorPage className="course-trash">
      <PageHeader
        eyebrow="Giảng viên / Khóa học của tôi"
        title="Thùng rác khóa học"
        subtitle="Khóa học đã xóa được giữ trong 7 ngày trước khi xóa vĩnh viễn."
        back
        actions={
          <>
            <InstructorButton
              icon={<ReloadOutlined />}
              onClick={refresh}
              loading={loading}
            >
              Làm mới
            </InstructorButton>

            <InstructorButton onClick={() => navigate("/instructor/courses")}>
              Quay lại khóa học của tôi
            </InstructorButton>
          </>
        }
      />

      <Alert
        className="course-trash-notice"
        type="info"
        showIcon
        message="Giới hạn khóa học và dung lượng lưu trữ"
        description="Khóa học trong thùng rác vẫn tính vào giới hạn số khóa học và dung lượng lưu trữ. Xóa vĩnh viễn để giải phóng tài nguyên đủ điều kiện."
      />

      {loadError && (
        <Alert
          className="course-trash-error"
          type="error"
          showIcon
          message="Không thể tải thùng rác khóa học"
          description={loadError}
          action={<Button onClick={refresh}>Thử lại</Button>}
        />
      )}

      <Table<ICourseTrashItem>
        className="instructor-table course-trash-table"
        rowKey="id"
        columns={columns}
        dataSource={courses}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `${total} khóa học đã xóa`,
        }}
        locale={{
          emptyText: <Empty description="Thùng rác khóa học đang trống." />,
        }}
      />
    </InstructorPage>
  );
};

export default CourseTrash;
