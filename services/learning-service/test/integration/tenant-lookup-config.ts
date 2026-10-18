// Các test tích hợp không gọi tenant thật; UC24.2 thay lookupLearners bằng stub trong app.
process.env.TENANT_SERVICE_URL ??= 'http://127.0.0.1:1';
process.env.ASSESSMENT_CLIENT_MODE = 'fake';
process.env.ASSESSMENT_FAKE_RESULT_COURSE_IDS = '';
process.env.VIDEO_PLAYBACK_MODE = 'course';
