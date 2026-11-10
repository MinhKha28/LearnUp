import { CertificateLearnerGuard } from './certificate-learner.guard';
import { CertificateReadRepository } from './certificate-read.repository';
import { CertificatePdfQueue } from './certificate-pdf.queue';
import { CertificatePdfRenderer } from './certificate-pdf.renderer';
import {
  CERTIFICATE_READ_CONFIG,
  certificateReadConfig,
} from './certificate-read.config';
import { SignerController } from './signer.controller';
import { SignerService } from './signer.service';
import { SignerAccess } from './signer.access';
import { SignerRepository } from './signer.repository';
import { StorageCleanupWorker } from './storage-cleanup.worker';
import { SIGNER_CONFIG, signerConfig } from './signer.config';
import { Module } from '@nestjs/common';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { CertificatesRepository } from './certificates.repository';
import { CompletionConsumer } from './completion.consumer';
import { IssuanceWorker } from './issuance.worker';
import { ISSUANCE_CONFIG, issuanceConfig } from './issuance.config';
import { ISSUANCE_DIRECTORY, HttpIssuanceDirectory } from './issuance.clients';
import {
  ISSUANCE_STORAGE,
  CloudinaryIssuanceStorage,
} from './issuance.storage';

@Module({
  imports: [PrismaModule],
  controllers: [CertificatesController, SignerController],
  providers: [
    CertificatesService,
    CertificateLearnerGuard,
    CertificateReadRepository,
    CertificatePdfQueue,
    CertificatePdfRenderer,
    {
      provide: CERTIFICATE_READ_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        certificateReadConfig((key) => config.get<string>(key)),
    },
    SignerService,
    SignerAccess,
    SignerRepository,
    StorageCleanupWorker,
    {
      provide: SIGNER_CONFIG,
      inject: [ConfigService, ISSUANCE_CONFIG],
      useFactory: (
        config: ConfigService,
        issuance: ReturnType<typeof issuanceConfig>,
      ) => signerConfig((key) => config.get<string>(key), issuance),
    },
    CertificatesRepository,
    CompletionConsumer,
    IssuanceWorker,
    {
      provide: ISSUANCE_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        issuanceConfig((key) => config.get<string>(key)),
    },
    {
      provide: ISSUANCE_DIRECTORY,
      inject: [ISSUANCE_CONFIG],
      useFactory: (config: ReturnType<typeof issuanceConfig>) =>
        new HttpIssuanceDirectory(config),
    },
    {
      provide: ISSUANCE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new CloudinaryIssuanceStorage((key) => config.get<string>(key)),
    },
  ],
  exports: [CertificatesService],
})
export class CertificatesModule {}
