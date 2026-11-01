const { randomUUID } = require('node:crypto');
function event(overrides = {}) {
  const organizationId = randomUUID(),
    learnerId = randomUUID(),
    courseId = randomUUID();
  const completedAt = new Date(Date.now() - 100).toISOString();
  const data = {
    organizationId,
    learnerId,
    courseId,
    enrollmentId: randomUUID(),
    enrollmentType: 'Required',
    completedAt,
    dueAt: new Date(Date.now() + 100000).toISOString(),
    completedLate: false,
    occurredAt: completedAt,
    scoreSnapshot: {
      schemaVersion: 1,
      snapshotId: randomUUID(),
      asOf: completedAt,
      revision: 'fixture-v1',
      organizationId,
      learnerId,
      courseId,
      eligible: true,
      requiredComponentCount: 1,
      quizzes: [
        {
          assessmentId: randomUUID(),
          attemptId: randomUUID(),
          recordedScore: '90.25',
          passingScore: '50',
          passed: true,
        },
      ],
      assignments: [],
    },
  };
  Object.assign(data, overrides);
  return {
    eventId: randomUUID(),
    eventType: 'EnrollmentCompleted',
    version: 1,
    occurredAt: data.completedAt,
    organizationId: data.organizationId,
    producer: 'learning-service',
    data,
  };
}
const delivery = (value, offset = '0') => ({
  topic: 'learnup.learning.enrollment-events',
  partition: 0,
  offset,
  key: value?.data?.enrollmentId ? Buffer.from(value.data.enrollmentId) : null,
  value: Buffer.from(JSON.stringify(value)),
});
const config = (overrides) => ({
  enabled: true,
  brokers: ['127.0.0.1:1'],
  topic: 'learnup.learning.enrollment-events',
  groupId: 'achievement-reporting-certificate-v1',
  tenantUrl: 'http://tenant.invalid',
  courseUrl: 'http://course.invalid',
  internalKey: 'synthetic-test-key',
  fallbackTimezone: 'Asia/Ho_Chi_Minh',
  profileMode: 'http',
  courseMode: 'http',
  concurrency: 4,
  leaseMs: 120000,
  pollMs: 1000,
  timeoutMs: 100,
  maxLogoBytes: 1024,
  logoHosts: ['res.cloudinary.com'],
  ...overrides,
});
const row = () => ({
  id: randomUUID(),
  organization_id: randomUUID(),
  learner_id: randomUUID(),
  course_id: randomUUID(),
  issue_attempts: 0,
  lease_token: randomUUID(),
  lease_until: new Date(Date.now() + 120000),
});
const directory = () => ({
  learnerName: async () => 'Nguyễn Văn Kiểm',
  profile: async (org) => ({
    organizationId: org,
    name: 'Tổ chức kiểm thử',
    timezone: 'Asia/Ho_Chi_Minh',
    logo: null,
  }),
  course: async (_org, id) => ({
    courseId: id,
    chainId: randomUUID(),
    name: 'Khóa học kiểm thử',
    versionNumber: 2,
  }),
});
module.exports = { event, delivery, config, row, directory };
