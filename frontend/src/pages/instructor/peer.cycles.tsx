import { Select } from "antd";
import { useEffect, useState } from "react";
import { InfoPanel, InstructorPage, PageHeader } from "@/components/instructor/instructor.ui";
import PeerCycleTable from "@/components/instructor/peer.cycle.table";
import { fetchAssignmentsAPI } from "@/services/assessment.service";
import { fetchManagedCoursesAPI } from "@/services/course.service";
import type { IInstructorCourseListItem } from "@/types/course.types";
import type { IAssignmentSummary } from "@/types/assessment.types";
import "./peer.cycles.scss";

/** UC33 from the sidebar: pick a Course and one of its Assignments that has Peer Review on, then read its cycles. */
const PeerCycles = () => {
  const [courses, setCourses] = useState<IInstructorCourseListItem[]>([]);
  const [courseId, setCourseId] = useState<string>();
  const [assignments, setAssignments] = useState<IAssignmentSummary[]>([]);
  const [assignmentId, setAssignmentId] = useState<string>();
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
          setCourseId(res.data.result[0]?.id);
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
  }, []);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const load = async () => {
      setLoadingAssignments(true);
      setAssignmentId(undefined);
      try {
        const res = await fetchAssignmentsAPI(courseId);
        if (!active) return;
        // PRE-1 of UC33: only the Assignments with Peer Review on have cycles.
        const withPeerReview = (res.data?.items ?? []).filter((item) => item.peerReviewEnabled);
        setAssignments(withPeerReview);
        setAssignmentId(withPeerReview[0]?.id);
      } catch {
        if (active) setAssignments([]);
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
    <InstructorPage className="instructor-peer-cycles">
      <PageHeader
        eyebrow="Giảng viên"
        title="Chu kỳ chấm chéo"
        subtitle="Quản lý các chu kỳ nộp bài và chấm chéo của bài tập."
      />
      <div className="instructor-cycles-filters">
        <label>
          <span>Khóa học</span>
          <Select
            value={courseId}
            loading={loadingCourses}
            placeholder="Chọn khóa học"
            onChange={setCourseId}
            options={courses.map((course) => ({ value: course.id, label: course.name }))}
            style={{ minWidth: 280 }}
          />
        </label>
        <label>
          <span>Bài tập</span>
          <Select
            value={assignmentId}
            loading={loadingAssignments}
            placeholder="Chọn bài tập"
            onChange={setAssignmentId}
            options={assignments.map((item) => ({ value: item.id, label: item.title }))}
            style={{ minWidth: 280 }}
            notFoundContent="Không có bài tập bật chấm chéo"
          />
        </label>
      </div>
      {error && <p className="instructor-cycles-message">{error}</p>}
      {!error && !loadingCourses && courses.length === 0 && (
        <p className="instructor-cycles-message">Bạn chưa có khóa học nào.</p>
      )}
      {!error && courseId && !loadingAssignments && assignments.length === 0 && (
        <p className="instructor-cycles-message">Khóa học này chưa có bài tập nào bật chấm chéo.</p>
      )}
      {assignmentId && (
        <div className="instructor-cycles-table">
          <PeerCycleTable assignmentId={assignmentId} />
        </div>
      )}
      <InfoPanel title="Quy tắc chu kỳ">
        Chu kỳ mới mở theo lịch; hạn chấm được tính từ thời điểm đóng chu kỳ theo cấu hình bài tập.
      </InfoPanel>
    </InstructorPage>
  );
};

export default PeerCycles;
