/** UC19.5: BR-182 to BR-185 and BR-269. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  ASSIGNMENT,
  assignmentRow,
  build,
  instructor,
  OTHER_INSTRUCTOR,
  rejectsWith,
} from './fixtures';

const enable = { enabled: true, reviewersPerSubmission: 2, scoreGap: 20 };

describe('updateConfig (UC19.5)', () => {
  test('turning Peer Review on stores the four settings, defaulting cycle 7 and deadline 3 days', async () => {
    const { peerReview, calls } = build();
    const detail = await peerReview.updateConfig(
      instructor,
      ASSIGNMENT,
      enable,
    );

    assert.deepEqual(calls.updates[0], {
      peerReviewEnabled: true,
      peerReviewersPerSubmission: 2,
      peerReviewCycleDays: 7,
      peerReviewDeadlineDays: 3,
      peerReviewScoreGap: 20,
    });
    assert.equal(detail.peerReview.enabled, true);
  });

  test('the platform parameters set the defaults, explicit values win', async () => {
    const configured = build({
      settings: {
        defaultPeerReviewCycleDays: 14,
        defaultPeerReviewDeadlineDays: 5,
      },
    });
    await configured.peerReview.updateConfig(instructor, ASSIGNMENT, enable);
    assert.equal(configured.calls.updates[0].peerReviewCycleDays, 14);
    assert.equal(configured.calls.updates[0].peerReviewDeadlineDays, 5);

    const explicit = build();
    await explicit.peerReview.updateConfig(instructor, ASSIGNMENT, {
      ...enable,
      cycleDays: 10,
      deadlineDays: 2,
    });
    assert.equal(explicit.calls.updates[0].peerReviewCycleDays, 10);
    assert.equal(explicit.calls.updates[0].peerReviewDeadlineDays, 2);
  });

  test('values already stored are kept when the request leaves them out', async () => {
    const { peerReview, calls } = build({
      row: assignmentRow({
        peerReviewEnabled: true,
        peerReviewersPerSubmission: 2,
        peerReviewCycleDays: 21,
        peerReviewDeadlineDays: 9,
        peerReviewScoreGap: 20,
      }),
    });
    await peerReview.updateConfig(instructor, ASSIGNMENT, enable);
    assert.equal(calls.updates[0].peerReviewCycleDays, 21);
    assert.equal(calls.updates[0].peerReviewDeadlineDays, 9);
  });

  test('turning it off only flips the switch', async () => {
    const { peerReview, calls } = build({
      row: assignmentRow({ peerReviewEnabled: true }),
    });
    await peerReview.updateConfig(instructor, ASSIGNMENT, { enabled: false });
    assert.deepEqual(calls.updates[0], { peerReviewEnabled: false });
  });

  test('once the Course is Locked the switch cannot move either way (BR-185)', async () => {
    const turnOn = build({ course: { locked: true } });
    await rejectsWith(
      turnOn.peerReview.updateConfig(instructor, ASSIGNMENT, enable),
      ConflictException,
      'PEER_REVIEW_TOGGLE_LOCKED',
    );
    const turnOff = build({
      row: assignmentRow({ peerReviewEnabled: true }),
      course: { locked: true },
    });
    await rejectsWith(
      turnOff.peerReview.updateConfig(instructor, ASSIGNMENT, {
        enabled: false,
      }),
      ConflictException,
      'PEER_REVIEW_TOGGLE_LOCKED',
    );
    assert.equal(turnOn.calls.updates.length + turnOff.calls.updates.length, 0);
  });

  test('on a Locked Course the settings of an enabled Peer Review can still change (BR-185 limits only the switch)', async () => {
    const { peerReview, calls } = build({
      row: assignmentRow({ peerReviewEnabled: true }),
      course: { locked: true },
    });
    await peerReview.updateConfig(instructor, ASSIGNMENT, {
      ...enable,
      reviewersPerSubmission: 3,
    });
    assert.equal(calls.updates[0].peerReviewersPerSubmission, 3);
  });

  test('a Course in review, archived or disabled accepts no change', async () => {
    for (const course of [{ status: 'Submitted' }, { disabled: true }]) {
      const { peerReview } = build({ course });
      await rejectsWith(
        peerReview.updateConfig(instructor, ASSIGNMENT, enable),
        ConflictException,
        'COURSE_NOT_EDITABLE',
      );
    }
  });

  test("another Instructor's Assignment is not found", async () => {
    const { peerReview } = build({
      course: { instructorId: OTHER_INSTRUCTOR },
    });
    await rejectsWith(
      peerReview.updateConfig(instructor, ASSIGNMENT, enable),
      NotFoundException,
    );
  });
});
