import {
  effectiveUploadLimit,
  resolveStoragePlanLimits,
} from '@learnup/ts-storage';
import {
  Injectable,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, throwError, type Observable } from 'rxjs';

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

/**
 * Multer rejects a body above its own fileSize (the product ceiling) before any service runs, with a generic English
 * 413. Put this interceptor before FileInterceptor to answer with the same 413 FILE_TOO_LARGE as the service does.
 */
@Injectable()
export class FileSizeLimitInterceptor implements NestInterceptor {
  constructor(private readonly ceilingBytes: number) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          throwError(() =>
            error instanceof PayloadTooLargeException &&
            (error.getResponse() as { code?: string }).code === undefined
              ? fileTooLarge(uploadLimitBytes(this.ceilingBytes))
              : error,
          ),
        ),
      );
  }
}
