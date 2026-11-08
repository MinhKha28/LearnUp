import { Alert, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SuccessScreen,
} from "@/components/instructor/instructor.ui";

import { fetchCourseDetailAPI } from "@/services/course.service";
import type { ICourseDetail } from "@/types/course.types";

import "./course.create.scss";

const CourseSubmitted = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState<ICourseDetail | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        if (!courseId) return;

        const response = await fetchCourseDetailAPI(courseId);

        if (active) {
          setCourse(response.data ?? null);
        }
      } catch {
        if (active) setCourse(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [courseId]);

  if (loading) {
    return (
      <InstructorPage className="instructor-course-create">
        <Skeleton active />
      </InstructorPage>
    );
  }

  if (!course || course.status !== "Submitted") {
    return (
      <InstructorPage className="instructor-course-create">
        <Alert
          type="warning"
          showIcon
          message="Course is not currently Submitted."
        />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-course-create">
      <PageHeader
        eyebrow="COURSE / APPROVAL"
        title="Course Submitted"
        subtitle="The Course is awaiting Organizer review."
      />

      <SuccessScreen
        tone="success"
        title="Awaiting Organizer review"
        secondary={{
          label: "View submitted Course",
          onClick: () => navigate(`/instructor/courses/${course.id}`),
        }}
      >
        <p>
          {course.name} • Version {course.versionNumber}
        </p>
        <p>Status: Submitted. The Course is not yet Published.</p>
      </SuccessScreen>
    </InstructorPage>
  );
};

export default CourseSubmitted;
