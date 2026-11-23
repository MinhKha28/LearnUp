import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { finalizedNotice } from '../../src/modules/instructor-submissions/finalized-notice';

describe('BR-254 finalizedNotice', () => {
  test('names the Assignment and gives the score with the Vietnamese decimal comma', () => {
    const notice = finalizedNotice('Bài tập quản lý thời gian', 66.67);
    assert.equal(notice.title, 'Điểm bài tập đã được công bố');
    assert.equal(
      notice.message,
      'Giảng viên đã chốt điểm cho "Bài tập quản lý thời gian". Điểm cuối cùng của bạn là 66,67%. Bạn có thể xem chi tiết trong kết quả của khóa học.',
    );
  });

  test('shows a whole score without decimals and rounds to two digits', () => {
    assert.match(finalizedNotice('A', 80).message, /là 80%\./);
    assert.match(finalizedNotice('A', 0).message, /là 0%\./);
    assert.match(finalizedNotice('A', 100).message, /là 100%\./);
    assert.match(finalizedNotice('A', 79.456).message, /là 79,46%\./);
  });

  test('keeps the title as the author wrote it', () => {
    assert.match(
      finalizedNotice('Bài <b>1</b>', 70).message,
      /"Bài <b>1<\/b>"/,
    );
  });
});
