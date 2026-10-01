import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ChargeResult } from './interfaces/charge-result.interface';

/**
 * Mock Payment Service (actor ngoài hệ thống trong UC02.1).
 * Không có cổng thanh toán thật: mặc định thành công, trừ khi yêu cầu giả lập lỗi.
 * Tách thành class riêng để sau này thay bằng cổng thật mà không đổi luồng nghiệp vụ.
 */
@Injectable()
export class MockPaymentGateway {
  private readonly logger = new Logger(MockPaymentGateway.name);

  async charge(params: {
    paymentId: string;
    amount: bigint;
    simulateFailure?: boolean;
  }): Promise<ChargeResult> {
    await new Promise((resolve) => setTimeout(resolve, 300)); // giả lập độ trễ mạng
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
