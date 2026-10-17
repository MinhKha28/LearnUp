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
      <span className="builder-crumb">Course Builder / Peer Review Cycles</span>
      <div className="builder-hero">
        <h1>{title ? `${title} - cycles` : "Peer Review Cycles"}</h1>
        <p>
          Cycles run on a schedule, whenever Learners submit. Each has three dates: it opens, it closes and the work is
          assigned, and the reviews are due.
        </p>
      </div>
      <div className="builder-update-card">
        <PeerCycleTable assignmentId={assignmentId} onLoaded={onLoaded} />
        <InstructorButton onClick={() => navigate(detailPath, { state: location.state })}>Back to Assignment</InstructorButton>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentPeerCycles;
