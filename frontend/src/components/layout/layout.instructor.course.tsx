import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { message } from "antd";
import { CourseBuilderNav } from "@/components/instructor/course.nav";
import { findCourseStructure, findInstructorCourse } from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, PageHeader, StatusTag } from "@/components/instructor/instructor.ui";
import { fetchAssignmentsAPI } from "@/services/assessment.service";
import type { IAssignmentSummary, ICourseBuilderContext } from "@/types/assessment.types";
import "./layout.instructor.course.scss";

const LayoutInstructorCourse = () => {
  const { courseId, lessonId, moduleId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);

  // Assignments live in Assessment Service. Load them once here for the sidebar and the Course Outline, and
  // reload whenever the user moves to another builder page (so a created/edited/deleted Assignment shows up).
  // A failure is silent on purpose: the rest of the builder must keep working without Assessment Service.
  const [assignments, setAssignments] = useState<IAssignmentSummary[] | null>(null);
  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAssignmentsAPI(courseId);
        if (active) setAssignments(res.data?.items ?? null);
      } catch {
        if (active) setAssignments(null);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [courseId, pathname]);

  if (!course) {
    return (
      <InstructorPage className="builder-course-not-found">
        <PageHeader eyebrow="MY COURSES / COURSE BUILDER" title="Course not found" subtitle="" back />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <div className="builder-layout">
      <header className="builder-topbar">
        <div className="builder-topbar-left">
          <img src="/logo/learnup-logo-dark.png" alt="LearnUP" className="builder-topbar-logo" />
          <button
            type="button"
            className="builder-topbar-back"
            onClick={() => navigate("/instructor/courses")}
          >
            ← My Courses
          </button>
        </div>
        <Link className="builder-topbar-title" to={`/instructor/courses/${course.id}/builder`}>
          {course.title} / {course.version}
        </Link>
        <div className="builder-topbar-right">
          <StatusTag tone={course.status === "published" ? "success" : "neutral"}>
            {course.status === "published" ? "Published" : "Draft"}
          </StatusTag>
          {course.locked && <StatusTag tone="warning">Locked</StatusTag>}
          <InstructorButton onClick={() => message.info("Preview arrives in a later batch.")}>
            Preview
          </InstructorButton>
        </div>
      </header>
      <div className="builder-body">
        <CourseBuilderNav
          course={course}
          structure={structure}
          assignments={assignments}
          activeModuleId={moduleId}
          activeLessonId={lessonId}
        />
        <main className="builder-main">
          <Outlet context={{ assignments } satisfies ICourseBuilderContext} />
        </main>
      </div>
    </div>
  );
};

export default LayoutInstructorCourse;
