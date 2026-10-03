import { ConflictException, Injectable } from '@nestjs/common';
import { AccountTokensService } from '../account-tokens/account-tokens.service';
import {
  TokenPurpose,
  UserStatus,
} from '../../common/constants/tenant.constants';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { IInvitationInfo } from './interfaces/invitation-info.interface';
import { IAcceptInvitationResult } from './interfaces/accept-invitation-result.interface';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { IdentityClient } from 'src/infrastructure/clients/identity/identity.client';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountTokens: AccountTokensService,
    private readonly identity: IdentityClient,
  ) {}

  // ===========================================================================
  // UC04 - Xem lời mời (màn hình hiện tổ chức, email, vai trò trước khi đặt mật khẩu)
  // ===========================================================================
  async getInvitation(rawToken: string): Promise<IInvitationInfo> {
    const token = await this.accountTokens.findUsable(
      rawToken,
      TokenPurpose.Invitation,
    );
    return {
      email: token.user.email,
      fullName: token.user.fullName,
      role: token.user.role,
      organizationName: token.organization.name,
    };
  }

  // ===========================================================================
  // UC04 - Đặt mật khẩu và kích hoạt tài khoản Instructor / Learner (BR-21)
  // ===========================================================================
  async accept(dto: AcceptInvitationDto): Promise<IAcceptInvitationResult> {
    // GĐ2. Liên kết phải còn dùng được (BR-278) và tài khoản phải đang chờ kích hoạt.
    const token = await this.accountTokens.findUsable(
      dto.token,
      TokenPurpose.Invitation,
    );
    if (token.user.status !== UserStatus.Pending) {
      throw new ConflictException({
        code: 'ACCOUNT_NOT_PENDING',
        message: 'Tài khoản không ở trạng thái chờ kích hoạt.',
      });
    }

    // GĐ3. Mật khẩu lưu ở identity-service, gọi TRƯỚC khi đổi DB (lỗi thì liên kết vẫn dùng lại được).
    await this.identity.setPassword(token.userId, dto.password);

    // GĐ4. Đánh dấu liên kết đã dùng + kích hoạt tài khoản trong cùng transaction.
    await this.prisma.$transaction(async (tx) => {
      await this.accountTokens.consume(tx, token.id);
      await tx.user.update({
        where: { id: token.userId },
        data: { status: UserStatus.Active, activatedAt: new Date() },
      });
    });

    return { email: token.user.email, role: token.user.role };
  }
}
