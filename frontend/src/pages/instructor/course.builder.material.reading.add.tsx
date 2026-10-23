import { Alert, Input, message, Progress, Radio, Skeleton } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
} from "@/components/instructor/instructor.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import { toApiError } from "@/services/api.client";
import {
  createReadingMaterialAPI,
  fetchReadingUploadContextAPI,
} from "@/services/course.service";

import "./course.create.scss";
import "./course.builder.scss";

const formatBytes = (value: string | number) => {
  const bytes = Number(value);

  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
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
        throw new Error("Unable to load Reading upload settings.");
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
      message.error("Unsupported Reading format.");
      return;
    }

    if (
      selected.size <= 0 ||
      BigInt(selected.size) > BigInt(context.maxReadingSizeBytes)
    ) {
      message.error("Reading file exceeds size limit.");
      return;
    }

    if (BigInt(selected.size) > BigInt(context.remainingStorageBytes)) {
      message.error("Insufficient Subscription storage.");
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
      message.warning("Enter a valid Reading title.");
      return;
    }

    // Kiểm tra lại trước khi gửi.
    if (
      !context.allowedReadingMimeTypes.includes(file.type) ||
      file.size <= 0 ||
      BigInt(file.size) > BigInt(context.maxReadingSizeBytes) ||
      BigInt(file.size) > BigInt(context.remainingStorageBytes)
    ) {
      message.error("Selected document does not satisfy upload limits.");
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

      if (!response.data?.id) {
        throw new Error("Reading was not saved.");
      }

      // BR-293: upload thành công nhưng không trích được chữ.
      if (response.data.extractionWarning) {
        setWarning(response.data.extractionWarning);
        setFile(null);
        query.reload();
        message.warning("Reading saved with 0 extracted words.");
        return;
      }

      message.success(`Reading saved: ${response.data.wordCount} words.`);

      navigate(listUrl, { replace: true });
    } catch (error) {
      let errorMessage = "Unable to upload Reading.";

      try {
        const apiError = toApiError(error);

        if (apiError.status === 403) {
          errorMessage =
            "Subscription or Instructor permissions do not allow this upload.";
        } else if (apiError.status === 409) {
          errorMessage = "Course status or available storage has changed.";
        } else if (apiError.status === 413) {
          errorMessage = "Reading exceeds the maximum allowed size.";
        } else {
          errorMessage = apiError.message || errorMessage;
        }
      } catch {
        if (error instanceof Error) {
          errorMessage = error.message;
        }
      }

      message.error(errorMessage);
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
          message="Unable to load Reading settings"
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

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">
        Course Builder / Learning Materials / Add Reading
      </span>

      <div className="builder-hero">
        <h1>Add Reading Material</h1>
        <p>
          {context.courseName} / {context.lessonTitle}
        </p>
      </div>

      {!context.canUpload && (
        <Alert
          type="warning"
          showIcon
          message="Reading upload unavailable"
          description={
            context.blockReason === "SUBSCRIPTION_GRACE"
              ? "Subscription is in Grace period."
              : context.blockReason === "SUBSCRIPTION_SUSPENDED"
                ? "Subscription is Suspended."
                : "Course or Subscription does not allow uploads."
          }
          style={{ marginBottom: 20 }}
        />
      )}

      {context.locked && (
        <Alert
          type="info"
          showIcon
          message="Course is Locked"
          description="BR-286: New Reading materials must be Optional."
          style={{ marginBottom: 20 }}
        />
      )}

      {warning && (
        <Alert
          type="warning"
          showIcon
          message="Reading saved with a warning"
          description={
            <>
              <p>{warning}</p>
              <InstructorButton
                onClick={() => navigate(listUrl, { replace: true })}
              >
                View saved Reading
              </InstructorButton>
            </>
          }
          style={{ marginBottom: 20 }}
        />
      )}

      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Reading information</h2>

          <label className="instructor-form-label">Reading title</label>

          <Input
            size="large"
            maxLength={200}
            showCount
            placeholder="Enter Reading title"
            value={title}
            disabled={blocked || saving || !!warning}
            onChange={(event) => setTitle(event.target.value)}
          />

          <label className="instructor-form-label instructor-form-label-spaced">
            Reading document
          </label>

          <label className="builder-upload-box">
            <strong>{file ? file.name : "Choose PDF document"}</strong>

            <p>Supported: {context.allowedReadingMimeTypes.join(", ")}</p>

            <p>Maximum size: {formatBytes(context.maxReadingSizeBytes)}</p>

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
              Selected: {file.name} ({formatBytes(file.size)})
            </p>
          )}

          <label className="instructor-form-label instructor-form-label-spaced">
            Requirement
          </label>

          <Radio.Group
            value={context.locked ? false : isRequired}
            disabled={blocked || saving || context.locked || !!warning}
            onChange={(event) => setIsRequired(event.target.value === true)}
          >
            <Radio value={true}>Required</Radio>
            <Radio value={false}>Optional</Radio>
          </Radio.Group>

          <p className="instructor-form-help">
            Word count is calculated automatically by the backend after upload.
          </p>

          {saving && (
            <div style={{ marginTop: 24 }}>
              <Progress percent={progress} status="active" />
              <p>
                {progress < 100
                  ? "Uploading Reading..."
                  : "Extracting text and saving Reading..."}
              </p>
            </div>
          )}

          <div className="builder-actions">
            <InstructorButton
              disabled={saving}
              onClick={() => navigate(listUrl)}
            >
              Cancel
            </InstructorButton>

            <InstructorButton
              type="primary"
              loading={saving}
              disabled={blocked || !file || !title.trim() || !!warning}
              onClick={handleSave}
            >
              Upload Reading
            </InstructorButton>
          </div>
        </div>

        <div className="builder-side">
          <section className="builder-update-card">
            <h3>Reading guidelines</h3>

            <p>
              Remaining storage: {formatBytes(context.remainingStorageBytes)}
            </p>

            <p>Reading speed: {context.readingSpeedWordsPerMinute} words/min</p>

            <p>
              Scanned documents without extractable text are saved with 0 words
              and a warning.
            </p>
          </section>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderReadingAdd;
