import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HEADER_NAMES } from '@learnup/ts-common';
import { ISetCredentialsParams } from './interfaces/set-credentials-params.interface';

/**
 * tenant-service KHÔNG lưu mật khẩu. Mật khẩu thuộc identity-service (Java).
 *
 * Hợp đồng (InternalCredentialController của identity-service):
 *   POST {IDENTITY_SERVICE_URL}/api/internal/credentials
 *   Header: x-internal-key
 *   Body:   { userId, password, email, fullName, role, organizationId }
 *           role viết HOA theo enum Java (ORGANIZER, INSTRUCTOR, LEARNER, ADMIN).
 *   identity tạo mới nếu chưa có userId, có rồi thì ghi đè mật khẩu và thông tin.
 *   Email đang thuộc tài khoản khác chưa bị xóa (identity hỏi lại tenant existence) thì identity trả 409.
 *
 * Chưa cấu hình IDENTITY_SERVICE_URL: chạy chế độ giả lập, chỉ ghi log.
 */
export const DEFAULT_IDENTITY_TIMEOUT_MS = 8000;

@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);

  constructor(private readonly config: ConfigService) {}

  /** Thời gian chờ tối đa một lời gọi identity; UC02 dùng để tính thời gian giữ khóa theo email. */
  get timeoutMs(): number {
    const value = Number(
      this.config.get<string>('IDENTITY_SERVICE_TIMEOUT_MS'),
    );
    return Number.isInteger(value) && value > 0
      ? value
      : DEFAULT_IDENTITY_TIMEOUT_MS;
  }

  async setCredentials(params: ISetCredentialsParams): Promise<void> {
    const baseUrl = this.config.get<string>('IDENTITY_SERVICE_URL');
    if (!baseUrl) {
      this.logger.warn(
        `[STUB] Chưa có IDENTITY_SERVICE_URL, bỏ qua lưu mật khẩu cho user ${params.userId}`,
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
        body: JSON.stringify({
          userId: params.userId,
          password: params.password,
          email: params.email,
          fullName: params.fullName,
          role: params.role.toUpperCase(), // 'Organizer' -> 'ORGANIZER' (enum Java)
          organizationId: params.organizationId,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'IDENTITY_UNAVAILABLE',
        message: 'Không kết nối được identity-service. Vui lòng thử lại sau.',
      });
    }
    if (response.status === 409) {
      throw new ConflictException({
        code: 'IDENTITY_CREDENTIAL_CONFLICT',
        message: 'Email đã được sử dụng cho một tài khoản khác.',
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
