import { Button } from "antd";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import "./lesson.resource.scss";

type LessonResourceCardProps = {
  title: string;
  enrollmentId: string;
  lessonId: string;
  beforeBack?: () => Promise<void>;
  children: ReactNode;
};

export function LessonResourceCard({
  title,
  enrollmentId,
  lessonId,
  beforeBack,
  children,
}: LessonResourceCardProps) {
  const navigate = useNavigate();

  return (
    <section className="lesson-resource">
      <Button
        onClick={async () => {
          await beforeBack?.();
          navigate(LEARNER_ROUTES.lesson(enrollmentId, lessonId));
        }}
      >
        Về bài học
      </Button>
      <h1 className="lesson-resource-title">{title}</h1>
      {children}
    </section>
  );
}
