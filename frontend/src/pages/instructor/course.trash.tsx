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
          setLoadError("Unable to load Course Trash.");
          return;
        }

        setCourses(response.data);
        setNow(Date.now());
      } catch {
        if (!ignore) {
          setCourses([]);
          setLoadError("Unable to connect to the server. Please try again.");
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

      message.success(`"${course.name}" restored successfully.`);
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
      title: "Permanently Delete Course?",
      content: (
        <>
          <p>
            Are you sure you want to permanently delete{" "}
            <strong>{course.name}</strong>?
          </p>
          <p>
            This action cannot be undone. Course content and files that are no
            longer used by other versions will be removed.
          </p>
        </>
      ),
      okText: "Delete Forever",
      cancelText: "Cancel",
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

          message.success(`"${course.name}" permanently deleted.`);

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
      title: "Course",
      dataIndex: "name",
      key: "name",
      render: (name: string, course) => (
        <div className="course-trash-name">
          <strong>{name}</strong>
          <span>Version {course.versionNumber}</span>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: ICourseTrashItem["status"]) => (
        <Tag color={status === "Rejected" ? "red" : "default"}>{status}</Tag>
      ),
    },
    {
      title: "Deleted On",
      dataIndex: "deletedAt",
      key: "deletedAt",
      width: 145,
      render: (date: string) => formatTrashDate(date),
    },
    {
      title: "Recovery Period",
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
      title: "Actions",
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
              Restore
            </Button>

            <Button
              size="small"
              danger
              disabled={Boolean(processingId)}
              icon={<DeleteOutlined />}
              onClick={() => handlePermanentDelete(course)}
            >
              Delete Forever
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <InstructorPage className="course-trash">
      <PageHeader
        eyebrow="INSTRUCTOR / MY COURSES"
        title="Course Trash"
        subtitle="Deleted Courses are kept for 7 days before permanent deletion."
        back
        actions={
          <>
            <InstructorButton
              icon={<ReloadOutlined />}
              onClick={refresh}
              loading={loading}
            >
              Refresh
            </InstructorButton>

            <InstructorButton onClick={() => navigate("/instructor/courses")}>
              Back to My Courses
            </InstructorButton>
          </>
        }
      />

      <Alert
        className="course-trash-notice"
        type="info"
        showIcon
        message="Course and Storage limits"
        description="Courses in Trash still count toward your Course and Storage limits. Use Delete Forever to release eligible resources immediately."
      />

      {loadError && (
        <Alert
          className="course-trash-error"
          type="error"
          showIcon
          message="Unable to load Course Trash"
          description={loadError}
          action={<Button onClick={refresh}>Try Again</Button>}
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
          showTotal: (total) => `${total} deleted Courses`,
        }}
        locale={{
          emptyText: <Empty description="Your Course Trash is empty." />,
        }}
      />
    </InstructorPage>
  );
};

export default CourseTrash;
