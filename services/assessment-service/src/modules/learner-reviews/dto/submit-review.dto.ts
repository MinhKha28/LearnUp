import { InstructorReviewDto } from '../../instructor-submissions/dto/instructor-review.dto';

/**
 * UC31.1: the review of a Learner has the shape of the review of the Instructor (UC32.2): a whole-number score for every
 * criterion of the Rubric and a general comment that is not empty (BR-257). The rules of the Rubric are checked by
 * `scoreFromRubric`, the same function.
 */
export class SubmitReviewDto extends InstructorReviewDto {}
