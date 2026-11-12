import { useCallback, useState } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import PeerCycleTable from "@/components/instructor/peer.cycle.table";
import type { IPeerReviewCycleList } from "@/types/assessment.types";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

/** UC33 from the Assignment Editor: the cycles of this Assignment. */
const CourseBuilderAssignmentPeerCycles = () => {
  const { assignmentId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const [title, setTitle] = useState("");
  const onLoaded = useCallback((list: IPeerReviewCycleList | null) => setTitle(list?.title ?? ""), []);
  const detailPath = `/instructor/courses/${structure.course.id}/builder/assignments/${assignmentId}`;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Chu kỳ chấm chéo</span>
      <div className="builder-hero">
        <h1>{title ? `${title} - chu kỳ` : "Chu kỳ chấm chéo"}</h1>
        <p>
          Chu kỳ chấm chéo chạy theo lịch và tiếp nhận bài nộp của học viên. Mỗi chu kỳ có ba mốc: mở chu kỳ, chốt và phân công chấm, hạn hoàn thành đánh giá.
        </p>
      </div>
      <div className="builder-update-card">
        <PeerCycleTable assignmentId={assignmentId} onLoaded={onLoaded} />
        <InstructorButton onClick={() => navigate(detailPath, { state: location.state })}>Quay lại bài tập</InstructorButton>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentPeerCycles;
