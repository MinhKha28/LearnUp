import { Input, message } from "antd";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addBuilderResource,
  findBuilderLesson,
  findCourseStructure,
  findInstructorCourse,
  slugify,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.create.scss";
import "./course.builder.scss";

const MAX_VIDEO_MB = 500;
const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const CourseBuilderVideoAdd = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const found = structure ? findBuilderLesson(structure, lessonId) : undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [requirement, setRequirement] = useState<"Required" | "Optional">("Required");
  const [file, setFile] = useState<File | null>(null);
  const [blocked, setBlocked] = useState(false);

  if (!course || !found) return null;

  const { lesson } = found;
  const base = `/instructor/courses/${course.id}/builder/lessons/${lesson.id}`;

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    const withinSize = selected.size <= MAX_VIDEO_MB * 1024 * 1024;
    const validType = ACCEPTED_TYPES.includes(selected.type) || selected.type === "";
    if (!withinSize || !validType) {
      setBlocked(true);
      setFile(null);
      return;
    }
    setBlocked(false);
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^/.]+$/, ""));
  };

  const handleSave = () => {
    if (!title.trim() || !file) {
      message.warning("Add a title and upload a Video file.");
      return;
    }
    addBuilderResource(structure!, lesson.id, {
      id: slugify(title),
      title: title.trim(),
      type: "video",
      required: requirement === "Required",
      sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    });
    message.success("Video saved.");
    navigate(`${base}/materials`);
  };

  if (blocked) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Video Upload Blocked</span>
        <div className="builder-hero">
          <h1>Video Upload Blocked</h1>
        </div>
        <div className="builder-banner builder-banner-error">
          <strong>Upload failed validation</strong>
          <p>The file exceeds a configured technical or storage limit.</p>
        </div>
        <div className="builder-update-card">
          <h2>Video file</h2>
          <div className="builder-banner builder-banner-error" style={{ marginBottom: 0 }}>
            <p>Review the file format, duration, size and available storage.</p>
            <p>Choose another file before saving this resource.</p>
          </div>
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/materials`)}>Cancel</InstructorButton>
            <InstructorButton
              type="primary"
              onClick={() => {
                setBlocked(false);
                inputRef.current?.click();
              }}
            >
              Choose another file
            </InstructorButton>
          </div>
        </div>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Add Video</span>
      <div className="builder-hero">
        <h1>Add Video</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label">Video title</label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <label className="instructor-form-label instructor-form-label-spaced">Video file</label>
          <label className="builder-upload-box">
            <strong>{file ? file.name : "Upload Video"}</strong>
            <p>Format, duration, file size and storage are validated.</p>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="instructor-form-label instructor-form-label-spaced">Requirement</label>
          <div className="instructor-pill-toggle">
            <button
              type="button"
              className={requirement === "Required" ? "instructor-pill-active" : ""}
              onClick={() => setRequirement("Required")}
            >
              Required
            </button>
            <button
              type="button"
              className={requirement === "Optional" ? "instructor-pill-active" : ""}
              onClick={() => setRequirement("Optional")}
            >
              Optional
            </button>
          </div>
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/materials`)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save Video
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Upload checks">
            Technical limits and Subscription storage are checked together.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderVideoAdd;
