/**
 * The rules learning-service applies to the answer of `assessment-results` (`validateAssessmentResults` in
 * learning-service/src/infrastructure/clients/assessment/assessment-results.client.ts), written down here word for word
 * because the two services do not share a library and a test of this service must not import the code of the other.
 * Returns what a response breaks; empty means learning would accept it. If the validator of learning changes, this changes.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const isCount = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
const isIso = (v: unknown): v is string =>
  typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v));

export function brokenResultRules(data: unknown, courseId: string): string[] {
  const broken: string[] = [];
  if (
    !isObject(data) ||
    data.courseId !== courseId ||
    !Array.isArray(data.items)
  )
    return ['not an object with this courseId and a list of items'];
  const seen = new Set<string>();
  data.items.forEach((raw: unknown, index: number) => {
    const at = `items[${index}]`;
    if (!isObject(raw)) return void broken.push(`${at}: not an object`);
    const item = raw;
    if (typeof item.assessmentId !== 'string' || !UUID.test(item.assessmentId))
      broken.push(`${at}.assessmentId`);
    else if (seen.has(item.assessmentId)) broken.push(`${at}: duplicate`);
    else seen.add(item.assessmentId);
    if (item.kind !== 'QUIZ' && item.kind !== 'ASSIGNMENT')
      broken.push(`${at}.kind`);
    if (typeof item.title !== 'string' || item.title.length === 0)
      broken.push(`${at}.title`);
    if (typeof item.isRequired !== 'boolean') broken.push(`${at}.isRequired`);
    if (typeof item.disabled !== 'boolean') broken.push(`${at}.disabled`);
    if (!isScore(item.passingScore)) broken.push(`${at}.passingScore`);
    if (
      !['InProgress', 'AwaitingResult', 'Completed'].includes(
        String(item.status),
      )
    )
      broken.push(`${at}.status`);
    if (!(item.recordedScore === null || isScore(item.recordedScore)))
      broken.push(`${at}.recordedScore`);
    if (!(item.passed === null || typeof item.passed === 'boolean'))
      broken.push(`${at}.passed`);
    if (!isCount(item.attemptCount)) broken.push(`${at}.attemptCount`);
    if (!isIso(item.lastActivityAt)) broken.push(`${at}.lastActivityAt`);
    // a score and its verdict come together, and the verdict is the one the passing score gives
    if ((item.recordedScore === null) !== (item.passed === null))
      broken.push(`${at}: score and verdict do not come together`);
    if (
      typeof item.recordedScore === 'number' &&
      typeof item.passingScore === 'number' &&
      item.passed !== item.recordedScore >= item.passingScore
    )
      broken.push(`${at}: passed does not follow the passing score`);
    if (item.status === 'Completed' && item.recordedScore === null)
      broken.push(`${at}: Completed without a score`);
    if (item.kind === 'QUIZ') {
      const quiz = item.quiz;
      if (item.assignment !== null || !isObject(quiz))
        return void broken.push(`${at}: Quiz part`);
      if (
        !Array.isArray(quiz.attempts) ||
        !(quiz.bestAttemptNumber === null || isCount(quiz.bestAttemptNumber))
      )
        return void broken.push(`${at}.quiz`);
      quiz.attempts.forEach((a: unknown, i: number) => {
        if (
          !isObject(a) ||
          !isCount(a.attemptNumber) ||
          !isScore(a.score) ||
          !isIso(a.submittedAt) ||
          !(
            a.submissionKind === null ||
            (typeof a.submissionKind === 'string' &&
              a.submissionKind.length > 0)
          )
        )
          broken.push(`${at}.quiz.attempts[${i}]`);
      });
    } else if (item.kind === 'ASSIGNMENT') {
      const part = item.assignment;
      if (item.quiz !== null || !isObject(part))
        return void broken.push(`${at}: Assignment part`);
      if (
        !isCount(part.latestSubmissionNumber) ||
        typeof part.gradingStatus !== 'string' ||
        part.gradingStatus.length === 0
      )
        broken.push(`${at}.assignment`);
    }
  });
  return broken;
}
