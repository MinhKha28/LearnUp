/**
 * TẠM THỜI – thay bằng danh tính từ api-gateway khi UC05 / api-gateway của Đạt hoàn thành.
 *
 * Lý do phải fake: hiện tại request từ frontend KHÔNG đi qua gateway vào tenant-service được, vì
 *   1. Gateway chưa gắn header x-internal-key, nên InternalAuthGuard của tenant trả 401.
 *   2. Route của gateway là /api/users/** (không có v1), còn tenant phục vụ /api/v1/...
 *   3. Gateway route bằng lb://TENANT-SERVICE (Eureka), nhưng tenant-service chưa đăng ký Eureka.
 *
 * Cách hoạt động (chỉ khi DEV_FAKE_AUTH=true VÀ NODE_ENV !== 'production'):
 *   - Request đã có x-internal-key (đi qua gateway / service khác) thì KHÔNG làm gì.
 *   - Đọc x-dev-user-id (không có thì mặc định là Organizer Lan của seed), tra bảng users
 *     để lấy organization_id và role THẬT (không tin header cho hai trường này).
 *     User không tồn tại hoặc đã xóa -> 401.
 *   - Gắn x-internal-key, x-user-id, x-organization-id, x-user-role (role viết HOA)
 *     để InternalAuthGuard cho qua như request thật. Service / controller không biết gì về fake.
 *
 * Cách gỡ bỏ khi gateway dùng được:
 *   1. Đặt DEV_FAKE_AUTH=false (hoặc xóa biến) — middleware không còn tác dụng.
 *   2. Xóa file này và đoạn consumer.apply(DevFakeAuthMiddleware) trong app.module.ts.
 *   3. Frontend: bỏ VITE_DEV_FAKE_USER_ID và đoạn gắn x-dev-user-id trong axios.customize.ts,
 *      đặt lại VITE_BACKEND_URL về gateway.
 */
import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HEADER_NAMES, parseUserRole } from '@learnup/ts-common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export const DEV_USER_ID_HEADER = 'x-dev-user-id';

// Organizer "Lan" của Công ty ABC – khớp ID cố định trong prisma/seed-account-management.ts.
const DEFAULT_DEV_USER_ID = '01900000-0000-7000-8000-00000000a010';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class DevFakeAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DevFakeAuthMiddleware.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const enabled =
      this.config.get<string>('DEV_FAKE_AUTH') === 'true' &&
      process.env.NODE_ENV !== 'production';
    if (!enabled || req.headers[HEADER_NAMES.INTERNAL_KEY] !== undefined) {
      return next();
    }

    const rawUserId = req.headers[DEV_USER_ID_HEADER];
    const userId =
      typeof rawUserId === 'string' && rawUserId.trim() !== ''
        ? rawUserId.trim()
        : DEFAULT_DEV_USER_ID;
    if (!UUID_PATTERN.test(userId)) {
      throw new UnauthorizedException(
        '[DEV_FAKE_AUTH] x-dev-user-id không hợp lệ.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, organizationId: true, role: true },
    });
    const role = parseUserRole(user?.role);
    if (!user || !role) {
      throw new UnauthorizedException(
        '[DEV_FAKE_AUTH] Không tìm thấy tài khoản cho x-dev-user-id.',
      );
    }

    req.headers[HEADER_NAMES.INTERNAL_KEY] = this.config.getOrThrow<string>(
      'INTERNAL_SERVICE_KEY',
    );
    req.headers[HEADER_NAMES.USER_ID] = user.id;
    req.headers[HEADER_NAMES.USER_ROLE] = role;
    if (user.organizationId) {
      req.headers[HEADER_NAMES.ORGANIZATION_ID] = user.organizationId;
    }
    this.logger.debug(
      `[DEV_FAKE_AUTH] ${req.method} ${req.url} as ${user.id} (${role})`,
    );
    next();
  }
}
