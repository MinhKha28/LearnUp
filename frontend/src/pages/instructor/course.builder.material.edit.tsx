import { Alert, Checkbox, Input, message, Spin } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchCourseLessonDetailAPI,
  updateMaterialAPI,
  replaceTechnicalMaterialAPI,
} from "@/services/course.service";

import type {
  IInstructorLessonDetail,
  IInstructorLessonMaterial,
} from "@/types/course.types";

const CourseBuilderMaterialEdit = () => {
  const { courseId = "", lessonId = "", materialId = "" } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<IInstructorLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  const material: IInstructorLessonMaterial | undefined =
    detail?.materials.find((item) => item.id === materialId);

  const locked = detail?.course.locked ?? false;

  const materialsUrl =
    `/instructor/courses/${courseId}` +
    `/builder/lessons/${lessonId}/materials`;

  useEffect(() => {
    if (!courseId || !lessonId || !materialId) {
      setLoading(false);
      setError("Invalid Course, Lesson or Material ID.");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchCourseLessonDetailAPI(courseId, lessonId);

        if (!response.data) {
          throw new Error("Lesson detail not found.");
        }

        const found = response.data.materials.find(
          (item) => item.id === materialId,
        );

        if (!found) {
          throw new Error("Learning material not found.");
        }

        if (cancelled) return;

        setDetail(response.data);
        setTitle(found.title);
        setIsRequired(found.isRequired);
      } catch {
        if (!cancelled) {
          setError("Unable to load learning material.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId, materialId]);

  const saveMetadata = async () => {
    if (!material || saving) return;

    if (!title.trim() || title.trim().length > 200) {
      message.error("Material title must be 1–200 characters.");
      return;
    }

    setSaving(true);

    try {
      await updateMaterialAPI(courseId, lessonId, materialId, {
        title: title.trim(),
        ...(locked ? {} : { isRequired }),
      });

      message.success("Learning material updated.");
      navigate(materialsUrl);
    } catch {
      message.error("Unable to update learning material.");
    } finally {
      setSaving(false);
    }
  };

  const replaceFile = async () => {
    if (!material || !replacementFile || saving) return;

    const isReading = material.materialType === "Reading";

    if (
      isReading &&
      (replacementFile.type !== "application/pdf" ||
        replacementFile.size > 50 * 1024 * 1024)
    ) {
      message.error("Select a valid PDF within 50 MiB.");
      return;
    }

    if (!isReading && replacementFile.size > 500 * 1024 * 1024) {
      message.error("Video exceeds the upload transport limit.");
      return;
    }

    setSaving(true);

    try {
      await replaceTechnicalMaterialAPI(
        courseId,
        lessonId,
        materialId,
        replacementFile,
      );

      message.success("Technical replacement completed.");
      navigate(materialsUrl);
    } catch {
      message.error("Unable to replace the file.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin />;

  if (error || !detail || !material) {
    return (
      <Alert
        type="error"
        showIcon
        message={error || "Learning material not found."}
      />
    );
  }

  const editable = ["Draft", "Rejected", "Published"].includes(
    detail.course.status,
  );

  return (
    <div className="builder-page">
      <h1>Edit Learning Material</h1>

      <label>Material title</label>
      <Input
        value={title}
        maxLength={200}
        disabled={!editable || saving}
        onChange={(event) => setTitle(event.target.value)}
      />

      <Checkbox
        checked={isRequired}
        disabled={!editable || locked || saving}
        onChange={(event) => setIsRequired(event.target.checked)}
      >
        Required learning material
      </Checkbox>

      {locked && (
        <Alert
          type="info"
          showIcon
          message="Course is Locked"
          description="The Required setting cannot be changed. Title edits and technical file replacement are still allowed."
        />
      )}

      <div>
        <button
          type="button"
          disabled={!editable || saving}
          onClick={() => void saveMetadata()}
        >
          Save material information
        </button>
      </div>

      <h2>Replace a technically broken file</h2>

      <Alert
        type="warning"
        showIcon
        message="Technical repair only"
        description="The replacement must preserve the original learning content. If you need to change the content, use the version-specific replacement workflow."
      />

      <input
        type="file"
        disabled={!editable || saving}
        accept={
          material.materialType === "Reading"
            ? ".pdf,application/pdf"
            : "video/*"
        }
        onChange={(event) =>
          setReplacementFile(event.target.files?.[0] ?? null)
        }
      />

      <button
        type="button"
        disabled={!editable || saving || !replacementFile}
        onClick={() => void replaceFile()}
      >
        Replace technical file
      </button>

      <button type="button" onClick={() => navigate(materialsUrl)}>
        Cancel
      </button>
    </div>
  );
};

export default CourseBuilderMaterialEdit;
