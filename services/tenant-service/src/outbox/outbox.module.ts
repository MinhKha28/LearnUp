import { Global, Module } from '@nestjs/common';
import { OutboxController } from './outbox.controller';
import { EmailRelayService } from './email-relay.service';
import { OutboxService } from './outbox.service';

// @Global: module nào cũng tiêm được OutboxService mà không phải import OutboxModule.
@Global()
@Module({
  controllers: [OutboxController],
  providers: [OutboxService, EmailRelayService],
  exports: [OutboxService],
})
export class OutboxModule {}
