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
          message="Khóa học hiện không ở trạng thái chờ phê duyệt."
        />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Quay lại khóa học của tôi
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-course-create">
      <PageHeader
        eyebrow="Khóa học / Phê duyệt"
        title="Đã gửi khóa học phê duyệt"
        subtitle="Khóa học đang chờ quản lý đào tạo thẩm định."
      />

      <SuccessScreen
        tone="success"
        title="Đang chờ quản lý đào tạo thẩm định"
        secondary={{
          label: "Xem khóa học đã gửi",
          onClick: () => navigate(`/instructor/courses/${course.id}`),
        }}
      >
        <p>
          {course.name} • Version {course.versionNumber}
        </p>
        <p>Trạng thái: Chờ phê duyệt. Khóa học chưa được phát hành.</p>
      </SuccessScreen>
    </InstructorPage>
  );
};

export default CourseSubmitted;
