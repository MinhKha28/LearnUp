import {
  effectiveUploadLimit,
  resolveStoragePlanLimits,
} from '@learnup/ts-storage';
import { PayloadTooLargeException } from '@nestjs/common';

const MIB = 1024 * 1024;

/** Largest file this service accepts: its product ceiling, lowered to the raw upload limit of the storage plan. */
export const uploadLimitBytes = (ceilingBytes: number): number =>
  effectiveUploadLimit(
    ceilingBytes,
    resolveStoragePlanLimits(process.env),
    'raw',
  );

export const fileTooLarge = (limitBytes: number) =>
  new PayloadTooLargeException({
    code: 'FILE_TOO_LARGE',
    message: `Tệp quá lớn. Dung lượng tối đa là ${Number((limitBytes / MIB).toFixed(1))} MB.`,
    maxSizeBytes: limitBytes,
  });
