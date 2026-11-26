import './setup-env';

const COURSE_TIMEOUT_MS = '3000';
const TEST_TIMEZONE = 'Asia/Ho_Chi_Minh';
// Lookup is replaced by the test; this URL must never contact a live Tenant.
const UNUSED_TENANT_URL = 'http://127.0.0.1:1';

process.env.COURSE_SERVICE_TIMEOUT_MS ??= COURSE_TIMEOUT_MS;
process.env.TENANT_CLIENT_MODE ??= 'fake';
process.env.TENANT_FAKE_TIMEZONE ??= TEST_TIMEZONE;
process.env.TENANT_SERVICE_URL ??= UNUSED_TENANT_URL;
process.env.ASSESSMENT_CLIENT_MODE ??= 'fake';
process.env.ASSESSMENT_RESULTS_CLIENT_MODE ??= 'fake';
process.env.ASSESSMENT_COMPLETION_CLIENT_MODE ??= 'fake';
process.env.COMPLETION_WORKER_ENABLED ??= 'false';
process.env.ASSESSMENT_CONSUMER_ENABLED ??= 'false';
