import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HEADER_NAMES } from '@learnup/ts-common';

/**
 * tenant-service KHÔNG lưu mật khẩu. Mật khẩu thuộc identity-service
 * (LearnUP_Database_Guide mục 1.1). Client này gửi mật khẩu sang identity.
 *
 * Hợp đồng dự kiến (cần chốt với Đạt):
 *   POST {IDENTITY_SERVICE_URL}/api/internal/credentials
 *   Header: x-internal-key
 *   Body:   { userId, password }   -> tạo mới hoặc ghi đè mật khẩu của userId
 *
 * Chưa cấu hình IDENTITY_SERVICE_URL: chạy chế độ giả lập, chỉ ghi log.
 */
@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);

  constructor(private readonly config: ConfigService) {}

  async setPassword(userId: string, password: string): Promise<void> {
    const baseUrl = this.config.get<string>('IDENTITY_SERVICE_URL');
    if (!baseUrl) {
      this.logger.warn(
        `[STUB] Chưa có IDENTITY_SERVICE_URL, bỏ qua lưu mật khẩu cho user ${userId}`,
      );
      return;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/internal/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [HEADER_NAMES.INTERNAL_KEY]: this.config.getOrThrow<string>(
            'INTERNAL_SERVICE_KEY',
          ),
        },
        body: JSON.stringify({ userId, password }),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'IDENTITY_UNAVAILABLE',
        message: 'Không kết nối được identity-service. Vui lòng thử lại sau.',
      });
    }
    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: 'IDENTITY_UNAVAILABLE',
        message: `identity-service trả về HTTP ${response.status}.`,
      });
    }
  }
}
