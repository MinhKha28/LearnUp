import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LearnerEmptyState, LearnerSkeleton } from "@/components/learner/learner.states";
import { LearnerButton } from "@/components/learner/learner.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchEnrolledCourseLinks } from "@/services/learning.service";
import { LEARNER_ROUTES } from "@/utils/learner.routes";

const CourseResultsResolver = () => {
  const { courseId = "" } = useParams();
  const navigate = useNavigate();
  const query = useApiQuery(fetchEnrolledCourseLinks, [courseId]);
  const enrollment = query.status === "success"
    ? query.data.find((item) => item.courseId === courseId) : undefined;

  useEffect(() => {
    if (enrollment) navigate(LEARNER_ROUTES.results(enrollment.enrollmentId), { replace: true });
  }, [enrollment, navigate]);

  if (query.status === "loading" || enrollment) return <LearnerSkeleton variant="detail" />;
  const back = <LearnerButton onClick={() => navigate(LEARNER_ROUTES.myCourses())}>Về khóa học của tôi</LearnerButton>;
  if (query.status === "error") return (
    <LearnerEmptyState title="Không tải được thông tin khóa học. Vui lòng thử lại."
      action={<><LearnerButton onClick={query.reload}>Thử lại</LearnerButton>{back}</>} />
  );
  return <LearnerEmptyState title="Không tìm thấy khóa học"
    description="Khóa học không tồn tại hoặc không thuộc danh sách khóa học của bạn." action={back} />;
};

export default CourseResultsResolver;
