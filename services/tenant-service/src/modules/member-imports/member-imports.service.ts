import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { STANDARD_ERROR_CODES } from '@learnup/ts-common';
import { Prisma } from '../../../generated/prisma/client';
import {
  DAY_MS,
  TokenPurpose,
  UserStatus,
} from '../../common/constants/tenant.constants';
import { generateSecretToken } from '../../common/utils/token.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { fileTooLarge } from '../../infrastructure/storage/upload-limit';
import { OutboxService } from '../outbox/outbox.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import {
  CREATE_SUBSCRIPTION_STATUSES,
  UsersService,
  type SeatRole,
} from '../users/users.service';
import { ConfirmMemberImportDto } from './dto/confirm-member-import.dto';
import type {
  IImportSeats,
  IImportedAccount,
  IMemberImportPreview,
  IMemberImportResult,
  IValidImportRow,
} from './interfaces/member-import.interface';
import type { IUploadedImportFile } from './interfaces/uploaded-import-file.interface';
import {
  DEFAULT_IMPORT_MAX_FILE_BYTES,
  DEFAULT_IMPORT_MAX_ROWS,
  IMPORT_MULTER_CEILING_BYTES,
  IMPORT_TRANSACTION_MAX_WAIT_MS,
  IMPORT_TRANSACTION_TIMEOUT_MS,
  MEMBER_IMPORTED_ACTION,
} from './member-import.constants';
import { assertXlsxFile, parseMemberImportFile } from './member-import.parser';
import { buildMemberImportTemplate } from './member-import.template';
import {
  checkImportRows,
  emailsToLookUp,
  previewDigestOf,
  splitImportRows,
  type ICheckedImportRow,
} from './member-import.validator';

/**
 * UC12.8 (Instructor), dùng lại cho UC13.8 (Learner): import tài khoản từ tệp Excel.
 * Preview không lưu trạng thái (tenant_db mục 5: không có bảng import). Confirm gửi lại tệp,
 * server đọc và kiểm lại toàn bộ trong transaction (BR-33, BR-34), so previewDigest với lúc preview.
 * BR-28: chỉ tạo tài khoản Pending + lời mời; identity-service không nhận bản ghi nào ở bước này.
 */
@Injectable()
export class MemberImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly settingsService: PlatformSettingsService,
    private readonly outbox: OutboxService,
  ) {}

  /** Tệp mẫu .xlsx (cột Họ tên, Email, Đơn vị công tác, Vai trò). */
  template(role: SeatRole): Promise<Buffer> {
    return buildMemberImportTemplate(role, this.maxRows());
  }

  /** BR-32: trả dòng hợp lệ / dòng lỗi kèm lý do và số chỗ. Không ghi gì vào DB. */
  async preview(
    user: CurrentUser,
    role: SeatRole,
    file: IUploadedImportFile | undefined,
  ): Promise<IMemberImportPreview> {
    const organizationId = this.organizationIdOf(user);
    const rows = await this.readRows(file, role);

    const [takenEmails, seats] = await Promise.all([
      this.findTakenEmailsAcrossOrganizations(
        this.prisma,
        emailsToLookUp(rows),
      ),
      this.usersService.getSeatUsage(organizationId, role),
    ]);
    return this.buildPreview(role, rows, takenEmails, seats);
  }

  /**
   * BR-32, BR-33: tạo các dòng hợp lệ trong MỘT transaction (tài khoản, lời mời, outbox email + audit).
   * Khóa dòng tổ chức FOR UPDATE như UC12.2 nên import song song / thêm tay cùng lúc không vượt số chỗ.
   */
  async confirm(
    user: CurrentUser,
    role: SeatRole,
    file: IUploadedImportFile | undefined,
    dto: ConfirmMemberImportDto,
  ): Promise<IMemberImportResult> {
    const organizationId = this.organizationIdOf(user);
    const rows = await this.readRows(file, role);
    const settings = await this.settingsService.get();

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // ---- 1. Khóa tổ chức; tổ chức Active, Subscription Active (giống UC12.2).
          const { organization, subscription } =
            await this.usersService.assertCanManageAccounts(
              tx,
              organizationId,
              {
                action: 'tạo',
                subscriptionStatuses: CREATE_SUBSCRIPTION_STATUSES,
                lockOrganization: true,
              },
            );

          // ---- 2. Kiểm lại BR-34 trên dữ liệu hiện tại và số chỗ hiện tại (đã có thể đổi sau preview).
          const [takenEmails, used] = await Promise.all([
            this.findTakenEmailsAcrossOrganizations(tx, emailsToLookUp(rows)),
            this.usersService.countUsedSeats(tx, organizationId, role),
          ]);
          const max = this.usersService.seatLimitOf(subscription, role);
          const seats: IImportSeats = {
            used,
            max,
            remaining: Math.max(0, max - used),
            subscriptionStatus: subscription.status,
            canCreate: max - used > 0,
          };
          const preview = this.buildPreview(role, rows, takenEmails, seats);

          // ---- 3. Dữ liệu khác lúc preview -> Organizer xem lại kết quả mới, không tự bỏ dòng.
          if (preview.previewDigest !== dto.previewDigest) {
            throw new ConflictException({
              code: 'IMPORT_CHANGED',
              message:
                'Dữ liệu đã thay đổi so với lúc xem trước. Hãy kiểm tra lại kết quả mới rồi xác nhận.',
              preview,
            });
          }
          if (preview.validRows.length === 0) {
            throw new BadRequestException({
              code: 'NO_VALID_ROWS',
              message: 'Tệp không có dòng hợp lệ nào để import.',
            });
          }
          // ---- 4. BR-33: vượt số chỗ còn lại -> chặn toàn bộ, không import một phần.
          if (preview.exceedsSeats) {
            throw new ConflictException({
              code: 'IMPORT_EXCEEDS_SEATS',
              message: `Số dòng hợp lệ (${preview.validRows.length}) vượt số chỗ còn lại (${seats.remaining}). Không import dòng nào.`,
              validCount: preview.validRows.length,
              remaining: seats.remaining,
            });
          }

          // ---- 5. Tài khoản Pending (membership = organization_id, BR-28).
          const created = await tx.user.createManyAndReturn({
            data: preview.validRows.map((row) => ({
              organizationId,
              email: row.email,
              fullName: row.fullName,
              role,
              department: row.department,
              status: UserStatus.Pending,
              activatedAt: null,
            })),
            select: {
              id: true,
              email: true,
              fullName: true,
              department: true,
              status: true,
              createdAt: true,
            },
          });
          const rowByEmail = new Map<string, IValidImportRow>(
            preview.validRows.map((row) => [row.email, row]),
          );

          // ---- 6. Lời mời: chỉ lưu mã băm; hạn theo tham số nền tảng (BR-30, mặc định 7 ngày).
          const invitations = created.map((account) => ({
            account,
            secret: generateSecretToken(),
            expiresAt: new Date(
              account.createdAt.getTime() +
                settings.invitationLinkTtlDays * DAY_MS,
            ),
          }));
          await tx.accountToken.createMany({
            data: invitations.map(({ account, secret, expiresAt }) => ({
              organizationId,
              userId: account.id,
              purpose: TokenPurpose.Invitation,
              tokenHash: secret.tokenHash,
              expiresAt,
            })),
          });

          // ---- 7. Thư mời qua outbox, cùng transaction (rollback thì không thư nào được gửi).
          for (const { account, secret, expiresAt } of invitations) {
            await this.usersService.enqueueInvitationEmail(tx, {
              organizationId,
              organizationName: organization.name,
              userId: account.id,
              to: account.email,
              fullName: account.fullName,
              role,
              rawToken: secret.rawToken,
              expiresAt,
            });
          }

          // ---- 8. Audit "member import" qua outbox: một bản ghi cho cả lần import.
          await this.outbox.enqueueAudit(tx, {
            aggregateType: 'Organization',
            aggregateId: organizationId,
            record: {
              organizationId,
              actorUserId: user.userId,
              actorRole: user.role,
              actionType: MEMBER_IMPORTED_ACTION,
              targetResourceType: 'Organization',
              targetResourceId: organizationId,
              details: {
                role,
                totalRows: preview.totalRows,
                createdCount: created.length,
                skippedCount: preview.invalidRows.length,
                userIds: created.map((account) => account.id),
              },
            },
          });

          const accounts: IImportedAccount[] = created
            .map((account) => ({
              id: account.id,
              rowNumber: rowByEmail.get(account.email)?.rowNumber ?? 0,
              fullName: account.fullName,
              email: account.email,
              department: account.department,
              status: account.status,
            }))
            .sort((a, b) => a.rowNumber - b.rowNumber);
          return {
            role,
            createdCount: accounts.length,
            skippedCount: preview.invalidRows.length,
            accounts,
          };
        },
        {
          timeout: IMPORT_TRANSACTION_TIMEOUT_MS,
          maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
        },
      );
    } catch (error) {
      // P2002: một email vừa được tạo ở request khác ngay trước khi ghi (partial unique users_email_not_deleted_key).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.usersService.emailAlreadyUsed();
      }
      throw error;
    }
  }

  private async readRows(
    file: IUploadedImportFile | undefined,
    role: SeatRole,
  ): Promise<ICheckedImportRow[]> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'IMPORT_FILE_REQUIRED',
        message: 'Hãy chọn tệp Excel để import.',
      });
    }
    const maxBytes = this.maxFileBytes();
    if (file.size > maxBytes) throw fileTooLarge(maxBytes);
    assertXlsxFile(file.originalname, file.buffer);

    const rawRows = await parseMemberImportFile(file.buffer, this.maxRows());
    return checkImportRows(rawRows, role);
  }

  private buildPreview(
    role: SeatRole,
    rows: ICheckedImportRow[],
    takenEmails: ReadonlySet<string>,
    seats: IImportSeats,
  ): IMemberImportPreview {
    const { validRows, invalidRows } = splitImportRows(rows, takenEmails);
    const exceedsSeats = validRows.length > seats.remaining;
    return {
      role,
      totalRows: rows.length,
      validRows,
      invalidRows,
      seats,
      exceedsSeats,
      canConfirm: seats.canCreate && validRows.length > 0 && !exceedsSeats,
      previewDigest: previewDigestOf(role, validRows),
    };
  }

  /** Truy vấn toàn nền tảng (tenant_db: hậu tố AcrossOrganizations). Chỉ xét tài khoản chưa xóa (BR-39). */
  private async findTakenEmailsAcrossOrganizations(
    client: Prisma.TransactionClient,
    emails: string[],
  ): Promise<Set<string>> {
    if (emails.length === 0) return new Set();
    const accounts = await client.user.findMany({
      where: { email: { in: emails }, deletedAt: null },
      select: { email: true },
    });
    return new Set(accounts.map((account) => account.email));
  }

  private maxFileBytes(): number {
    const configured = Number(this.config.get<string>('IMPORT_MAX_FILE_BYTES'));
    const value =
      Number.isInteger(configured) && configured > 0
        ? configured
        : DEFAULT_IMPORT_MAX_FILE_BYTES;
    return Math.min(value, IMPORT_MULTER_CEILING_BYTES);
  }

  private maxRows(): number {
    const configured = Number(this.config.get<string>('IMPORT_MAX_ROWS'));
    return Number.isInteger(configured) && configured > 0
      ? configured
      : DEFAULT_IMPORT_MAX_ROWS;
  }

  private organizationIdOf(user: CurrentUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException({
        code: STANDARD_ERROR_CODES.FORBIDDEN,
        message: 'Tài khoản không thuộc Organization nào.',
      });
    }
    return user.organizationId;
  }
}
