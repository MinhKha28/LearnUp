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
        else message.error(assessmentErrorText(res, "Unable to load the Assignment."));
      } catch {
        if (active) message.error("Unable to reach the Assessment service. Please try again.");
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
        <span className="builder-crumb">Course Builder / Delete Assignment</span>
        <div className="builder-hero">
          <h1>{loading ? "Loading Assignment..." : "Assignment not found"}</h1>
        </div>
        {!loading && <InstructorButton onClick={() => navigate(`${base}/assignments`)}>Back</InstructorButton>}
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
        message.error(assessmentErrorText(res, "Unable to delete the Assignment."));
        return;
      }
      message.success("Assignment deleted.");
      navigate(`${base}/assignments`);
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Delete Assignment</span>
      <div className="builder-hero">
        <h1>Delete Assignment</h1>
      </div>
      <div className="builder-confirm-card builder-delete-card">
        <div className="builder-delete-head">
          <span className="builder-delete-icon">
            <DeleteOutlined />
          </span>
          <div>
            <strong>Delete "{assignment.title}"?</strong>
            <p>This action cannot be undone.</p>
          </div>
        </div>

        <div className="builder-delete-list">
          <span>This will permanently remove:</span>
          <ul>
            <li>The Assignment and its Rubric ({assignment.rubric.length} criteria)</li>
            <li>Its Peer Review settings</li>
            {assignment.promptFile && <li>The attached PDF ({assignment.promptFile.fileName})</li>}
            {assignment.expectedDurationMinutes != null && (
              <li>{assignment.expectedDurationMinutes} min from the Course estimated duration</li>
            )}
          </ul>
        </div>

        {!canDelete && (
          <p className="builder-delete-blocked">
            <WarningOutlined /> This Assignment already has submissions and the Course is Locked, so it cannot be
            deleted. Create a new Course version to remove it.
          </p>
        )}
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(`${base}/assignments/${assignment.id}`, { state: location.state })}>Cancel</InstructorButton>
          <InstructorButton type="primary" danger disabled={!canDelete} loading={deleting} onClick={handleDelete}>
            Delete Assignment
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentDelete;
