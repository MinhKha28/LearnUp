import { CourseIconTile } from "@/components/learner/learner.ui";
import "./course.cover.scss";

/**
 * Ảnh bìa Course, tỉ lệ 16:9. Luôn hiện ảnh thay thế vì chưa có file-service;
 * `coverFileId` giữ sẵn cho sau này, hiện chưa dùng (D10).
 */
export const CourseCover = ({
  name,
  size = "md",
}: {
  name: string;
  coverFileId?: string | null;
  size?: "sm" | "md" | "lg";
}) => {
  const initial = name.replace(/^(?:\s*\[[^\]]*\])+/, "").match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase("vi");

  return (
    <div className={`course-cover course-cover-${size}`} role="img" aria-label={name}>
      {initial ? <span className="course-cover-initial">{initial}</span> : <CourseIconTile />}
    </div>
  );
};
