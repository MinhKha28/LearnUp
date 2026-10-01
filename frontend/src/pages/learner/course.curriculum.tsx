import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { CourseCover } from "@/components/learner/course.cover";
import { LearnerSkeleton } from "@/components/learner/learner.states";
import { LearnerPage, StatusTag } from "@/components/learner/learner.ui";
import { LearningError } from "@/components/learner/learning.error";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchCurriculum } from "@/services/learning.service";
import type { CurriculumData, CurriculumModule } from "@/types/learning.types";
import { buildCurriculumHeader, completionMark, type CompletionMark } from "@/utils/curriculum.view";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import "./course.curriculum.scss";

const byPosition = <T extends { position: number }>(items: readonly T[]) =>
  [...items].sort((a, b) => a.position - b.position);

const Marks = ({ isRequired, mark }: { isRequired: boolean; mark: CompletionMark }) => (
  <span className="course-curriculum-marks">
    {isRequired && <StatusTag tone="warning">Bắt buộc</StatusTag>}
    {mark && <StatusTag tone={mark.tone}>{mark.label}</StatusTag>}
  </span>
);

const CurriculumHeader = ({ data }: { data: CurriculumData }) => {
  const header = buildCurriculumHeader(data);
  return (
    <header className="course-curriculum-header">
      <CourseCover name={header.courseName ?? header.title} size="md" />
      <div className="course-curriculum-heading">
        <h1>{header.title}</h1>
        {header.versionLabel && <span className="course-curriculum-version">{header.versionLabel}</span>}
        <div className="course-curriculum-tags">
          <StatusTag tone="neutral">{header.typeLabel}</StatusTag>
          <StatusTag tone={header.status.tone}>{header.status.label}</StatusTag>
        </div>
        {(header.due || header.progress) && (
          <div className="course-curriculum-meta">
            {header.due && <span>Hạn hoàn thành: {header.due.text}</span>}
            {header.progress && <span>{header.progress}</span>}
          </div>
        )}
      </div>
    </header>
  );
};

const ModuleBlock = ({ module, enrollmentId }: { module: CurriculumModule; enrollmentId: string }) => (
  <li className="course-curriculum-module">
    <div className="course-curriculum-module-heading">
      <h2>{module.title}</h2>
      <Marks isRequired={module.isRequired} mark={completionMark(module.completed)} />
    </div>
    <ol className="course-curriculum-lessons">
      {byPosition(module.lessons).map((lesson) => (
        <li key={lesson.lessonId}>
          <Link className="course-curriculum-lesson" to={LEARNER_ROUTES.lesson(enrollmentId, lesson.lessonId)}>
            <span className="course-curriculum-lesson-title">{lesson.title}</span>
            <Marks isRequired={lesson.isRequired} mark={completionMark(lesson.completed)} />
          </Link>
        </li>
      ))}
    </ol>
  </li>
);

const CourseCurriculum = () => {
  const { enrollmentId = "" } = useParams();
  const query = useApiQuery((signal) => fetchCurriculum(enrollmentId, signal), [enrollmentId]);
  const modules = useMemo(
    () => (query.status === "success" ? byPosition(query.data.modules) : []),
    [query.status, query.data],
  );

  return (
    <LearnerPage className="course-curriculum">
      {query.status === "loading" && <LearnerSkeleton variant="detail" />}
      {query.status === "error" && (
        <LearningError error={query.error} context="curriculum" enrollmentId={enrollmentId} onRetry={query.reload} />
      )}
      {query.status === "success" && (
        <>
          <CurriculumHeader data={query.data} />
          <section className="course-curriculum-tree" aria-label="Chương trình học">
            <h2 className="course-curriculum-title">Chương trình học</h2>
            {modules.length === 0 ? (
              <p className="course-curriculum-empty">Course chưa có Lesson nào.</p>
            ) : (
              <ol className="course-curriculum-modules">
                {modules.map((module) => (
                  <ModuleBlock key={module.moduleId} module={module} enrollmentId={enrollmentId} />
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </LearnerPage>
  );
};

export default CourseCurriculum;
