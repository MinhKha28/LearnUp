import { Alert, Input, message, Progress, Radio, Skeleton } from "antd";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
} from "@/components/instructor/instructor.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import {
  createReadingMaterialAPI,
  fetchReadingUploadContextAPI,
} from "@/services/course.service";
import {
  getReadingParseBusyMessage,
  readReadingUploadFailure,
} from "@/utils/reading.upload.error";

import "./course.create.scss";
import "./course.builder.scss";

const formatBytes = (value: string | number) => {
  const bytes = Number(value);

  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const DEFAULT_UPLOAD_ERROR = "Không thể tải tài liệu đọc lên.";
const NO_RESPONSE_ERROR = "Không gửi được tệp. Vui lòng kiểm tra kết nối rồi thử lại.";

// courseAxios trả body lỗi như response thường, nên đọc cả body lẫn lỗi Axios.
const getCreateReadingErrorMessage = (error: unknown): string => {
  const busy = getReadingParseBusyMessage(error);

  if (busy) return busy;

  const failure = readReadingUploadFailure(error);

  if (failure?.status === 403) {
    return "Gói dịch vụ hoặc quyền giảng viên không cho phép tải tệp lên.";
  }

  if (failure?.status === 409) {
    return "Trạng thái khóa học hoặc dung lượng lưu trữ đã thay đổi.";
  }

  if (failure?.status === 413) {
    return "Tài liệu đọc vượt quá dung lượng cho phép.";
  }

  if (failure) return failure.message || DEFAULT_UPLOAD_ERROR;

  // Không có response HTTP: lỗi mạng, hết thời gian chờ hoặc request bị hủy.
  if (isAxiosError(error) && !error.response) return NO_RESPONSE_ERROR;

  return error instanceof Error && error.message
    ? error.message
    : DEFAULT_UPLOAD_ERROR;
};

const CourseBuilderReadingAdd = () => {
  const { courseId = "", lessonId = "" } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isRequired, setIsRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);

  const listUrl = `/instructor/courses/${courseId}/builder/lessons/${lessonId}/materials`;

  const query = useApiQuery(
    async (signal) => {
      const response = await fetchReadingUploadContextAPI(
        courseId,
        lessonId,
        signal,
      );

      if (!response.data) {
        throw new Error("Không thể tải cấu hình tải tài liệu đọc.");
      }

      return response.data;
    },
    [courseId, lessonId],
  );

  const context = query.data;
  const blocked = !context?.canUpload;

  const handleFile = (selected: File | null) => {
    setFile(null);

    if (!selected || !context || blocked) return;

    if (!context.allowedReadingMimeTypes.includes(selected.type)) {
      message.error("Định dạng tài liệu đọc không được hỗ trợ.");
      return;
    }

    if (
      selected.size <= 0 ||
      BigInt(selected.size) > BigInt(context.maxReadingSizeBytes)
    ) {
      message.error("Tài liệu đọc vượt quá dung lượng cho phép.");
      return;
    }

    if (BigInt(selected.size) > BigInt(context.remainingStorageBytes)) {
      message.error("Dung lượng lưu trữ của gói dịch vụ không đủ.");
      return;
    }

    setFile(selected);
    setProgress(0);

    if (!title.trim()) {
      setTitle(selected.name.replace(/\.[^/.]+$/, "").slice(0, 200));
    }
  };

  const handleSave = async () => {
    if (saving || !context?.canUpload || !file) return;

    const normalizedTitle = title.trim();

    if (!normalizedTitle || normalizedTitle.length > 200) {
      message.warning("Nhập tên tài liệu đọc hợp lệ.");
      return;
    }

    // Kiểm tra lại trước khi gửi.
    if (
      !context.allowedReadingMimeTypes.includes(file.type) ||
      file.size <= 0 ||
      BigInt(file.size) > BigInt(context.maxReadingSizeBytes) ||
      BigInt(file.size) > BigInt(context.remainingStorageBytes)
    ) {
      message.error("Tài liệu đã chọn không đáp ứng giới hạn tải lên.");
      return;
    }

    setSaving(true);
    setWarning(null);
    setProgress(0);

    try {
      const response = await createReadingMaterialAPI(
        courseId,
        lessonId,
        {
          title: normalizedTitle,
          isRequired: context.locked ? false : isRequired,
          file,
        },
        (event) => {
          if (!event.total) return;

          setProgress(
            Math.min(100, Math.round((event.loaded / event.total) * 100)),
          );
        },
      );

      if (readReadingUploadFailure(response)) {
        throw response;
      }

      if (!response.data?.id) {
        throw new Error("Không thể lưu tài liệu đọc.");
      }

      // BR-293: upload thành công nhưng không trích được chữ.
      if (response.data.extractionWarning) {
        setWarning(response.data.extractionWarning);
        setFile(null);
        query.reload();
        message.warning("Đã lưu tài liệu nhưng không trích xuất được từ nào.");
        return;
      }

      message.success(`Đã lưu tài liệu đọc: ${response.data.wordCount} từ.`);

      navigate(listUrl, { replace: true });
    } catch (error) {
      message.error(getCreateReadingErrorMessage(error));
      query.reload();
    } finally {
      setSaving(false);
    }
  };

  if (query.status === "loading") {
    return (
      <InstructorPage className="builder-page">
        <Skeleton active paragraph={{ rows: 8 }} />
      </InstructorPage>
    );
  }

  if (query.status === "error" || !context) {
    return (
      <InstructorPage className="builder-page">
        <Alert
          type="error"
          showIcon
          message="Không thể tải cấu hình tài liệu đọc"
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

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">
        Xây dựng khóa học / Học liệu / Thêm tài liệu đọc
      </span>

      <div className="builder-hero">
        <h1>Thêm tài liệu đọc</h1>
        <p>
          {context.courseName} / {context.lessonTitle}
        </p>
      </div>

      {!context.canUpload && (
        <Alert
          type="warning"
          showIcon
          message="Không thể tải tài liệu đọc lên"
          description={
            context.blockReason === "SUBSCRIPTION_GRACE"
              ? "Gói dịch vụ đang trong thời gian ân hạn."
              : context.blockReason === "SUBSCRIPTION_SUSPENDED"
                ? "Gói dịch vụ đang bị tạm ngừng."
                : "Khóa học hoặc gói dịch vụ không cho phép tải tệp lên."
          }
          style={{ marginBottom: 20 }}
        />
      )}

      {context.locked && (
        <Alert
          type="info"
          showIcon
          message="Khóa học đã khóa"
          description="Theo BR-286, tài liệu đọc mới phải được đặt là không bắt buộc."
          style={{ marginBottom: 20 }}
        />
      )}

      {warning && (
        <Alert
          type="warning"
          showIcon
          message="Đã lưu tài liệu đọc nhưng có cảnh báo"
          description={
            <>
              <p>{warning}</p>
              <InstructorButton
                onClick={() => navigate(listUrl, { replace: true })}
              >
                Xem tài liệu đọc đã lưu
              </InstructorButton>
            </>
          }
          style={{ marginBottom: 20 }}
        />
      )}

      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Thông tin tài liệu đọc</h2>

          <label className="instructor-form-label">Tên tài liệu đọc</label>

          <Input
            size="large"
            maxLength={200}
            showCount
            placeholder="Nhập tên tài liệu đọc"
            value={title}
            disabled={blocked || saving || !!warning}
            onChange={(event) => setTitle(event.target.value)}
          />

          <label className="instructor-form-label instructor-form-label-spaced">
            Tệp tài liệu đọc
          </label>

          <label className="builder-upload-box">
            <strong>{file ? file.name : "Chọn tài liệu PDF"}</strong>

            <p>Định dạng cho phép: PDF</p>

            <p>
              Giới hạn dung lượng truyền tải:{" "}
              {formatBytes(context.maxReadingSizeBytes)}
            </p>

            <input
              type="file"
              accept={context.allowedReadingMimeTypes.join(",")}
              disabled={blocked || saving || !!warning}
              onChange={(event) => {
                handleFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>

          {file && (
            <p className="instructor-form-help">
              Tệp đã chọn: {file.name} ({formatBytes(file.size)})
            </p>
          )}

          <label className="instructor-form-label instructor-form-label-spaced">
            Yêu cầu
          </label>

          <Radio.Group
            value={context.locked ? false : isRequired}
            disabled={blocked || saving || context.locked || !!warning}
            onChange={(event) => setIsRequired(event.target.value === true)}
          >
            <Radio value={true}>Bắt buộc</Radio>
            <Radio value={false}>Không bắt buộc</Radio>
          </Radio.Group>

          <p className="instructor-form-help">
            Hệ thống tự tính số từ sau khi tải tệp lên.
          </p>

          {saving && (
            <div style={{ marginTop: 24 }}>
              <Progress percent={progress} status="active" />
              <p>
                {progress < 100
                  ? "Đang tải tài liệu đọc lên..."
                  : "Đang trích xuất văn bản và lưu tài liệu đọc..."}
              </p>
            </div>
          )}

          <div className="builder-actions">
            <InstructorButton
              disabled={saving}
              onClick={() => navigate(listUrl)}
            >
              Hủy
            </InstructorButton>

            <InstructorButton
              type="primary"
              loading={saving}
              disabled={blocked || !file || !title.trim() || !!warning}
              onClick={handleSave}
            >
              Tải tài liệu đọc lên
            </InstructorButton>
          </div>
        </div>

        <div className="builder-side">
          <section className="builder-update-card">
            <h3>Quy định đối với tài liệu đọc</h3>

            <p>
              Dung lượng còn lại: {formatBytes(context.remainingStorageBytes)}
            </p>

            <p>Tốc độ đọc: {context.readingSpeedWordsPerMinute} từ/phút</p>

            <p>
              Tài liệu được quét mà không trích xuất được chữ sẽ được lưu với số từ bằng 0 kèm cảnh báo.
            </p>
          </section>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderReadingAdd;
