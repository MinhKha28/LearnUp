import { Alert, Spin, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";

import { CourseBuilderNav } from "@/components/instructor/course.nav";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
} from "@/components/instructor/instructor.ui";
import { fetchCourseStructureAPI } from "@/services/course.service";
import type { ICourseStructure } from "@/types/course.types";

import "./layout.instructor.course.scss";

export interface ICourseBuilderOutletContext {
  structure: ICourseStructure;
  refetchStructure: () => Promise<void>;
}

const LayoutInstructorCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [structure, setStructure] = useState<ICourseStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadStructure = useCallback(async () => {
    if (!courseId) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchCourseStructureAPI(courseId);

      if (!response.data) {
        setStructure(null);
        setErrorMessage(response.message || "Unable to load Course structure.");
        return;
      }

      setStructure(response.data);
    } catch (error) {
      console.error("Fetch Course structure error:", error);
      setStructure(null);
      setErrorMessage("Unable to load Course structure.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadStructure();
  }, [loadStructure]);

  if (loading) {
    return (
      <div className="builder-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (errorMessage || !structure) {
    return (
      <InstructorPage>
        <PageHeader
          eyebrow="MY COURSES / COURSE BUILDER"
          title="Course structure"
          subtitle=""
          back
        />

        <Alert
          type="error"
          showIcon
          message={errorMessage || "Course not found."}
        />

        <div style={{ marginTop: 16 }}>
          <InstructorButton onClick={() => navigate("/instructor/courses")}>
            Back to My Courses
          </InstructorButton>
        </div>
      </InstructorPage>
    );
  }

  const course = structure.course;

  return (
    <div className="builder-layout">
      <header className="builder-topbar">
        <div className="builder-topbar-left">
          <button
            type="button"
            className="builder-topbar-back"
            onClick={() => navigate("/instructor/courses")}
          >
            ← Back
          </button>

          <div className="builder-topbar-course">
            <Link
              className="builder-topbar-title"
              to={`/instructor/courses/${course.id}/builder`}
            >
              {course.name}
            </Link>

            <div className="builder-topbar-meta">
              <span>{course.status === "DRAFT" ? "Draft" : course.status}</span>
              <span className="builder-topbar-meta-dot">•</span>
              <span>Last saved just now</span>
            </div>
          </div>
        </div>

        <div className="builder-topbar-right">
          <button
            type="button"
            className="builder-topbar-action"
            onClick={() => message.info("Preview arrives in a later batch.")}
          >
            Preview
          </button>

          <button
            type="button"
            className="builder-topbar-action"
            onClick={() => message.success("Draft saved.")}
          >
            Save Draft
          </button>

          <button
            type="button"
            className="builder-topbar-publish"
            onClick={() => navigate(`/instructor/courses/${course.id}/submit`)}
          >
            Submit Course
          </button>
        </div>
      </header>

      <div className="builder-body">
        <CourseBuilderNav structure={structure} />

        <main className="builder-main">
          <Outlet
            context={{
              structure,
              refetchStructure: loadStructure,
            }}
          />
        </main>
      </div>
    </div>
  );
};

export default LayoutInstructorCourse;
