/**
 * Prompt file (BR-320) through the real HTTP API: the upload limits (PDF, 50 MB, Instructor only) and attaching a
 * stored file to an Assignment. The Cloudinary calls themselves are covered by the unit tests with a fake storage;
 * nothing here reaches the network.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  apiFor,
  COURSE,
  createTestDatabase,
  identity,
  ORG,
  OTHER_ORG,
  startService,
  type RunningService,
  type TestDatabase,
} from './harness';

const pdfBytes = Buffer.from('%PDF-1.4\nhello prompt file\n');

describe('Prompt file over HTTP', () => {
  let db: TestDatabase;
  let service: RunningService;
  let api: ReturnType<typeof apiFor>;

  before(async () => {
    db = await createTestDatabase();
    service = await startService(db.url, { COURSE_CLIENT_MODE: 'fake' });
    api = apiFor(service.baseUrl);
  });
  after(async () => {
    await service?.stop();
    await db?.drop();
  });

  const upload = async (
    content?: Buffer,
    name = 'đề bài.pdf',
    headers = identity(),
  ) => {
    const form = new FormData();
    if (content) {
      form.append('file', new Blob([new Uint8Array(content)]), name);
    }
    const response = await fetch(
      `${service.baseUrl}/api/v1/assessments/assignments/prompt-file`,
      { method: 'POST', headers, body: form },
    );
    const json = (await response.json().catch(() => ({}))) as {
      error?: { code?: string };
    };
    return { status: response.status, json };
  };

  const body = (promptFile?: object) => ({
    courseId: COURSE,
    title: 'With file',
    passingScore: 70,
    expectedDurationMinutes: 30,
    rubric: [{ name: 'A', description: 'A desc', maxPoints: 10 }],
    ...(promptFile ? { promptFile } : {}),
  });

  test('only an Instructor can upload; a missing file or a file of another type is a 400', async () => {
    const learner = await upload(
      pdfBytes,
      'a.pdf',
      identity({ role: 'LEARNER' }),
    );
    assert.equal(learner.status, 403);

    const none = await upload();
    assert.equal(none.status, 400);
    assert.equal(none.json.error?.code, 'PROMPT_FILE_REQUIRED');

    const fake = await upload(Buffer.from('MZ this is not a pdf'), 'fake.pdf');
    assert.equal(fake.status, 400);
    assert.equal(fake.json.error?.code, 'PROMPT_FILE_INVALID');
  });

  test('a file over the storage plan limit is a 413 FILE_TOO_LARGE with the limit', async () => {
    const big = Buffer.concat([
      Buffer.from('%PDF-'),
      Buffer.alloc(10 * 1024 * 1024),
    ]);
    const r = await upload(big, 'big.pdf');
    assert.equal(r.status, 413);
    assert.equal(r.json.error?.code, 'FILE_TOO_LARGE');
  });

  test('a file over 50 MB is refused while it is received', async () => {
    const big = Buffer.concat([
      Buffer.from('%PDF-'),
      Buffer.alloc(50 * 1024 * 1024),
    ]);
    const r = await upload(big, 'big.pdf');
    assert.equal(r.status, 413);
    // Multer refuses it before the service runs: same code and Vietnamese message as every other 413
    assert.equal(r.json.error?.code, 'FILE_TOO_LARGE');
    assert.match(
      String((r.json.error as { message?: string }).message),
      /Tệp quá lớn/,
    );
  });

  test('the limit that applies now is told to the screen (maxFileBytes)', async () => {
    const r = await api('GET', '/assignments/prompt-file/limit');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data?.maxFileBytes, 10 * 1024 * 1024);
  });

  test("a file kept in the Organization's prompt folder can be attached, then removed while a prompt text remains", async () => {
    const created = await api(
      'POST',
      '/assignments',
      body({
        fileKey: `learnup/${ORG}/assignments/prompts/brief`,
        fileName: 'brief.pdf',
        mimeType: 'text/plain', // ignored: the type follows the file name
        sizeBytes: pdfBytes.length,
      }),
    );
    assert.equal(created.status, 201, JSON.stringify(created.json));
    assert.equal(created.data.promptFile.fileName, 'brief.pdf');
    assert.equal(created.data.promptFile.mimeType, 'application/pdf');

    const noText = await api('PATCH', `/assignments/${created.data.id}`, {
      promptFile: null,
    });
    assert.equal(noText.status, 400);
    assert.equal(noText.code, 'ASSIGNMENT_PROMPT_REQUIRED');
    const swap = await api('PATCH', `/assignments/${created.data.id}`, {
      prompt: 'Text now',
      promptFile: null,
    });
    assert.equal(swap.status, 200);
    assert.equal(swap.data.promptFile, null);
  });

  test("a key outside the Organization's prompt folder is refused", async () => {
    for (const fileKey of [
      'anything.pdf',
      `learnup/${OTHER_ORG}/assignments/prompts/brief`,
      `learnup/${ORG}/assignments/prompts/../../../${OTHER_ORG}/x`,
    ]) {
      const r = await api(
        'POST',
        '/assignments',
        body({
          fileKey,
          fileName: 'x.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
        }),
      );
      assert.equal(r.status, 400, fileKey);
      assert.equal(r.code, 'PROMPT_FILE_NOT_FOUND', fileKey);
    }
  });

  describe('discarding an uploaded file that was not saved', () => {
    const discard = (fileKey: unknown, headers = identity()) =>
      api('POST', '/assignments/prompt-file/discard', { fileKey }, headers);

    test('only an Instructor, a key of the own Organization folder, and a body with the key', async () => {
      const key = `learnup/${ORG}/assignments/prompts/loose`;
      assert.equal(
        (await discard(key, identity({ role: 'LEARNER' }))).status,
        403,
      );
      assert.equal((await discard(undefined)).status, 400);
      for (const fileKey of [
        'anything.pdf',
        `learnup/${OTHER_ORG}/assignments/prompts/loose`,
        `learnup/${ORG}/assignments/prompts/../../../${OTHER_ORG}/x`,
      ]) {
        const r = await discard(fileKey);
        assert.equal(r.status, 400, fileKey);
        assert.equal(r.code, 'PROMPT_FILE_NOT_FOUND', fileKey);
      }
    });

    test('a file that an Assignment uses is kept (409)', async () => {
      const fileKey = `learnup/${ORG}/assignments/prompts/in-use`;
      const created = await api(
        'POST',
        '/assignments',
        body({
          fileKey,
          fileName: 'used.pdf',
          mimeType: 'application/pdf',
          sizeBytes: pdfBytes.length,
        }),
      );
      assert.equal(created.status, 201, JSON.stringify(created.json));
      const r = await discard(fileKey);
      assert.equal(r.status, 409);
      assert.equal(r.code, 'PROMPT_FILE_IN_USE');
    });
  });
});
