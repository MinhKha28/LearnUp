import { Module } from '@nestjs/common';
import { MockPaymentGateway } from './mock-payment.gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MockPaymentGateway],
  exports: [PaymentsService, MockPaymentGateway], // RegistrationsModule import để dùng ở UC02.1
})
export class PaymentsModule {}
