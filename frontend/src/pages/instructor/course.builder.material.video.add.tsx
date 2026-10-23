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
    return "Unknown";
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
      return "Subscription is in Grace period. Instructors cannot upload new learning materials.";

    case "SUBSCRIPTION_SUSPENDED":
      return "Subscription is Suspended. Instructors cannot upload learning materials.";

    case "COURSE_NOT_EDITABLE":
      return "This Course or Lesson is not editable.";

    default:
      return "Video upload is currently unavailable. Contact your Organizer if the problem continues.";
  }
};

const getUploadErrorMessage = (error: unknown): string => {
  try {
    const apiError = toApiError(error);

    if (apiError.status === 403) {
      return "Upload denied. Your Subscription or Instructor permissions may have changed.";
    }

    if (apiError.status === 409) {
      return "The Course state or available storage has changed. Please refresh and try again.";
    }

    if (apiError.status === 413) {
      return "Video exceeds the maximum allowed upload size.";
    }

    if (apiError.status === 400) {
      return apiError.message || "Invalid Video file.";
    }

    if (apiError.status === 503) {
      return "The upload service is temporarily unavailable.";
    }

    return apiError.message || "Unable to upload Video.";
  } catch {
    return "Unable to upload Video. Please try again.";
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
        throw new Error("Course ID or Lesson ID is missing.");
      }

      const response = await fetchVideoUploadContextAPI(
        courseId,
        lessonId,
        signal,
      );

      if (!response.data) {
        throw new Error("Unable to load Video upload settings.");
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
      message.error("Video file is empty.");
      return;
    }

    if (!context.allowedVideoMimeTypes.includes(selected.type)) {
      message.error("Unsupported Video format.");
      return;
    }

    if (BigInt(selected.size) > BigInt(context.maxVideoSizeBytes)) {
      message.error(
        `Maximum Video size is ${formatBytes(context.maxVideoSizeBytes)}.`,
      );
      return;
    }

    if (BigInt(selected.size) > BigInt(context.remainingStorageBytes)) {
      message.error("Insufficient Subscription storage.");
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
      message.warning("Enter a Video title (maximum 200 characters).");
      return;
    }

    // Kiểm tra lần cuối ở frontend.
    if (
      !context.allowedVideoMimeTypes.includes(file.type) ||
      file.size <= 0 ||
      BigInt(file.size) > BigInt(context.maxVideoSizeBytes) ||
      BigInt(file.size) > BigInt(context.remainingStorageBytes)
    ) {
      message.error("Selected Video does not satisfy upload limits.");
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
        throw new Error("Backend did not confirm Video creation.");
      }

      message.success("Video material added successfully.");

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
          message="Unable to load Video upload settings"
          description="Please check your connection or access permissions."
        />

        <div className="builder-actions">
          <InstructorButton onClick={query.reload}>Try again</InstructorButton>

          <InstructorButton onClick={() => navigate(listUrl)}>
            Back to Materials
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
        Course Builder / Learning Materials / Add Video
      </span>

      <div className="builder-hero">
        <h1>Add Video Material</h1>
        <p>
          {context.courseName} / {context.lessonTitle}
        </p>
      </div>

      {!context.canUpload && (
        <Alert
          type="warning"
          showIcon
          message="Video upload unavailable"
          description={getBlockMessage(context.blockReason)}
          className="uc17-video-alert"
        />
      )}

      {context.locked && (
        <Alert
          type="info"
          showIcon
          message="Course is Locked"
          description="BR-286: New learning materials must be Optional."
          className="uc17-video-alert"
        />
      )}

      {uploadError && (
        <Alert
          type="error"
          showIcon
          closable
          message="Video upload failed"
          description={uploadError}
          onClose={() => setUploadError(null)}
          className="uc17-video-alert"
        />
      )}

      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Video information</h2>

          <label htmlFor="video-title" className="instructor-form-label">
            Video title
          </label>

          <Input
            id="video-title"
            size="large"
            maxLength={200}
            showCount
            placeholder="e.g. Introduction to Workplace Safety"
            value={title}
            disabled={blocked || saving}
            onChange={(event) => setTitle(event.target.value)}
          />

          <label className="instructor-form-label instructor-form-label-spaced">
            Video file
          </label>

          <div className="uc17-video-upload">
            <div className="uc17-video-upload-icon">
              <VideoCameraOutlined />
            </div>

            <strong>{file ? file.name : "Choose a Video file"}</strong>

            <p>Allowed formats: {context.allowedVideoMimeTypes.join(", ")}</p>

            <p>Maximum size: {maxSize}</p>

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
                Remove
              </InstructorButton>
            </div>
          )}

          <label className="instructor-form-label instructor-form-label-spaced">
            Requirement
          </label>

          <Radio.Group
            value={context.locked ? false : isRequired}
            disabled={blocked || saving || context.locked}
            onChange={(event) => setIsRequired(event.target.value === true)}
          >
            <Radio value={true}>Required</Radio>
            <Radio value={false}>Optional</Radio>
          </Radio.Group>

          {context.locked && (
            <p className="uc17-video-hint">
              Required materials cannot be added after the Course becomes
              Locked.
            </p>
          )}

          {saving && (
            <div className="uc17-video-progress">
              <Progress percent={progress} status="active" />

              <p>
                {progress < 100
                  ? "Uploading Video..."
                  : "Upload sent. Cloudinary validation and database saving may still be in progress..."}
              </p>
            </div>
          )}

          <div className="builder-actions">
            <InstructorButton
              disabled={saving}
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(listUrl)}
            >
              Cancel
            </InstructorButton>

            <InstructorButton
              type="primary"
              loading={saving}
              disabled={!canSave}
              onClick={handleSave}
            >
              Upload Video
            </InstructorButton>
          </div>
        </div>

        <div className="builder-side">
          <section className="uc17-video-info-card">
            <h3>Upload guidelines</h3>

            <div className="uc17-video-info-row">
              <span>Maximum file size</span>
              <strong>{maxSize}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Maximum duration</span>
              <strong>{context.maxVideoDurationMinutes} min</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Remaining storage</span>
              <strong>{remainingStorage}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Subscription</span>
              <strong>{context.subscriptionStatus ?? "Unavailable"}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Course Locked</span>
              <strong>{context.locked ? "Yes" : "No"}</strong>
            </div>

            <p className="uc17-video-hint">
              Video format, duration and storage availability are verified by
              the backend before the material is saved.
            </p>
          </section>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderVideoAdd;
