import { Global, Module } from '@nestjs/common';
import { IdentityClient } from './identity.client';

// Gom các client gọi sang service khác. Global để UC02 (registrations) và UC04 (invitations) đều tiêm được.
@Global()
@Module({
  providers: [IdentityClient],
  exports: [IdentityClient],
})
export class IntegrationsModule {}
