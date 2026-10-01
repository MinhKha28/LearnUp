import { message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, fetchAssignmentsAPI } from "@/services/assessment.service";
import type { IAssignmentSummary } from "@/types/assessment.types";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

const CourseBuilderAssignments = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;

  const [assignments, setAssignments] = useState<IAssignmentSummary[]>([]);
  const [courseLocked, setCourseLocked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAssignmentsAPI(courseId);
        if (!active) return;
        if (res.data) {
          setAssignments(res.data.items);
          setCourseLocked(res.data.courseLocked);
        } else {
          message.error(assessmentErrorText(res, "Unable to load Assignments."));
        }
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
  }, [courseId]);


  const base = `/instructor/courses/${course.id}/builder`;
  // BR-318: no new Assignment once the Course is Locked. Stay disabled until the real Course state is known.
  const addBlocked = courseLocked !== false;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Assignments</span>
      <div className="builder-hero">
        <h1>Assignments</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <div className="builder-table">
            <div className="builder-table-row builder-table-head">
              <span>Assignment</span>
              <span>Peer Review</span>
              <span>Attempts</span>
              <span>Lock</span>
            </div>
            {assignments.map((assignment) => (
              <div
                className="builder-table-row builder-table-row-clickable"
                key={assignment.id}
                onClick={() => navigate(`${base}/assignments/${assignment.id}`)}
              >
                <strong>
                  {assignment.title}
                  {assignment.disabled && " (Disabled)"}
                </strong>
                <span>{assignment.peerReviewEnabled ? "On" : "Off"}</span>
                <span>{assignment.maxConsecutiveAttempts} per sequence</span>
                {/* BR-99: say why an item cannot be edited instead of only showing a state. */}
                <span>{assignment.locked ? "Locked - has submissions" : "Unlocked"}</span>
              </div>
            ))}
            {!loading && assignments.length === 0 && (
              <div className="builder-table-row">
                <span>No Assignments yet.</span>
                <span />
                <span />
                <span />
              </div>
            )}
            {loading && (
              <div className="builder-table-row">
                <span>Loading Assignments...</span>
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          {courseLocked && (
            <div className="builder-banner">
              <strong>Course Locked</strong>
              <p>
                A Learner has enrolled, so no new Assignment can be added. Create a new Course version to add one.
              </p>
            </div>
          )}
          <div className="builder-actions builder-actions-split">
            <InstructorButton onClick={() => navigate(base)}>Back to Course outline</InstructorButton>
            <InstructorButton
              type="primary"
              disabled={addBlocked}
              onClick={() => navigate(`${base}/assignments/new`)}
            >
              + Add Assignment
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Course-level Assessment">
            Every Assignment is Required for Certificate completion.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignments;
