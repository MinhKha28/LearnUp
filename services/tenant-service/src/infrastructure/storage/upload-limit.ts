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

/** D-048: tệp ảnh lớn nhất được nhận là giới hạn sản phẩm, hạ xuống theo giới hạn ảnh của gói storage. */
export const imageUploadLimitBytes = (ceilingBytes: number): number =>
  effectiveUploadLimit(
    ceilingBytes,
    resolveStoragePlanLimits(process.env),
    'image',
  );

export const fileTooLarge = (limitBytes: number) =>
  new PayloadTooLargeException({
    code: 'FILE_TOO_LARGE',
    message: `Tệp quá lớn. Dung lượng tối đa là ${Number((limitBytes / MIB).toFixed(1))} MB.`,
    maxSizeBytes: limitBytes,
  });

/** Multer từ chối tệp vượt fileSize trước khi vào service, với 413 không có mã; đặt trước FileInterceptor để trả FILE_TOO_LARGE. */
@Injectable()
export class ImageSizeLimitInterceptor implements NestInterceptor {
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
              ? fileTooLarge(imageUploadLimitBytes(this.ceilingBytes))
              : error,
          ),
        ),
      );
  }
}
