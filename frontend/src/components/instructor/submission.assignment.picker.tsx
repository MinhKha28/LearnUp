import { Select } from "antd";
import { useEffect, useState } from "react";
import { fetchAssignmentsAPI } from "@/services/assessment.service";
import { fetchManagedCoursesAPI } from "@/services/course.service";
import type { IAssignmentSummary } from "@/types/assessment.types";
import type { IInstructorCourseListItem } from "@/types/course.types";
import "./submission.assignment.picker.scss";

/** The submissions of an Assignment are listed per Assignment: pick a Course, then one of its Assignments. */
const SubmissionAssignmentPicker = ({
  onPick,
}: {
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
        if (res.data) setCourses(res.data.result);
        else setError(res.message || "Không thể tải danh sách khóa học bạn phụ trách.");
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
  }, []);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const load = async () => {
      setLoadingAssignments(true);
      setError("");
      try {
        const res = await fetchAssignmentsAPI(courseId);
        if (active) setAssignments(res.data?.items ?? []);
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
  }, [courseId]);

  return (
    <div className="instructor-submission-picker">
      <div className="instructor-submission-picker-fields">
        <label>
          <span>Khóa học</span>
          <Select
            value={courseId}
            loading={loadingCourses}
            placeholder="Chọn khóa học"
            onChange={(value) => {
              setAssignments([]);
              setCourseId(value);
            }}
            options={courses.map((course) => ({ value: course.id, label: course.name }))}
            notFoundContent="Bạn chưa có khóa học nào"
          />
        </label>
        <label>
          <span>Bài tập</span>
          <Select
            value={undefined}
            disabled={!courseId}
            loading={loadingAssignments}
            placeholder="Chọn bài tập để xem bài nộp"
            onChange={onPick}
            options={assignments.map((item) => ({ value: item.id, label: item.title }))}
            notFoundContent="Khóa học này chưa có bài tập nào"
          />
        </label>
      </div>
      {error && <p className="instructor-submission-picker-error">{error}</p>}
    </div>
  );
};

export default SubmissionAssignmentPicker;
