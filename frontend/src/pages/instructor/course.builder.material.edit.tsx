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
    return "Unknown size";
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

    throw new Error(message || "The request could not be completed.");
  }

  if (response.data === undefined || response.data === null) {
    throw new Error("The server response could not be verified.");
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
      setError("Invalid Course, Lesson or Material ID.");
      return;
    }

    let cancelled = false;

    const loadMaterial = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchCourseLessonDetailAPI(courseId, lessonId);

        if (!response.data) {
          throw new Error("Lesson details not found.");
        }

        const lessonDetail = ensureApiSuccess(response);

        const found = lessonDetail.materials.find(
          (item) => item.id === materialId,
        );

        if (!found) {
          throw new Error("Learning material not found.");
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
              : "Unable to load learning material.",
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
      message.error("Unsupported learning material type.");
      return;
    }

    if (selected.size <= 0) {
      message.error("Selected file is empty.");
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
      message.error("Only PDF Reading files are supported.");
      return;
    }

    if (
      isVideo &&
      !["video/mp4", "video/webm", "video/quicktime"].includes(selected.type)
    ) {
      message.error("Unsupported Video format.");
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
      message.warning("Material title must be between 1 and 200 characters.");
      return;
    }

    const metadataChanged =
      normalizedTitle !== material.title ||
      (!locked && isRequired !== material.isRequired);

    const hasReplacement = replacementFile !== null;

    if (!metadataChanged && !hasReplacement) {
      message.info("No changes to save.");
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
              "File replacement response does not match the current material.",
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
              "Updated material response does not match the current material.",
            );
          }
        }

        message.success("Learning material saved successfully.");

        navigate(materialsUrl, {
          replace: true,
        });
      } catch (err) {
        if (fileReplaced && metadataChanged) {
          message.error(
            "The technical file was replaced successfully, " +
              "but the material information was not saved. " +
              "Reload and update the information again. " +
              "Do not upload the replacement file again.",
            8,
          );

          setReplacementFile(null);
          setProgress(0);
        } else if (replacementFile && !fileReplaced) {
          message.error(
            getReplacementSizeError(err) ??
              "File replacement was not confirmed. " +
                "Reload and check the current file before retrying.",
            8,
          );
        } else {
          message.error(
            err instanceof Error
              ? err.message
              : "Unable to save learning material.",
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
        title: "Confirm Technical Replacement",
        content:
          "This action replaces the shared technical file. " +
          "All Course versions referencing this MediaFile " +
          "may be affected. Please confirm that the learning " +
          "content remains unchanged.",
        okText: "Confirm and Save",
        cancelText: "Cancel",
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
          message={error || "Learning material not found."}
        />

        <div className="builder-actions">
          <InstructorButton
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(materialsUrl)}
          >
            Back to Materials
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
        Course Builder / Learning Materials / Edit Material
      </span>

      <div className="builder-hero">
        <h1>Edit Learning Material</h1>

        <p>
          {detail.course.name} / {detail.lesson.title}
        </p>
      </div>

      {/* ================= ALERTS ================= */}
      {locked && (
        <Alert
          type="info"
          showIcon
          message="Course is Locked"
          description={
            "Material title and technical replacement remain " +
            "available. Required/Optional cannot be changed."
          }
          className="uc17-video-alert"
        />
      )}

      {!editable && (
        <Alert
          type="warning"
          showIcon
          message="Material editing unavailable"
          description="The current Course status does not allow editing this learning material."
          className="uc17-video-alert"
        />
      )}

      {/* ================= MAIN LAYOUT ================= */}
      <div className="builder-grid">
        {/* ============ LEFT COLUMN ============ */}
        <div className="builder-update-card">
          <h2>Material information</h2>

          {/* TITLE */}
          <label
            htmlFor="edit-material-title"
            className="instructor-form-label"
          >
            Material title
          </label>

          <Input
            id="edit-material-title"
            size="large"
            maxLength={200}
            showCount
            placeholder="Enter learning material title"
            value={title}
            disabled={!editable || saving}
            onChange={(event) => setTitle(event.target.value)}
          />

          {/* REQUIREMENT */}
          <label className="instructor-form-label instructor-form-label-spaced">
            Requirement
          </label>

          <Radio.Group
            value={isRequired}
            disabled={!editable || locked || saving}
            onChange={(event) => setIsRequired(event.target.value === true)}
          >
            <Radio value={true}>Required</Radio>
            <Radio value={false}>Optional</Radio>
          </Radio.Group>

          {locked && (
            <p className="uc17-video-hint">
              Required/Optional cannot be changed after the Course is Locked.
            </p>
          )}

          {/* ============ TECHNICAL FILE ============ */}
          <div className="uc17-edit-replacement">
            <h2>
              Technical file replacement
              <span className="uc17-edit-optional"> (Optional)</span>
            </h2>

            <Alert
              type="warning"
              showIcon
              message="Technical repair only"
              description={
                "The replacement must preserve the original " +
                "learning content. All Course versions " +
                "referencing this shared file may be affected."
              }
              className="uc17-video-alert"
            />

            {/* CURRENT FILE */}
            <label className="instructor-form-label">Current file</label>

            <p className="instructor-form-help">
              {material.file.originalFilename}
            </p>

            {/* FILE SELECT */}
            <label className="instructor-form-label instructor-form-label-spaced">
              Replacement {isVideo ? "Video" : "Reading"} file
            </label>

            <div className="uc17-video-upload">
              <div className="uc17-video-upload-icon">
                {isVideo ? <VideoCameraOutlined /> : <FilePdfOutlined />}
              </div>

              <strong>
                {replacementFile
                  ? replacementFile.name
                  : isVideo
                    ? "Choose a replacement Video file"
                    : "Choose a replacement PDF document"}
              </strong>

              <p>
                Allowed formats:{" "}
                {isVideo
                  ? "MP4, WebM, MOV (subject to Platform Settings)"
                  : "PDF"}
              </p>

              <p>Upload transport limit: {formatBytes(maxUploadBytes)}</p>

              <input
                type="file"
                accept={fileAccept}
                aria-label="Choose replacement file"
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
                  Remove
                </InstructorButton>
              </div>
            )}

            {/* UPLOAD PROGRESS */}
            {saving && uploadingFile && (
              <div className="uc17-video-progress">
                <Progress percent={progress} status="active" />

                <p>
                  {progress < 100
                    ? "Uploading replacement file..."
                    : "Upload sent. Validating and saving replacement..."}
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
              Cancel
            </InstructorButton>

            <InstructorButton
              type="primary"
              loading={saving}
              disabled={!canSave}
              onClick={() => void handleSaveChanges()}
            >
              Save Changes
            </InstructorButton>
          </div>
        </div>

        {/* ============ RIGHT COLUMN ============ */}
        <div className="builder-side">
          <section className="uc17-video-info-card">
            <h3>Material details</h3>

            <div className="uc17-video-info-row">
              <span>Material type</span>
              <strong>{material.materialType}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Current filename</span>
              <strong>{material.file.originalFilename}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Current file size</span>
              <strong>{formatBytes(material.file.sizeBytes)}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Requirement</span>
              <strong>{material.isRequired ? "Required" : "Optional"}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>Course Locked</span>
              <strong>{locked ? "Yes" : "No"}</strong>
            </div>

            <div className="uc17-video-info-row">
              <span>File status</span>
              <strong>{material.file.status}</strong>
            </div>

            {isVideo && (
              <div className="uc17-video-info-row">
                <span>Video duration</span>
                <strong>
                  {material.file.durationSeconds !== null
                    ? `${Math.ceil(material.file.durationSeconds / 60)} min`
                    : "Unavailable"}
                </strong>
              </div>
            )}

            {isReading && (
              <div className="uc17-video-info-row">
                <span>Word count</span>
                <strong>{material.file.wordCount ?? "Unavailable"}</strong>
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
