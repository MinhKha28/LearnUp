// Các test tích hợp không gọi tenant thật; UC24.2 thay lookupLearners bằng stub trong app.
process.env.TENANT_SERVICE_URL ??= 'http://127.0.0.1:1';
