import { message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, fetchAssignmentsAPI } from "@/services/assessment.service";
import type { IAssignmentSummary } from "@/types/assessment.types";
import { formatMinutes } from "@/utils/helper";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

const CourseBuilderAssignments = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
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

  const withPeerReview = assignments.filter((a) => a.peerReviewEnabled).length;
  const withSubmissions = assignments.filter((a) => a.locked).length;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Assignments</span>
      <div className="builder-hero">
        <h1>Assignments</h1>
        <p>
          {loading ? "Loading..." : `${assignments.length} Assignment${assignments.length === 1 ? "" : "s"} in ${course.name}`}
        </p>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card builder-assign-card">
          <div className="builder-assign-stats">
            <div>
              <strong>{assignments.length}</strong>
              <span>Total</span>
            </div>
            <div>
              <strong>{withPeerReview}</strong>
              <span>Peer Review on</span>
            </div>
            <div>
              <strong>{withSubmissions}</strong>
              <span>With submissions</span>
            </div>
          </div>

          <div className="builder-assign-list">
            {assignments.map((assignment, index) => (
              <div
                className="builder-assign-item"
                key={assignment.id}
                onClick={() => navigate(`${base}/assignments/${assignment.id}`, { state: { from: pathname } })}
              >
                <span className="builder-assign-index">{index + 1}</span>
                <div className="builder-assign-main">
                  <strong>
                    {assignment.title}
                    {assignment.disabled && " (Disabled)"}
                  </strong>
                  <small>
                    Passing score {assignment.passingScore}% · about {formatMinutes(assignment.expectedDurationMinutes)}
                  </small>
                  <small>
                    {assignment.maxConsecutiveAttempts} attempts, then a {assignment.lockoutHours} h lock
                  </small>
                </div>
                <div className="builder-assign-tags">
                  <em className={`builder-pill${assignment.peerReviewEnabled ? " builder-pill-on" : ""}`}>
                    Peer Review {assignment.peerReviewEnabled ? "on" : "off"}
                  </em>
                  {/* BR-99: say why an item cannot be edited instead of only showing a state. */}
                  <em className={`builder-pill${assignment.locked ? " builder-pill-warn" : ""}`}>
                    {assignment.locked ? "Has submissions" : "Unlocked"}
                  </em>
                </div>
                <span className="builder-assign-chevron">&rsaquo;</span>
              </div>
            ))}
            {!loading && assignments.length === 0 && (
              <div className="builder-assign-empty">No Assignments yet. Add the first one to get started.</div>
            )}
            {loading && <div className="builder-assign-empty">Loading Assignments...</div>}
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
              onClick={() => navigate(`${base}/assignments/new`, { state: { from: pathname } })}
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
