import { Alert, message, Skeleton } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  WarningPanel,
} from "@/components/instructor/instructor.ui";

import {
  fetchCourseDetailAPI,
  withdrawCourseSubmissionAPI,
} from "@/services/course.service";

import type { ICourseDetail } from "@/types/course.types";
import { getWithdrawErrorMessage } from "./course.withdraw.errors";

import "./course.withdraw.scss";

const CourseWithdraw = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState<ICourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState("");

  const withdrawInProgress = useRef(false);

  const loadCourse = useCallback(async () => {
    if (!courseId) {
      setCourse(null);
      setError("Course ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetchCourseDetailAPI(courseId);
      const statusCode = Number(response.statusCode);

      if (
        !Number.isInteger(statusCode) ||
        statusCode < 200 ||
        statusCode >= 300 ||
        !response.data
      ) {
        setCourse(null);
        setError("Unable to load Course information.");
        return;
      }

      setCourse(response.data);
    } catch {
      setCourse(null);
      setError("Unable to load Course information.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const handleWithdraw = async () => {
    if (!course || withdrawInProgress.current) return;

    if (course.status !== "Submitted") {
      message.warning("Only a Submitted Course can be withdrawn.");
      return;
    }

    withdrawInProgress.current = true;
    setWithdrawing(true);

    try {
      const response = await withdrawCourseSubmissionAPI(course.id);
      const statusCode = Number(response.statusCode);

      if (
        !Number.isInteger(statusCode) ||
        statusCode < 200 ||
        statusCode >= 300 ||
        response.data?.status !== "Draft" ||
        response.data?.submittedAt !== null
      ) {
        message.error(getWithdrawErrorMessage(response));
        await loadCourse();
        return;
      }

      message.success("Course withdrawn to Draft.");

      navigate(`/instructor/courses/${course.id}`, {
        replace: true,
      });
    } catch (error: unknown) {
      message.error(getWithdrawErrorMessage(error));
      await loadCourse();
    } finally {
      withdrawInProgress.current = false;
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <InstructorPage className="instructor-course-withdraw">
        <Skeleton active paragraph={{ rows: 5 }} />
      </InstructorPage>
    );
  }

  if (!course) {
    return (
      <InstructorPage className="instructor-course-withdraw">
        <PageHeader
          eyebrow="COURSE / APPROVAL"
          title="Course not found"
          subtitle="Unable to load Course information."
          back
        />

        <Alert type="error" showIcon message={error || "Course not found."} />

        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  if (course.status !== "Submitted") {
    return (
      <InstructorPage className="instructor-course-withdraw">
        <PageHeader
          eyebrow="COURSE / APPROVAL"
          title="Nothing to withdraw"
          subtitle={`This Course is currently ${course.status}.`}
          back
        />

        <InstructorButton
          onClick={() => navigate(`/instructor/courses/${course.id}`)}
        >
          Back to Course
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-course-withdraw">
      <PageHeader
        eyebrow="COURSE / APPROVAL"
        title="Withdraw Submitted Course"
        subtitle="The Organizer has not decided on this Course yet."
        back
      />

      <WarningPanel title="Submitted state">
        You can return the Course to Draft before an Organizer decision.
      </WarningPanel>

      <div className="instructor-withdraw-card">
        <h2>{course.name}</h2>

        <p>Current status: {course.status}</p>
        <p>Withdrawal restores Draft editing access.</p>

        <div className="instructor-withdraw-actions">
          <InstructorButton disabled={withdrawing} onClick={() => navigate(-1)}>
            Cancel
          </InstructorButton>

          <InstructorButton
            type="primary"
            loading={withdrawing}
            disabled={withdrawing}
            onClick={() => void handleWithdraw()}
          >
            Withdraw to Draft
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseWithdraw;
