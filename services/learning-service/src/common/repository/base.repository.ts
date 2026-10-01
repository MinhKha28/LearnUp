import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Client Prisma dùng được trong và ngoài transaction. */
export type DbClient = PrismaService | Prisma.TransactionClient;

/**
 * Nền chung của repository (D15): mọi truy cập database đi qua repository.
 * Mỗi hàm nhận tx tùy chọn để chạy trong transaction của service gọi.
 */
export abstract class BaseRepository {
  protected constructor(protected readonly prisma: PrismaService) {}

  protected db(tx?: Prisma.TransactionClient): DbClient {
    return tx ?? this.prisma;
  }
}
