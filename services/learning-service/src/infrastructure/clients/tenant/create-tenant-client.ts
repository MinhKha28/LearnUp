import type { LoggerService } from '@nestjs/common';
import { FakeTenantClient } from './fake-tenant.client';
import type { TenantClient } from './tenant.client';

export const FAKE_TENANT_CLIENT_WARNING =
  'Đang dùng tenant client GIẢ: mọi tổ chức được coi là Active, không kiểm ân hạn (BR-15). Không dùng ngoài môi trường dev.';

/**
 * Chọn tenant client theo TENANT_CLIENT_MODE; cấu hình sai thì ném lỗi để service từ chối khởi động.
 */
export function createTenantClient(
  get: (key: string) => string | undefined,
  logger: Pick<LoggerService, 'warn'>,
): Pick<TenantClient, 'getOrganizationAccess'> {
  const mode = get('TENANT_CLIENT_MODE')?.trim();

  if (mode === 'fake') {
    if (get('NODE_ENV') === 'production') {
      throw new Error(
        'TENANT_CLIENT_MODE=fake không được dùng khi NODE_ENV=production.',
      );
    }
    const timezone = get('TENANT_FAKE_TIMEZONE')?.trim();
    if (!timezone) {
      throw new Error(
        'Thiếu TENANT_FAKE_TIMEZONE (bắt buộc khi TENANT_CLIENT_MODE=fake), ví dụ Asia/Ho_Chi_Minh.',
      );
    }
    if (!isValidTimezone(timezone)) {
      throw new Error(
        `TENANT_FAKE_TIMEZONE không phải múi giờ IANA hợp lệ: "${timezone}".`,
      );
    }
    logger.warn(FAKE_TENANT_CLIENT_WARNING);
    return new FakeTenantClient(timezone);
  }

  if (mode === 'http') {
    throw new Error(
      'TENANT_CLIENT_MODE=http chưa dùng được: tenant-service chưa có REST trạng thái truy cập tổ chức. Dùng TENANT_CLIENT_MODE=fake trong môi trường dev.',
    );
  }

  throw new Error(
    mode
      ? `TENANT_CLIENT_MODE không hợp lệ: "${mode}". Giá trị cho phép: fake, http.`
      : 'Thiếu TENANT_CLIENT_MODE. Giá trị cho phép: fake, http.',
  );
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
