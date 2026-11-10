/**
 * UC31 with the real file storage (Cloudinary): a Learner uploads a PDF with their submission (UC30), the reviewer downloads
 * it through the service under a neutral name (BR-233), and it is gone once the storage no longer has it.
 *
 * It runs only when REAL_STORAGE_TEST=1 and the three CLOUDINARY_* variables are set (in the environment, or in the .env of
 * this service), because it uploads one small synthetic PDF to that account and deletes it at the end. The other
 * integration tests never reach the storage. Nothing secret is printed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { createStorageProvider } from '../../src/infrastructure/storage/storage.provider';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  INSTRUCTOR,
  ORG,
  SERVICE_DIR,
  startCourseStub,
  startLearningStub,
  startService,
  type CourseStub,
  type LearningStub,
  type RunningService,
  type TestDatabase,
} from './harness';

const KEYS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

/** The three variables, from the environment or from the .env of the service; empty when they are not both there. */
function storageSettings(): Record<string, string> {
  const found: Record<string, string> = {};
  let file = '';
  try {
    file = readFileSync(join(SERVICE_DIR, '.env'), 'utf8');
  } catch {
    file = '';
  }
  for (const key of KEYS) {
    const fromFile = new RegExp(`^${key}=(.*)$`, 'm').exec(file)?.[1];
    const value = (process.env[key] ?? fromFile ?? '')
      .trim()
      .replace(/^["']|["']$/g, '');
    if (value) found[key] = value;
  }
  return KEYS.every((key) => found[key]) ? found : {};
}

const SETTINGS = storageSettings();
const ENABLED =
  process.env.REAL_STORAGE_TEST === '1' && !!SETTINGS.CLOUDINARY_CLOUD_NAME;

const AUTHOR = '00000000-0000-4000-8000-0000000000f1';
const REVIEWER = '00000000-0000-4000-8000-0000000000f2';
const STRANGER = '00000000-0000-4000-8000-0000000000f3';
const as = (user: string) => identity({ user, role: 'LEARNER' });

/** A small PDF: it starts with the signature the upload checks, and it ends so that a reader would accept it. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

describe(
  'UC31 with the real file storage',
  {
    skip: ENABLED
      ? false
      : 'REAL_STORAGE_TEST=1 and the Cloudinary variables are needed',
  },
  () => {
    let db: TestDatabase;
    let course: CourseStub;
    let learning: LearningStub;
    let service: RunningService;
    let api: ReturnType<typeof apiFor>;
    let reviewId: string;
    let fileKey: string | null = null;
    const storage = createStorageProvider({
      get: (key: string) => SETTINGS[key],
    } as unknown as ConfigService);

    const peerReview = (suffix: string, user: string) =>
      fetch(
        `${service.baseUrl}/api/v1/assessments/learner/peer-reviews/${reviewId}${suffix}`,
        { headers: as(user) },
      );

    before(async () => {
      db = await createTestDatabase();
      course = await startCourseStub();
      learning = await startLearningStub();
      service = await startService(db.url, {
        ...SETTINGS,
        COURSE_SERVICE_URL: course.url,
        ENROLLMENT_CLIENT_MODE: 'http',
        LEARNING_SERVICE_URL: learning.url,
        PEER_REVIEW_TICK_MS: '3600000',
      });
      api = apiFor(service.baseUrl);
      const created = await api('POST', '/assignments', {
        courseId: COURSE,
        title: 'Essay with a file',
        prompt: 'Upload your essay',
        passingScore: 70,
        expectedDurationMinutes: 30,
        rubric: [
          { name: 'Quality', description: 'Is it good?', maxPoints: 10 },
        ],
      });
      assert.equal(created.status, 201, JSON.stringify(created.json));
      const assignment = created.data.id as string;
      const on = await api('PUT', `/assignments/${assignment}/peer-review`, {
        enabled: true,
        reviewersPerSubmission: 2,
        scoreGap: 20,
      });
      assert.equal(on.status, 200, JSON.stringify(on.json));

      // UC30 for real: the PDF goes to the storage
      const form = new FormData();
      form.append('content', 'See the attached essay.');
      form.append(
        'file',
        new Blob([new Uint8Array(PDF)], { type: 'application/pdf' }),
        'Nguyen-Van-A-essay.pdf',
      );
      const submitted = await fetch(
        `${service.baseUrl}/api/v1/assessments/learner/assignments/${assignment}/submissions`,
        { method: 'POST', headers: as(AUTHOR), body: form },
      );
      const receipt = (await submitted.json()) as {
        data?: { id: string };
        error?: unknown;
      };
      assert.equal(
        submitted.status,
        201,
        JSON.stringify(receipt).slice(0, 300),
      );
      const [row] = await db.query(
        'SELECT id, cycle_id, file_key FROM submissions WHERE id = $1',
        [receipt.data?.id],
      );
      fileKey = row.file_key as string;
      assert.ok(fileKey, 'the file was stored and its key saved');

      // what the schedule does at the closing line of the cycle, written by hand: handed out, one reviewer
      await db.query(
        `UPDATE peer_review_cycles SET status = 'Assigned', closes_at = now() - interval '1 day',
                review_due_at = now() + interval '5 days' WHERE id = $1`,
        [row.cycle_id],
      );
      const [review] = await db.query(
        `INSERT INTO submission_reviews (id, organization_id, submission_id, cycle_id, reviewer_id, reviewer_role, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Learner', 'Pending', now(), now()) RETURNING id`,
        [ORG, row.id, row.cycle_id, REVIEWER],
      );
      reviewId = review.id as string;
    });

    after(async () => {
      // whatever a test left in the storage goes now; "not_found" is the normal answer when a test removed it already
      if (fileKey) {
        await storage
          .delete(fileKey, { resourceType: 'raw', invalidate: true })
          .catch(() => undefined);
      }
      await service?.stop();
      await course?.stop();
      await learning?.stop();
      await db?.drop();
    });

    test('the detail offers the file under a neutral name, with nothing of the author or of the storage', async () => {
      const response = await peerReview('', REVIEWER);
      assert.equal(response.status, 200);
      const text = await response.text();
      const json = JSON.parse(text) as { data: any };
      assert.equal(json.data.submission.file.fileName, 'submitted-work.pdf');
      assert.equal(json.data.submission.file.mimeType, 'application/pdf');
      assert.equal(json.data.submission.file.sizeBytes, PDF.length);
      for (const secret of [
        'Nguyen-Van-A',
        fileKey as string,
        SETTINGS.CLOUDINARY_CLOUD_NAME,
        AUTHOR,
      ]) {
        assert.equal(
          text.includes(secret),
          false,
          'the answer must not contain the name, the key, the cloud or the author',
        );
      }
    });

    test('the file comes through the service, byte for byte, as an attachment with the neutral name', async () => {
      const response = await peerReview('/file', REVIEWER);
      assert.equal(response.status, 200);
      assert.match(
        response.headers.get('content-type') ?? '',
        /application\/pdf/,
      );
      assert.equal(
        response.headers.get('content-disposition'),
        'attachment; filename="submitted-work.pdf"',
      );
      const body = Buffer.from(await response.arrayBuffer());
      assert.equal(body.length, PDF.length);
      assert.equal(
        Buffer.compare(body, PDF),
        0,
        'the same bytes that were uploaded',
      );
    });

    test('nobody else can get it: a stranger and an Instructor are refused', async () => {
      assert.equal((await peerReview('/file', STRANGER)).status, 404);
      const instructor = await fetch(
        `${service.baseUrl}/api/v1/assessments/learner/peer-reviews/${reviewId}/file`,
        { headers: identity({ user: INSTRUCTOR, role: 'INSTRUCTOR' }) },
      );
      assert.equal(instructor.status, 403);
      const noKey = await fetch(
        `${service.baseUrl}/api/v1/assessments/learner/peer-reviews/${reviewId}/file`,
      );
      assert.equal(noKey.status, 401);
    });

    test('once the storage no longer has the file the answer is 404, not a crash', async () => {
      const gone = await storage.delete(fileKey as string, {
        resourceType: 'raw',
        invalidate: true,
      });
      assert.ok(['deleted', 'not_found'].includes(gone.status));
      fileKey = null; // removed: nothing left for the cleanup
      let status = 0;
      for (let i = 0; i < 20; i += 1) {
        const response = await peerReview('/file', REVIEWER);
        status = response.status;
        if (status === 404) break;
        await new Promise((resolve) => setTimeout(resolve, 1000)); // the delivery network may still serve it for a moment
      }
      assert.equal(status, 404);
    });
  },
);
