import { anonymousEvaluationComments } from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./evaluation.comments.scss";

const EvaluationComments = () => (
  <InstructorPage className="instructor-evaluation-comments">
    <PageHeader
      eyebrow="EVALUATIONS / COMMENTS"
      title="Anonymous Comments"
      subtitle="Free-text Course evaluation comments without Learner identity."
      back
    />
    <InfoPanel title="Privacy">Comment text is detached from Learner identity.</InfoPanel>
    <SectionCard className="instructor-evaluation-comments-card">
      {anonymousEvaluationComments.map((comment, index) => (
        <div className="instructor-evaluation-comment" key={index}>
          <span>Anonymous comment</span>
          <p>{comment}</p>
        </div>
      ))}
    </SectionCard>
  </InstructorPage>
);

export default EvaluationComments;
