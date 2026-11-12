import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, deleteAssignmentAPI, fetchAssignmentAPI } from "@/services/assessment.service";
import type { IAssignment } from "@/types/assessment.types";
import "./course.builder.scss";
import "./course.builder.assignment.scss";
import "./course.builder.confirm.scss";

const CourseBuilderAssignmentDelete = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;

  const [assignment, setAssignment] = useState<IAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAssignmentAPI(assignmentId);
        if (!active) return;
        if (res.data) setAssignment(res.data);
        else message.error(assessmentErrorText(res, "Không thể tải thông tin bài tập."));
      } catch {
        if (active) message.error("Không thể kết nối dịch vụ Đánh giá. Vui lòng thử lại.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [assignmentId]);


  const base = `/instructor/courses/${course.id}/builder`;

  if (!assignment) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Xây dựng khóa học / Xóa bài tập</span>
        <div className="builder-hero">
          <h1>{loading ? "Đang tải bài tập..." : "Không tìm thấy bài tập"}</h1>
        </div>
        {!loading && <InstructorButton onClick={() => navigate(`${base}/assignments`)}>Quay lại</InstructorButton>}
      </InstructorPage>
    );
  }

  // BR-92: blocked only when the Course is Locked AND the Assignment already has submissions.
  const canDelete = !(assignment.courseLocked && assignment.locked);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteAssignmentAPI(assignment.id);
      if (!res.data) {
        message.error(assessmentErrorText(res, "Không thể xóa bài tập."));
        return;
      }
      message.success("Đã xóa bài tập.");
      navigate(`${base}/assignments`);
    } catch {
      message.error("Không thể kết nối dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Xóa bài tập</span>
      <div className="builder-hero">
        <h1>Xóa bài tập</h1>
      </div>
      <div className="builder-confirm-card builder-delete-card">
        <div className="builder-delete-head">
          <span className="builder-delete-icon">
            <DeleteOutlined />
          </span>
          <div>
            <strong>Xóa "{assignment.title}"?</strong>
            <p>Thao tác này không thể hoàn tác.</p>
          </div>
        </div>

        <div className="builder-delete-list">
          <span>Thao tác sẽ xóa vĩnh viễn:</span>
          <ul>
            <li>Bài tập và các tiêu chí chấm ({assignment.rubric.length} criteria)</li>
            <li>Các thiết lập chấm chéo của bài tập</li>
            {assignment.promptFile && <li>Tệp PDF đính kèm ({assignment.promptFile.fileName})</li>}
            {assignment.expectedDurationMinutes != null && (
              <li>{assignment.expectedDurationMinutes} phút trong thời lượng ước tính của khóa học</li>
            )}
          </ul>
        </div>

        {!canDelete && (
          <p className="builder-delete-blocked">
            <WarningOutlined /> Bài tập đã có bài nộp và khóa học đã khóa nên không thể
            xóa. Hãy tạo phiên bản khóa học mới để xóa bài tập.
          </p>
        )}
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(`${base}/assignments/${assignment.id}`, { state: location.state })}>Hủy</InstructorButton>
          <InstructorButton type="primary" danger disabled={!canDelete} loading={deleting} onClick={handleDelete}>
            Xóa bài tập
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentDelete;
