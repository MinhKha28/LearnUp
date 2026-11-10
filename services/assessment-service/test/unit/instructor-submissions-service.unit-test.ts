import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import { FakeTenantDirectoryClient } from '../../src/infrastructure/clients/tenant/fake-tenant-directory.client';
import { AWAITING_FINALIZATION } from '../../src/modules/instructor-submissions/instructor-submissions.constants';
import {
  ASSIGNMENT_KIND,
  type InstructorSubmissionsRepository,
} from '../../src/modules/instructor-submissions/instructor-submissions.repository';
import { InstructorSubmissionsService } from '../../src/modules/instructor-submissions/instructor-submissions.service';
import { ASSIGNMENT, COURSE, draftCourse, instructor, MemoryStorage } from './fixtures';

const assessment = {
  id: ASSIGNMENT,
  kind: ASSIGNMENT_KIND,
  courseId: COURSE,
  title: 'Assignment',
  prompt: null,
  promptFileKey: null,
  promptFileName: null,
  promptFileMime: null,
  promptFileSizeBytes: null,
  passingScore: 70,
  peerReviewEnabled: false,
  rubricCriteria: [],
};

const submittedAt = new Date('2026-10-15T00:00:00Z');

function submission(submissionNumber: number, supersededAt: Date | null) {
  return {
    id: `submission-${submissionNumber}`,
    learnerId: 'learner',
    submissionNumber,
    submittedAt,
    supersededAt,
    content: null,
    fileKey: null,
    fileName: null,
    fileMime: null,
    fileSizeBytes: null,
    gradingStatus: AWAITING_FINALIZATION,
    interventionReason: null,
    finalScore: null,
    finalizationComment: null,
    finalizedAt: null,
    assessment,
    reviews: [],
  };
}

function detailWithNewestSupersededAt(supersededAt: Date | null) {
  const newest = submission(2, supersededAt);
  const older = submission(1, submittedAt);
  const history = [newest, older];
  const repository = {
    findSubmissionDetail: async (_organizationId: string, id: string) =>
      history.find((attempt) => attempt.id === id) ?? null,
    findLearnerSubmissions: async () => history,
  } as unknown as InstructorSubmissionsRepository;

  class StubCourses extends CourseServiceClient {
    async getAuthoringContext() {
      return draftCourse();
    }

    setAssignmentMinutes(): never {
      throw new Error('Unexpected assignment update');
    }

    getModuleIds(): never {
      throw new Error('Unexpected module lookup');
    }

    verifyOrganizerReviewAccess(): never {
      throw new Error('Unexpected Organizer review access check');
    }
  }

  const service = new InstructorSubmissionsService(
    repository,
    new StubCourses(),
    new FakeTenantDirectoryClient(),
    new MemoryStorage(),
  );
  return {
    newest: () => service.detail(instructor, newest.id),
    older: () => service.detail(instructor, older.id),
  };
}

describe('InstructorSubmissionsService detail isLatest', () => {
  test('marks only the highest-numbered submission as latest when it is active', async () => {
    const detail = detailWithNewestSupersededAt(null);

    assert.equal((await detail.newest()).isLatest, true);
    assert.equal((await detail.older()).isLatest, false);
  });

  test('does not mark the highest-numbered submission as latest when it is superseded', async () => {
    const detail = detailWithNewestSupersededAt(submittedAt);

    assert.equal((await detail.newest()).isLatest, false);
  });
});
