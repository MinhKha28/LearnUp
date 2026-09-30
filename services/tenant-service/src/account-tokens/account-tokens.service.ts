import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DAY_MS,
  TokenPurposeValue,
} from '../common/constants/tenant.constants';
import { generateSecretToken, hashToken } from '../common/utils/token.util';

/**
 * Quản lý bảng account_tokens: liên kết mời (Invitation) và liên kết xác thực
 * email Organizer (EmailVerification). Dùng chung cho UC02.1, UC03, UC04 và
 * UC12.2 / UC13.2 / UC12.7 / UC13.7 (phát lời mời).
 */
@Injectable()
export class AccountTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phát liên kết mới. Phải gọi TRONG transaction:
   * thu hồi liên kết cũ còn hiệu lực rồi mới tạo liên kết mới (BR-278).
   * Trả về chuỗi gốc để ghép vào email; database chỉ giữ mã băm.
   */
  async issue(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      userId: string;
      purpose: TokenPurposeValue;
      ttlDays: number; // chép từ platform_settings.invitation_link_ttl_days (BR-269)
    },
  ): Promise<string> {
    const now = new Date();
    await tx.accountToken.updateMany({
      where: {
        userId: params.userId,
        purpose: params.purpose,
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    const { rawToken, tokenHash } = generateSecretToken();
    await tx.accountToken.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        purpose: params.purpose,
        tokenHash,
        expiresAt: new Date(now.getTime() + params.ttlDays * DAY_MS),
      },
    });
    return rawToken;
  }

  /**
   * Tìm liên kết còn dùng được. Mỗi trường hợp hỏng có mã lỗi riêng để
   * giao diện hiển thị đúng thông báo (BR-278: hết hạn phải nói rõ là hết hạn).
   */
  async findUsable(rawToken: string, purpose: TokenPurposeValue) {
    const token = await this.prisma.accountToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true, organization: true },
    });

    if (!token || token.purpose !== purpose || token.user.deletedAt) {
      throw new BadRequestException({
        code: 'INVALID_LINK',
        message: 'Liên kết không hợp lệ.',
      });
    }
    if (token.consumedAt) {
      throw new ConflictException({
        code: 'LINK_ALREADY_USED',
        message: 'Liên kết đã được sử dụng. Bạn có thể đăng nhập.',
      });
    }
    if (token.revokedAt) {
      throw new GoneException({
        code: 'LINK_REVOKED',
        message:
          'Liên kết đã bị thay bằng liên kết mới hơn. Vui lòng dùng email gần nhất.',
      });
    }
    if (token.expiresAt.getTime() <= Date.now()) {
      throw new GoneException({
        code: 'LINK_EXPIRED',
        message: 'Liên kết đã hết hạn.',
      });
    }
    return token;
  }

  /** Đánh dấu đã dùng. Điều kiện trong WHERE chống 2 request dùng cùng lúc. */
  async consume(tx: Prisma.TransactionClient, tokenId: string): Promise<void> {
    const result = await tx.accountToken.updateMany({
      where: { id: tokenId, consumedAt: null, revokedAt: null },
      data: { consumedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException({
        code: 'LINK_ALREADY_USED',
        message: 'Liên kết đã được sử dụng.',
      });
    }
  }
}
