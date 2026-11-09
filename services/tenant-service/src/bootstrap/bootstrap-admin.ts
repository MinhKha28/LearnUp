import { ConflictException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { v7 as uuidv7 } from 'uuid';
import { Prisma } from '../../generated/prisma/client';
import {
  UserRoleValue,
  UserStatus,
} from '../common/constants/tenant.constants';
import { normalizeEmail, normalizeText } from '../common/utils/text.util';
import { IdentityClient } from '../infrastructure/clients/identity/identity.client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { IBootstrapAdminInput } from './interfaces/bootstrap-admin-input.interface';
import { IBootstrapAdminResult } from './interfaces/bootstrap-admin-result.interface';

export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;
export const DEFAULT_ADMIN_FULL_NAME = 'Quản trị viên LearnUP';
export const BOOTSTRAP_ADMIN_LOCK_NAMESPACE = 4301;

type BootstrapPrisma = Pick<PrismaService, '$transaction'>;
type BootstrapIdentity = Pick<IdentityClient, 'setCredentials'>;
type Env = Record<string, string | undefined>;

export class BootstrapAdminError extends Error {}

/**
 * Đọc đầu vào từ biến môi trường. Mật khẩu không nhận qua tham số dòng lệnh để không lọt vào lịch sử shell
 * hay danh sách tiến trình, và không bao giờ được in ra.
 */
export function readBootstrapAdminInput(env: Env): IBootstrapAdminInput {
  const email = normalizeEmail(env.ADMIN_EMAIL ?? '') as string;
  const fullName = normalizeText(
    env.ADMIN_FULL_NAME?.trim() ? env.ADMIN_FULL_NAME : DEFAULT_ADMIN_FULL_NAME,
  ) as string;
  const password = env.ADMIN_PASSWORD ?? '';

  if (!isEmail(email)) {
    throw new BootstrapAdminError(
      'ADMIN_EMAIL is missing or not a valid email.',
    );
  }
  if (email.length > 254) {
    throw new BootstrapAdminError(
      'ADMIN_EMAIL must be at most 254 characters.',
    );
  }
  if (fullName.length > 100) {
    throw new BootstrapAdminError(
      'ADMIN_FULL_NAME must be at most 100 characters.',
    );
  }
  if (password.trim() !== password) {
    throw new BootstrapAdminError(
      'ADMIN_PASSWORD must not start or end with spaces.',
    );
  }
  if (
    password.length < ADMIN_PASSWORD_MIN_LENGTH ||
    password.length > ADMIN_PASSWORD_MAX_LENGTH
  ) {
    throw new BootstrapAdminError(
      `ADMIN_PASSWORD is required and must be ${ADMIN_PASSWORD_MIN_LENGTH} to ${ADMIN_PASSWORD_MAX_LENGTH} characters.`,
    );
  }
  return {
    email,
    fullName,
    password,
    allowAdditionalAdmin: env.ADMIN_ALLOW_ADDITIONAL === 'true',
  };
}

/**
 * Stack rỗng: tạo một dòng platform_settings mặc định nếu chưa có và một tài khoản Admin (tenant giữ bản ghi gốc),
 * rồi đặt mật khẩu qua kênh nội bộ có xác thực của identity. Không tạo Gói, Tổ chức hay dữ liệu nghiệp vụ nào.
 * Chạy lại với cùng email thì dùng lại Admin đó và đặt lại mật khẩu.
 */
export async function bootstrapAdmin(
  prisma: BootstrapPrisma,
  identity: BootstrapIdentity,
  input: IBootstrapAdminInput,
  now: () => Date = () => new Date(),
): Promise<IBootstrapAdminResult> {
  const stored = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${BOOTSTRAP_ADMIN_LOCK_NAMESPACE}::int, 0)`;

    const platformSettingsCreated = (await tx.platformSetting.count()) === 0;
    if (platformSettingsCreated) {
      await tx.platformSetting.create({ data: {} });
    }

    const owner = await tx.user.findFirst({
      where: { email: input.email, deletedAt: null },
      select: { id: true, role: true, status: true },
    });
    if (owner) {
      if (owner.role !== UserRoleValue.Admin) {
        throw new BootstrapAdminError(
          'ADMIN_EMAIL already belongs to a non-Admin account. Use another email.',
        );
      }
      if (owner.status !== UserStatus.Active) {
        throw new BootstrapAdminError(
          'The Admin account with this email is not Active; it is not changed by the bootstrap.',
        );
      }
      return {
        adminId: owner.id,
        adminCreated: false,
        platformSettingsCreated,
      };
    }

    if (!input.allowAdditionalAdmin) {
      const otherAdmin = await tx.user.findFirst({
        where: { role: UserRoleValue.Admin, deletedAt: null },
        select: { id: true },
      });
      if (otherAdmin) {
        throw new BootstrapAdminError(
          'An Admin account already exists. Set ADMIN_ALLOW_ADDITIONAL=true to add another one.',
        );
      }
    }

    const createdAt = now();
    const adminId = uuidv7();
    await tx.user.create({
      data: {
        id: adminId,
        organizationId: null,
        email: input.email,
        fullName: input.fullName,
        role: UserRoleValue.Admin,
        status: UserStatus.Active,
        activatedAt: createdAt,
      } satisfies Prisma.UserUncheckedCreateInput,
    });
    return { adminId, adminCreated: true, platformSettingsCreated };
  });

  try {
    await identity.setCredentials({
      userId: stored.adminId,
      password: input.password,
      email: input.email,
      fullName: input.fullName,
      role: UserRoleValue.Admin,
      organizationId: null,
    });
  } catch (error) {
    if (error instanceof ConflictException) {
      throw new BootstrapAdminError(
        'identity-service refused the email (409): it belongs to another credential. The tenant Admin row is kept; use another email or fix the conflict, then run again.',
      );
    }
    throw new BootstrapAdminError(
      'identity-service did not accept the credential. The tenant Admin row is kept; run the command again when identity-service is reachable.',
    );
  }

  return { ...stored, email: input.email };
}

export async function runBootstrapAdmin(
  env: Env,
): Promise<IBootstrapAdminResult> {
  for (const key of [
    'DATABASE_URL',
    'IDENTITY_SERVICE_URL',
    'INTERNAL_SERVICE_KEY',
  ]) {
    if (!env[key]?.trim()) {
      throw new BootstrapAdminError(`${key} is required.`);
    }
  }
  const input = readBootstrapAdminInput(env);
  const config = {
    get: (key: string) => env[key],
    getOrThrow: (key: string) => {
      const value = env[key];
      if (value === undefined)
        throw new BootstrapAdminError(`${key} is required.`);
      return value;
    },
  };
  const prisma = new PrismaService(config as never);
  try {
    return await bootstrapAdmin(
      prisma,
      new IdentityClient(config as never),
      input,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runBootstrapAdmin(process.env)
    .then((result) => {
      console.log(
        `${result.adminCreated ? 'Created' : 'Kept'} Admin ${result.email} (${result.adminId}); password set in identity-service.`,
      );
      console.log(
        result.platformSettingsCreated
          ? 'Created the default platform settings.'
          : 'Platform settings already existed; left unchanged.',
      );
    })
    .catch((error: unknown) => {
      console.error(
        `Admin bootstrap failed: ${error instanceof BootstrapAdminError ? error.message : 'unexpected error, see the stack below.'}`,
      );
      if (!(error instanceof BootstrapAdminError)) console.error(error);
      process.exitCode = 1;
    });
}
