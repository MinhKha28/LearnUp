import { Select } from "antd";
import { useEffect, useState } from "react";
import { fetchAssignmentsAPI } from "@/services/assessment.service";
import { fetchManagedCoursesAPI } from "@/services/course.service";
import type { IAssignmentSummary } from "@/types/assessment.types";
import type { IInstructorCourseListItem } from "@/types/course.types";
import "./submission.assignment.picker.scss";

/**
 * The submissions are listed per Assignment, so the page starts with a Course and an Assignment, as the peer review
 * cycles do. With no Assignment in the address it picks the first one; an address with one (the Bài nộp button of the
 * Assignment) keeps it and shows its Course.
 */
const SubmissionAssignmentPicker = ({
  assignmentId,
  courseIdOfAssignment,
  onPick,
}: {
  assignmentId: string | null;
  courseIdOfAssignment?: string;
  onPick: (assignmentId: string) => void;
}) => {
  const [courses, setCourses] = useState<IInstructorCourseListItem[]>([]);
  const [courseId, setCourseId] = useState<string>();
  const [assignments, setAssignments] = useState<IAssignmentSummary[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetchManagedCoursesAPI({ current: 1, pageSize: 100 });
        if (!active) return;
        if (res.data) {
          setCourses(res.data.result);
          // with an Assignment in the address the Course comes from it, below
          if (!assignmentId) setCourseId((now) => now ?? res.data!.result[0]?.id);
        } else {
          setError(res.message || "Không thể tải danh sách khóa học bạn phụ trách.");
        }
      } catch {
        if (active) setError("Không thể tải danh sách khóa học bạn phụ trách. Vui lòng thử lại.");
      } finally {
        if (active) setLoadingCourses(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the first load only
  }, []);

  useEffect(() => {
    if (courseIdOfAssignment) setCourseId(courseIdOfAssignment);
  }, [courseIdOfAssignment]);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const load = async () => {
      setLoadingAssignments(true);
      setError("");
      try {
        const res = await fetchAssignmentsAPI(courseId);
        if (!active) return;
        const items = res.data?.items ?? [];
        setAssignments(items);
        if (!assignmentId && items[0]) onPick(items[0].id);
      } catch {
        if (active) {
          setAssignments([]);
          setError("Không thể tải danh sách bài tập của khóa học này. Vui lòng thử lại.");
        }
      } finally {
        if (active) setLoadingAssignments(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on a Course; the Assignment in the address is read once loaded
  }, [courseId]);

  const changeCourse = (value: string) => {
    setAssignments([]);
    setCourseId(value);
    // the list of the new Course is loaded next and its first Assignment is picked
    if (assignmentId) onPick("");
  };

  return (
    <div className="instructor-submission-picker">
      <div className="instructor-submission-picker-fields">
        <label>
          <span>Khóa học</span>
          <Select
            value={courseId}
            loading={loadingCourses}
            placeholder="Chọn khóa học"
            onChange={changeCourse}
            options={courses.map((course) => ({ value: course.id, label: course.name }))}
            notFoundContent="Bạn chưa có khóa học nào"
          />
        </label>
        <label>
          <span>Bài tập</span>
          <Select
            value={assignmentId && assignments.some((item) => item.id === assignmentId) ? assignmentId : undefined}
            disabled={!courseId}
            loading={loadingAssignments}
            placeholder="Chọn bài tập"
            onChange={onPick}
            options={assignments.map((item) => ({ value: item.id, label: item.title }))}
            notFoundContent="Khóa học này chưa có bài tập nào"
          />
        </label>
      </div>
      {error && <p className="instructor-submission-picker-error">{error}</p>}
      {!error && courseId && !loadingAssignments && assignments.length === 0 && (
        <p className="instructor-submission-picker-note">Khóa học này chưa có bài tập nào.</p>
      )}
      {!error && !loadingCourses && courses.length === 0 && (
        <p className="instructor-submission-picker-note">Bạn chưa có khóa học nào.</p>
      )}
    </div>
  );
};

export default SubmissionAssignmentPicker;
