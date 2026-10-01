import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ChargeResult } from './interfaces/charge-result.interface';

@Injectable()
export class MockPaymentGateway {
  private readonly logger = new Logger(MockPaymentGateway.name);

  async charge(params: {
    paymentId: string;
    amount: bigint;
    simulateFailure?: boolean;
  }): Promise<ChargeResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.logger.log(
      `Charge ${params.amount} VND cho payment ${params.paymentId}`,
    );

    if (params.simulateFailure) {
      return {
        success: false,
        providerReference: null,
        failureReason: 'Mock Payment Service từ chối giao dịch',
      };
    }
    return {
      success: true,
      providerReference: `MOCK-${randomUUID()}`,
      failureReason: null,
    };
  }
}
