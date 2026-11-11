import {
  ArrowLeftOutlined,
  FilePdfOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";

import { Alert, Input, message, Modal, Progress, Radio, Skeleton } from "antd";

import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
} from "@/components/instructor/instructor.ui";

import {
  fetchCourseLessonDetailAPI,
  replaceTechnicalMaterialAPI,
  updateMaterialAPI,
} from "@/services/course.service";

import type {
  IInstructorLessonDetail,
  IInstructorLessonMaterial,
} from "@/types/course.types";

import "./course.create.scss";
import "./course.builder.scss";
import "./course.builder.material.video.add.scss";
import "./course.builder.material.edit.scss";

const MiB = 1024 * 1024;

const formatBytes = (value: number | string): string => {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Không xác định dung lượng";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < MiB) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 ** 3) {
    return `${(bytes / MiB).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

const getReplacementSizeError = (failure: unknown): string | undefined => {
  const response = isAxiosError<unknown>(failure) ? failure.response : undefined;
  const body = response?.data ?? failure;
  const envelope =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const details =
    envelope.error && typeof envelope.error === "object"
      ? (envelope.error as Record<string, unknown>)
      : envelope;

  if (
    Number(response?.status ?? envelope.statusCode) !== 413 &&
    envelope.code !== "FILE_TOO_LARGE" &&
    details.code !== "FILE_TOO_LARGE"
  ) {
    return;
  }

  const maxSizeBytes = details.maxSizeBytes ?? envelope.maxSizeBytes;
  const limit =
    typeof maxSizeBytes === "number" &&
    Number.isFinite(maxSizeBytes) &&
    maxSizeBytes > 0
      ? ` (${(maxSizeBytes / MiB).toLocaleString("vi-VN", {
          maximumFractionDigits: 2,
        })} MB)`
      : "";

  return `Tệp vượt quá kích thước cho phép${limit}. Vui lòng chọn tệp nhỏ hơn.`;
};

const ensureApiSuccess = <T,>(response: IBackendRes<T>): T => {
  const statusCode = Number(response.statusCode);

  if (!Number.isInteger(statusCode) || statusCode < 200 || statusCode >= 300) {
    const message = Array.isArray(response.error)
      ? response.error.join(", ")
      : response.message || response.error;

    throw new Error(message || "Không thể hoàn tất yêu cầu.");
  }

  if (response.data === undefined || response.data === null) {
    throw new Error("Không thể xác minh phản hồi từ máy chủ.");
  }

  return response.data;
};

const CourseBuilderMaterialEdit = () => {
  const { courseId = "", lessonId = "", materialId = "" } = useParams();

  const navigate = useNavigate();

  // 1. Material data
  const [detail, setDetail] = useState<IInstructorLessonDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2. Form
  const [title, setTitle] = useState("");
  const [isRequired, setIsRequired] = useState(false);

  // 3. Technical Replacement
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  const [progress, setProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);

  const materialsUrl =
    `/instructor/courses/${courseId}` +
    `/builder/lessons/${lessonId}/materials`;

  const material: IInstructorLessonMaterial | undefined =
    detail?.materials.find((item) => item.id === materialId);

  const locked = detail?.course.locked ?? false;

  // ==================================================
  // LOAD MATERIAL FROM BACKEND
  // ==================================================
  useEffect(() => {
    if (!courseId || !lessonId || !materialId) {
      setLoading(false);
      setError("Mã khóa học, bài học hoặc học liệu không hợp lệ.");
      return;
    }

    let cancelled = false;

    const loadMaterial = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchCourseLessonDetailAPI(courseId, lessonId);

        if (!response.data) {
          throw new Error("Không tìm thấy thông tin bài học.");
        }

        const lessonDetail = ensureApiSuccess(response);

        const found = lessonDetail.materials.find(
          (item) => item.id === materialId,
        );

        if (!found) {
          throw new Error("Không tìm thấy học liệu.");
        }

        if (cancelled) return;

        setDetail(lessonDetail);
        setTitle(found.title);
        setIsRequired(found.isRequired);
        setReplacementFile(null);
        setProgress(0);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải thông tin học liệu.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMaterial();

    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId, materialId]);

  // ==================================================
  // SELECT REPLACEMENT FILE
  // ==================================================
  const handleReplacementFile = (selected: File | null) => {
    setReplacementFile(null);
    setProgress(0);

    if (!selected || !material || saving) {
      return;
    }

    const isVideo = material.materialType === "Video";
    const isReading = material.materialType === "Reading";

    if (!isVideo && !isReading) {
      message.error("Loại học liệu không được hỗ trợ.");
      return;
    }

    if (selected.size <= 0) {
      message.error("Tệp đã chọn không có nội dung.");
      return;
    }

    const maxBytes = isVideo ? 500 * MiB : 50 * MiB;

    if (selected.size > maxBytes) {
      message.error(
        `File exceeds the upload transport limit of ${formatBytes(maxBytes)}.`,
      );
      return;
    }

    if (isReading && selected.type !== "application/pdf") {
      message.error("Chỉ hỗ trợ tài liệu đọc định dạng PDF.");
      return;
    }

    if (
      isVideo &&
      !["video/mp4", "video/webm", "video/quicktime"].includes(selected.type)
    ) {
      message.error("Định dạng video không được hỗ trợ.");
      return;
    }

    setReplacementFile(selected);
  };

  // ==================================================
  // SAVE CHANGES
  // One button, but two independent backend APIs.
  // ==================================================
  const handleSaveChanges = async () => {
    if (!material || saving) return;

    const normalizedTitle = title.trim();

    if (!normalizedTitle || normalizedTitle.length > 200) {
      message.warning("Tên học liệu phải có từ 1 đến 200 ký tự.");
      return;
    }

    const metadataChanged =
      normalizedTitle !== material.title ||
      (!locked && isRequired !== material.isRequired);

    const hasReplacement = replacementFile !== null;

    if (!metadataChanged && !hasReplacement) {
      message.info("Không có thay đổi để lưu.");
      return;
    }

    // Performs only requested operations.
    const executeSave = async () => {
      setSaving(true);
      setProgress(0);

      let fileReplaced = false;

      try {
        // STEP 1: Replace technical file if selected.
        if (replacementFile) {
          setUploadingFile(true);

          const response = await replaceTechnicalMaterialAPI(
            courseId,
            lessonId,
            materialId,
            replacementFile,
            (event) => {
              if (!event.total) return;

              const percent = Math.min(
                100,
                Math.round((event.loaded / event.total) * 100),
              );

              setProgress(percent);
            },
          );

          const sizeError = getReplacementSizeError(response);
          if (sizeError) {
            message.error(sizeError, 8);
            return;
          }

          const replaced = ensureApiSuccess(response);

          if (
            replaced.materialId !== materialId ||
            replaced.fileId !== material.fileId
          ) {
            throw new Error(
              "Phản hồi thay tệp không khớp với học liệu hiện tại.",
            );
          }

          fileReplaced = true;
          setUploadingFile(false);
        }

        // STEP 2: Save metadata if changed.

        if (metadataChanged) {
          const response = await updateMaterialAPI(
            courseId,
            lessonId,
            materialId,
            {
              title: normalizedTitle,
              ...(locked ? {} : { isRequired }),
            },
          );

          const updated = ensureApiSuccess(response);

          if (updated.id !== materialId) {
            throw new Error(
              "Phản hồi cập nhật không khớp với học liệu hiện tại.",
            );
          }
        }

        message.success("Đã lưu học liệu.");

        navigate(materialsUrl, {
          replace: true,
        });
      } catch (err) {
        if (fileReplaced && metadataChanged) {
          message.error(
            "Đã thay thế tệp kỹ thuật thành công, " +
              "nhưng chưa lưu được thông tin học liệu. " +
              "Hãy tải lại trang và cập nhật thông tin. " +
              "Không tải lại tệp thay thế.",
            8,
          );

          setReplacementFile(null);
          setProgress(0);
        } else if (replacementFile && !fileReplaced) {
          message.error(
            getReplacementSizeError(err) ??
              "Chưa xác nhận được việc thay thế tệp. " +
                "Tải lại trang và kiểm tra tệp hiện tại trước khi thử lại.",
            8,
          );
        } else {
          message.error(
            err instanceof Error
              ? err.message
              : "Không thể lưu học liệu.",
          );
        }
      } finally {
        setUploadingFile(false);
        setSaving(false);
      }
    };

    // Technical replacement affects the shared MediaFile,
    // so ask for confirmation before starting.
    if (hasReplacement) {
      Modal.confirm({
        title: "Xác nhận thay thế tệp kỹ thuật",
        content:
          "Thao tác này thay thế tệp kỹ thuật dùng chung. " +
          "Mọi phiên bản khóa học tham chiếu đến tệp này " +
          "có thể bị ảnh hưởng. Hãy xác nhận nội dung " +
          "học tập không thay đổi.",
        okText: "Xác nhận và lưu",
        cancelText: "Hủy",
        onOk: executeSave,
      });

      return;
    }

    await executeSave();
  };

  // ==================================================
  // LOADING
  // ==================================================
  if (loading) {
    return (
      <InstructorPage className="builder-page">
        <Skeleton active paragraph={{ rows: 9 }} />
      </InstructorPage>
    );
  }

  // ==================================================
  // ERROR
  // ==================================================
  if (error || !detail || !material) {
    return (
      <InstructorPage className="builder-page">
        <Alert
          type="error"
          showIcon
          message={error || "Không tìm thấy học liệu."}
        />

        <div className="builder-actions">
          <InstructorButton
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(materialsUrl)}
          >
            Quay lại học liệu
          </InstructorButton>
        </div>
      </InstructorPage>
    );
  }

  // ==================================================
  // VIEW STATE
  // ==================================================
  const editable = ["Draft", "Rejected", "Published"].includes(
    detail.course.status,
  );

  const isVideo = material.materialType === "Video";
  const isReading = material.materialType === "Reading";

  const maxUploadBytes = isVideo ? 500 * MiB : 50 * MiB;

  const fileAccept = isReading
    ? ".pdf,application/pdf"
    : "video/mp4,video/webm,video/quicktime";

  const metadataChanged =
    title.trim() !== material.title ||
    (!locked && isRequired !== material.isRequired);

  const hasChanges = metadataChanged || replacementFile !== null;

  const canSave =
    editable &&
    !saving &&
    !!title.trim() &&
    title.trim().length <= 200 &&
    hasChanges;

  return (
    <InstructorPage className="builder-page uc17-video-page">
      {/* ================= HEADER ================= */}
      <span className="builder-crumb">
        Xây dựng khóa học / Học liệu / Chỉnh sửa
      </span>

      <div className="builder-hero">
        <h1>Chỉnh sửa học liệu</h1>

        <p>
          {detail.course.name} / {detail.lesson.title}
        </p>
      </div>

      {/* ================= ALERTS ================= */}
      {locked && (
        <Alert
          type="info"
          showIcon
          message="Khóa học đã khóa"
          description={
            "Vẫn có thể sửa tên học liệu và thay tệp lỗi kỹ thuật. " +
            "Không thể thay đổi trạng thái bắt buộc."
          }
          className="uc17-video-alert"
        />
      )}

      {!editable && (
        <Alert
          type="warning"
          showIcon
          message="Không thể chỉnh sửa học liệu"
          description="Trạng thái khóa học hiện tại không cho phép chỉnh sửa học liệu này."
          className="uc17-video-alert"
        />
      )}

      {/* ================= MAIN LAYOUT ================= */}
      <div className="builder-grid">
        {/* ============ LEFT COLUMN ============ */}
        <div className="builder-update-card">
          <h2>Thông tin học liệu</h2>

          {/* TITLE */}
          <label
            htmlFor="edit-material-title"
            className="instructor-form-label"
          >
            Tên học liệu
          </label>

          <Input
            id="edit-material-title"
            size="large"
            maxLength={200}
            showCount
            placeholder="Nhập tên học liệu"
            value={title}
            disabled={!editable || saving}
            onChange={(event) => setTitle(event.target.value)}
          />

          {/* REQUIREMENT */}
          <label className="instructor-form-label instructor-form-label-spaced">
            Yêu cầu
          </label>

          <Radio.Group
            value={isRequired}
            disabled={!editable || locked || saving}
            onChange={(event) => setIsRequired(event.target.value === true)}
          >
            <Radio value={true}>Bắt buộc</Radio>
            <Radio value={false}>Không bắt buộc</Radio>
          </Radio.Group>

          {locked && (
            <p className="uc17-video-hint">
              Không thể thay đổi thuộc tính bắt buộc khi khóa học đã khóa.
            </p>
          )}

          {/* ============ TECHNICAL FILE ============ */}
          <div className="uc17-edit-replacement">
            <h2>
              Thay thế tệp để sửa lỗi kỹ thuật
              <span className="uc17-edit-optional"> (Không bắt buộc)</span>
            </h2>

            <Alert
              type="warning"
              showIcon
              message="Chỉ sửa lỗi kỹ thuật"
              description={
                "Tệp thay thế phải giữ nguyên " +
                "nội dung học tập. Các phiên bản khóa học " +
                "tham chiếu đến tệp dùng chung này có thể bị ảnh hưởng."
              }
              className="uc17-video-alert"
            />

            {/* CURRENT FILE */}
            <label className="instructor-form-label">Tệp hiện tại</label>

            <p className="instructor-form-help">
              {material.file.originalFilename}
            </p>

            {/* FILE SELECT */}
            <label className="instructor-form-label instructor-form-label-spaced">
              Tệp thay thế {isVideo ? "Video" : "Reading"} file
            </label>

            <div className="uc17-video-upload">
              <div className="uc17-video-upload-icon">
                {isVideo ? <VideoCameraOutlined /> : <FilePdfOutlined />}
              </div>

              <strong>
                {replacementFile
                  ? replacementFile.name
                  : isVideo
                    ? "Chọn video thay thế"
                    : "Chọn tài liệu PDF thay thế"}
              </strong>

              <p>
                Allowed formats:{" "}
                {isVideo
                  ? "MP4, WebM, MOV (subject to Platform Settings)"
                  : "PDF"}
              </p>

              <p>Giới hạn dung lượng truyền tải: {formatBytes(maxUploadBytes)}</p>

              <input
                type="file"
                accept={fileAccept}
                aria-label="Chọn tệp thay thế"
                disabled={!editable || saving}
                onChange={(event) => {
                  handleReplacementFile(event.target.files?.[0] ?? null);

                  // Allow choosing the same filename again.
                  event.target.value = "";
                }}
              />
            </div>

            {/* SELECTED FILE */}
            {replacementFile && (
              <div className="uc17-video-selected">
                <div>
                  <strong>{replacementFile.name}</strong>

                  <span>{formatBytes(replacementFile.size)}</span>
                </div>

                <InstructorButton
                  size="small"
                  disabled={saving}
                  onClick={() => {
                    setReplacementFile(null);
                    setProgress(0);
                  }}
                >
                  Xóa
                </InstructorButton>
              </div>
            )}

            {/* UPLOAD PROGRESS */}
            {saving && uploadingFile && (
              <div className="uc17-video-progress">
                <Progress percent={progress} status="active" />

                <p>
                  {progress < 100
                    ? "Đang tải tệp thay thế lên..."
                    : "Đã tải tệp lên. Đang xác minh và lưu tệp thay thế..."}
                </p>
              </div>
            )}
          </div>

          {/* ================= ONE ACTION BAR ================= */}
          <div className="builder-actions">
            <InstructorButton
              icon={<ArrowLeftOutlined />}
              disabled={saving}
              onClick={() => navigate(materialsUrl)}
            >
              Hủy
            </InstructorButton>

            <InstructorButton
              type="primary"
              loading={saving}
              disabled={!canSave}
              onClick={() => void handleSaveChanges()}
            >
              Lưu thay đổi
            </InstructorButton>
          </div>
        </div>

        {/* ============ RIGHT COLUMN ============ */}
        <div className="builder-side">
          <section className="uc17-video-info-card">
            <h3>Chi tiết học liệu</h3>

            <div className="uc17-video-info-row">
              <span>Loại học liệu</span>
              <strong>{material.materialType}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Tên tệp hiện tại</span>
              <strong>{material.file.originalFilename}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Dung lượng tệp hiện tại</span>
              <strong>{formatBytes(material.file.sizeBytes)}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Yêu cầu</span>
              <strong>{material.isRequired ? "Bắt buộc" : "Không bắt buộc"}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Khóa học đã khóa</span>
              <strong>{locked ? "Yes" : "No"}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Trạng thái tệp</span>
              <strong>{material.file.status}</strong>
            </div>

            {isVideo && (
              <div className="uc17-video-info-row">
                <span>Thời lượng video</span>
                <strong>
                  {material.file.durationSeconds !== null
                    ? `${Math.ceil(material.file.durationSeconds / 60)} min`
                    : "Không có thông tin"}
                </strong>
              </div>
            )}

            {isReading && (
              <div className="uc17-video-info-row">
                <span>Số từ</span>
                <strong>{material.file.wordCount ?? "Không có thông tin"}</strong>
              </div>
            )}

            <p className="uc17-video-hint">
              Technical replacement updates the shared MediaFile without
              creating a new Material or changing its Required setting.
            </p>
          </section>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderMaterialEdit;
