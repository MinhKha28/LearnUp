import { ArrowLeftOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Alert, Input, message, Progress, Radio, Skeleton } from "antd";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
} from "@/components/instructor/instructor.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import { toApiError } from "@/services/api.client";
import {
  createVideoMaterialAPI,
  fetchVideoUploadContextAPI,
} from "@/services/course.service";

import "./course.create.scss";
import "./course.builder.scss";
import "./course.builder.material.video.add.scss";

const MiB = 1024 * 1024;

const formatBytes = (value: string | number): string => {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Không xác định";
  }

  if (bytes < 1024) return `${bytes} B`;

  if (bytes < MiB) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 ** 3) {
    return `${(bytes / MiB).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

const getBlockMessage = (reason: string | null): string => {
  switch (reason) {
    case "SUBSCRIPTION_GRACE":
      return "Gói dịch vụ đang trong thời gian ân hạn. Giảng viên không thể tải học liệu mới lên.";

    case "SUBSCRIPTION_SUSPENDED":
      return "Gói dịch vụ đang bị tạm ngừng. Giảng viên không thể tải học liệu lên.";

    case "COURSE_NOT_EDITABLE":
      return "Không thể chỉnh sửa khóa học hoặc bài học này.";

    default:
      return "Hiện không thể tải video lên. Hãy liên hệ quản lý đào tạo nếu lỗi tiếp diễn.";
  }
};

const getUploadErrorMessage = (error: unknown): string => {
  try {
    const apiError = toApiError(error);

    if (apiError.status === 403) {
      return "Không được phép tải tệp. Gói dịch vụ hoặc quyền giảng viên có thể đã thay đổi.";
    }

    if (apiError.status === 409) {
      return "Trạng thái khóa học hoặc dung lượng lưu trữ đã thay đổi. Hãy tải lại và thử lại.";
    }

    if (apiError.status === 413) {
      return "Video vượt quá dung lượng tải lên cho phép.";
    }

    if (apiError.status === 400) {
      return apiError.message || "Tệp video không hợp lệ.";
    }

    if (apiError.status === 503) {
      return "Dịch vụ tải tệp lên đang tạm thời không khả dụng.";
    }

    return apiError.message || "Không thể tải video lên.";
  } catch {
    return "Không thể tải video lên. Vui lòng thử lại.";
  }
};

const CourseBuilderVideoAdd = () => {
  const { courseId = "", lessonId = "" } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isRequired, setIsRequired] = useState(true);

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const base = `/instructor/courses/${courseId}/builder/lessons/${lessonId}`;

  const listUrl = `${base}/materials`;

  const query = useApiQuery(
    async (signal) => {
      if (!courseId || !lessonId) {
        throw new Error("Thiếu mã khóa học hoặc bài học.");
      }

      const response = await fetchVideoUploadContextAPI(
        courseId,
        lessonId,
        signal,
      );

      if (!response.data) {
        throw new Error("Không thể tải cấu hình tải video lên.");
      }

      return response.data;
    },
    [courseId, lessonId],
  );

  const context = query.data;

  const blocked = !context?.canUpload;

  const handleFile = (selected: File | null) => {
    setFile(null);
    setUploadError(null);
    setProgress(0);

    if (!selected || !context || blocked) {
      return;
    }

    if (selected.size <= 0) {
      message.error("Tệp video không có nội dung.");
      return;
    }

    if (!context.allowedVideoMimeTypes.includes(selected.type)) {
      message.error("Định dạng video không được hỗ trợ.");
      return;
    }

    if (BigInt(selected.size) > BigInt(context.maxVideoSizeBytes)) {
      message.error(
        `Dung lượng video tối đa là ${formatBytes(context.maxVideoSizeBytes)}.`,
      );
      return;
    }

    if (BigInt(selected.size) > BigInt(context.remainingStorageBytes)) {
      message.error("Dung lượng lưu trữ của gói dịch vụ không đủ.");
      return;
    }

    setFile(selected);

    if (!title.trim()) {
      setTitle(selected.name.replace(/\.[^/.]+$/, "").slice(0, 200));
    }
  };

  const handleSave = async () => {
    if (saving || !context?.canUpload || !file) {
      return;
    }

    const normalizedTitle = title.trim();

    if (!normalizedTitle || normalizedTitle.length > 200) {
      message.warning("Nhập tên video (tối đa 200 ký tự).");
      return;
    }

    // Kiểm tra lần cuối ở frontend.
    if (
      !context.allowedVideoMimeTypes.includes(file.type) ||
      file.size <= 0 ||
      BigInt(file.size) > BigInt(context.maxVideoSizeBytes) ||
      BigInt(file.size) > BigInt(context.remainingStorageBytes)
    ) {
      message.error("Video đã chọn không đáp ứng giới hạn tải lên.");
      return;
    }

    setSaving(true);
    setProgress(0);
    setUploadError(null);

    try {
      const response = await createVideoMaterialAPI(
        courseId,
        lessonId,
        {
          title: normalizedTitle,
          // BR-286: Locked chỉ thêm Optional.
          isRequired: context.locked ? false : isRequired,
          file,
        },
        (event) => {
          if (!event.total) return;

          const percent = Math.round((event.loaded / event.total) * 100);

          setProgress(Math.max(0, Math.min(100, percent)));
        },
      );

      if (!response.data?.id) {
        throw new Error("Máy chủ chưa xác nhận tạo video.");
      }

      message.success("Đã thêm học liệu video.");

      navigate(listUrl, { replace: true });
    } catch (error) {
      const errorMessage = getUploadErrorMessage(error);

      setUploadError(errorMessage);
      message.error(errorMessage);

      // Quota / trạng thái có thể đã thay đổi.
      query.reload();
    } finally {
      setSaving(false);
    }
  };

  if (query.status === "loading") {
    return (
      <InstructorPage className="builder-page">
        <Skeleton active paragraph={{ rows: 9 }} />
      </InstructorPage>
    );
  }

  if (query.status === "error" || !context) {
    return (
      <InstructorPage className="builder-page">
        <Alert
          type="error"
          showIcon
          message="Không thể tải cấu hình tải video lên"
          description="Vui lòng kiểm tra kết nối hoặc quyền truy cập."
        />

        <div className="builder-actions">
          <InstructorButton onClick={query.reload}>Thử lại</InstructorButton>

          <InstructorButton onClick={() => navigate(listUrl)}>
            Quay lại học liệu
          </InstructorButton>
        </div>
      </InstructorPage>
    );
  }

  const maxSize = formatBytes(context.maxVideoSizeBytes);

  const remainingStorage = formatBytes(context.remainingStorageBytes);

  const canSave =
    context.canUpload &&
    !!file &&
    !!title.trim() &&
    title.trim().length <= 200 &&
    !saving;

  return (
    <InstructorPage className="builder-page uc17-video-page">
      <span className="builder-crumb">
        Xây dựng khóa học / Học liệu / Thêm video
      </span>

      <div className="builder-hero">
        <h1>Thêm học liệu video</h1>
        <p>
          {context.courseName} / {context.lessonTitle}
        </p>
      </div>

      {!context.canUpload && (
        <Alert
          type="warning"
          showIcon
          message="Không thể tải video lên"
          description={getBlockMessage(context.blockReason)}
          className="uc17-video-alert"
        />
      )}

      {context.locked && (
        <Alert
          type="info"
          showIcon
          message="Khóa học đã khóa"
          description="Theo BR-286, học liệu mới phải được đặt là không bắt buộc."
          className="uc17-video-alert"
        />
      )}

      {uploadError && (
        <Alert
          type="error"
          showIcon
          closable
          message="Tải video lên thất bại"
          description={uploadError}
          onClose={() => setUploadError(null)}
          className="uc17-video-alert"
        />
      )}

      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Thông tin video</h2>

          <label htmlFor="video-title" className="instructor-form-label">
            Tên video
          </label>

          <Input
            id="video-title"
            size="large"
            maxLength={200}
            showCount
            placeholder="Ví dụ: Giới thiệu an toàn lao động"
            value={title}
            disabled={blocked || saving}
            onChange={(event) => setTitle(event.target.value)}
          />

          <label className="instructor-form-label instructor-form-label-spaced">
            Tệp video
          </label>

          <div className="uc17-video-upload">
            <div className="uc17-video-upload-icon">
              <VideoCameraOutlined />
            </div>

            <strong>{file ? file.name : "Chọn tệp video"}</strong>

            <p>Định dạng cho phép: {context.allowedVideoMimeTypes.join(", ")}</p>

            <p>Dung lượng tối đa: {maxSize}</p>

            <input
              ref={fileInputRef}
              type="file"
              accept={context.allowedVideoMimeTypes.join(",")}
              disabled={blocked || saving}
              onChange={(event) => {
                handleFile(event.target.files?.[0] ?? null);

                event.target.value = "";
              }}
            />
          </div>

          {file && (
            <div className="uc17-video-selected">
              <div>
                <strong>{file.name}</strong>
                <span>{formatBytes(file.size)}</span>
              </div>

              <InstructorButton
                size="small"
                disabled={saving}
                onClick={() => {
                  setFile(null);
                  setProgress(0);
                  setUploadError(null);
                }}
              >
                Xóa
              </InstructorButton>
            </div>
          )}

          <label className="instructor-form-label instructor-form-label-spaced">
            Yêu cầu
          </label>

          <Radio.Group
            value={context.locked ? false : isRequired}
            disabled={blocked || saving || context.locked}
            onChange={(event) => setIsRequired(event.target.value === true)}
          >
            <Radio value={true}>Bắt buộc</Radio>
            <Radio value={false}>Không bắt buộc</Radio>
          </Radio.Group>

          {context.locked && (
            <p className="uc17-video-hint">
              Không thể thêm học liệu bắt buộc sau khi khóa học đã khóa.
            </p>
          )}

          {saving && (
            <div className="uc17-video-progress">
              <Progress percent={progress} status="active" />

              <p>
                {progress < 100
                  ? "Đang tải video lên..."
                  : "Đã tải video lên. Hệ thống đang xác minh và lưu dữ liệu..."}
              </p>
            </div>
          )}

          <div className="builder-actions">
            <InstructorButton
              disabled={saving}
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(listUrl)}
            >
              Hủy
            </InstructorButton>

            <InstructorButton
              type="primary"
              loading={saving}
              disabled={!canSave}
              onClick={handleSave}
            >
              Tải video lên
            </InstructorButton>
          </div>
        </div>

        <div className="builder-side">
          <section className="uc17-video-info-card">
            <h3>Quy định tải tệp lên</h3>

            <div className="uc17-video-info-row">
              <span>Dung lượng tệp tối đa</span>
              <strong>{maxSize}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Thời lượng tối đa</span>
              <strong>{context.maxVideoDurationMinutes} min</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Dung lượng còn lại</span>
              <strong>{remainingStorage}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Gói dịch vụ</span>
              <strong>{context.subscriptionStatus ?? "Unavailable"}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Khóa học đã khóa</span>
              <strong>{context.locked ? "Có" : "Không"}</strong>
            </div>

            <p className="uc17-video-hint">
              Máy chủ kiểm tra định dạng, thời lượng video và dung lượng lưu trữ trước khi lưu học liệu.
            </p>
          </section>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderVideoAdd;
