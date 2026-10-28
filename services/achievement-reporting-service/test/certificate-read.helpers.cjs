const { randomUUID } = require('node:crypto');
const { Module, ValidationPipe } = require('@nestjs/common');
const { NestFactory, Reflector } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const {
  CertificatesController,
} = require('../dist/src/modules/certificates/certificates.controller');
const {
  CertificatesService,
} = require('../dist/src/modules/certificates/certificates.service');
const {
  CertificateReadRepository,
} = require('../dist/src/modules/certificates/certificate-read.repository');
const {
  CertificatePdfRenderer,
} = require('../dist/src/modules/certificates/certificate-pdf.renderer');
const {
  CertificatePdfQueue,
} = require('../dist/src/modules/certificates/certificate-pdf.queue');
const {
  InternalAuthGuard,
} = require('../dist/src/common/guards/internal-auth.guard');
const {
  HttpExceptionFilter,
} = require('../dist/src/common/filters/http-exception.filter');
const {
  TransformInterceptor,
} = require('../dist/src/common/interceptors/transform.interceptor');
const { event, delivery, config } = require('./fixtures.cjs');
const settings = {
  timezone: 'Asia/Ho_Chi_Minh',
  queueSize: 16,
  queueWaitMs: 1500,
};
const user = () => ({
  userId: randomUUID(),
  organizationId: randomUUID(),
  role: 'LEARNER',
  isAuthenticated: true,
});
const record = (overrides = {}) => ({
  id: randomUUID(),
  learnerName: 'Nguyễn Thị Ánh',
  organizationName: 'Tổ chức học tập',
  courseName: 'Khóa học kỹ năng',
  versionNumber: 2,
  issuedAt: new Date('2026-10-31T23:00:00.000Z'),
  certificateCode: '0123456789AB',
  completedLate: true,
  signerName: 'Trần Bình',
  signerTitle: 'Giám đốc',
  logoAssetKey: null,
  logoHash: null,
  logoMime: null,
  signatureAssetKey: null,
  signatureHash: null,
  signatureMime: null,
  ...overrides,
});
function headers(u) {
  return {
    'x-internal-key': 'synthetic-certificate-http-test-key',
    'x-user-id': u.userId,
    'x-organization-id': u.organizationId,
    'x-user-role': u.role,
  };
}
async function httpApp(service) {
  class TestModule {}
  Module({
    controllers: [CertificatesController],
    providers: [{ provide: CertificatesService, useValue: service }],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  const reflector = new Reflector();
  app.setGlobalPrefix('api/v1');
  app.useGlobalGuards(
    new InternalAuthGuard(
      reflector,
      new ConfigService({
        INTERNAL_SERVICE_KEY: 'synthetic-certificate-http-test-key',
      }),
    ),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(reflector));
  await app.listen(0, '127.0.0.1');
  return { app, base: await app.getUrl() };
}
async function seed(
  f,
  u,
  { pending = false, at = '2026-10-31T23:00:00.000Z', assets = {} } = {},
) {
  const e = event({
    organizationId: u.organizationId,
    learnerId: u.userId,
    completedAt: at,
    occurredAt: at,
  });
  Object.assign(e.data.scoreSnapshot, {
    organizationId: u.organizationId,
    learnerId: u.userId,
  });
  const result = await f.repository.receive(e, delivery(e), e);
  if (!pending) {
    const rows = await f.repository.claimDueAcrossOrganizations(100, 120000);
    const row = rows.find((r) => r.id === result.id);
    if (!row) throw Error('Seed lease missing');
    await f.repository.issue(row, {
      learnerName: 'Nguyễn Thị Ánh',
      organizationName: 'Tổ chức học tập',
      courseName: 'Khóa học kỹ năng',
      chainId: randomUUID(),
      versionNumber: 2,
      logo: assets.logo ?? null,
      signer: undefined,
    });
  }
  return result.id;
}
function services(
  f,
  storage = {
    read: async () => {
      throw Error('Storage unavailable');
    },
  },
  queueSettings = settings,
) {
  const repository = new CertificateReadRepository(f.db);
  const queue = new CertificatePdfQueue(queueSettings);
  const renderer = new CertificatePdfRenderer(queue, storage, config());
  return {
    repository,
    queue,
    renderer,
    service: new CertificatesService(repository, renderer, settings),
  };
}
module.exports = { settings, user, record, headers, httpApp, seed, services };
