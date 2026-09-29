import { Avatar, Layout } from "antd";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import { useCurrentApp } from "@/components/context/app.context";
import { CourseNav } from "@/components/learner/course.nav";
import { courseDetails } from "@/components/learner/learner.data";
import { LearnerButton, LearnerPage, PageHeader, SuccessScreen } from "@/components/learner/learner.ui";
import "./layout.learner.course.scss";

const LayoutLearnerCourse = () => {
  const { user } = useCurrentApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { courseId, lessonId, resourceId, quizId, assignmentId } = useParams();

  const course = courseId ? courseDetails[courseId] : undefined;

  const displayName = user?.fullName || "Alex Morgan";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const activeSection = location.pathname.endsWith("/progress")
    ? "progress"
    : location.pathname.endsWith("/assessments")
      ? "assessments"
      : undefined;

  if (!course) {
    return (
      <LearnerPage className="course-not-found">
        <PageHeader eyebrow="MY COURSES / COURSE" title="Course not found" subtitle="" back />
        <LearnerButton onClick={() => navigate("/learner/courses")}>Back to My Courses</LearnerButton>
      </LearnerPage>
    );
  }

  if (course.disabled) {
    return (
      <LearnerPage className="course-unavailable">
        <PageHeader
          eyebrow="MY COURSES / COURSE"
          title="Course unavailable"
          subtitle="This Course has been disabled and its content cannot be accessed."
        />
        <SuccessScreen
          tone="error"
          title="Course access unavailable"
          primary={{ label: "Back to My Courses", onClick: () => navigate("/learner/courses") }}
        >
          <p>The Organization has disabled this Course.</p>
          <p>In-progress Required Enrollments are marked Waived.</p>
          <p>Previously issued Certificates remain valid.</p>
        </SuccessScreen>
      </LearnerPage>
    );
  }

  return (
    <Layout className="learner-course-layout">
      <Layout.Sider className="learner-course-sidebar" width={264} theme="light">
        <CourseNav
          course={course}
          activeSection={activeSection}
          activeLessonId={lessonId ?? course.activeLessonId}
          activeResourceId={resourceId ?? course.activeResourceId}
          activeQuizId={quizId}
          activeAssignmentId={assignmentId}
        />
      </Layout.Sider>
      <Layout className="learner-course-workspace">
        <Layout.Header className="learner-course-topbar">
          <span className="learner-course-topbar-title">{course.title} / Learning</span>
          <div className="learner-topbar-actions">
            <span className="learner-notification">Notifications</span>
            <Avatar size={30} className="learner-topbar-avatar">
              {initials}
            </Avatar>
          </div>
        </Layout.Header>
        <Layout.Content className="learner-course-main">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default LayoutLearnerCourse;
