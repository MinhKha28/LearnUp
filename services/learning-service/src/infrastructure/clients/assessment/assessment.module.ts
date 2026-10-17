import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ASSESSMENT_CLIENT } from './assessment.client';
import { createAssessmentClient } from './create-assessment-client';

@Module({
  providers: [
    {
      provide: ASSESSMENT_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = createAssessmentClient((key) => config.get<string>(key));
        if (config.get<string>('ASSESSMENT_CLIENT_MODE')?.trim() === 'fake')
          new Logger('AssessmentClient').warn(
            'Đang dùng assessment client giả cho demo, không dùng trong production.',
          );
        return client;
      },
    },
  ],
  exports: [ASSESSMENT_CLIENT],
})
export class AssessmentModule {}
