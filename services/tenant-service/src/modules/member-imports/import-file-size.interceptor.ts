import {
  Injectable,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, throwError, type Observable } from 'rxjs';
import { fileTooLarge } from '../../infrastructure/storage/upload-limit';
import { IMPORT_MULTER_CEILING_BYTES } from './member-import.constants';

/** Multer từ chối tệp vượt trần với 413 không có mã; đặt trước FileInterceptor để trả FILE_TOO_LARGE. */
@Injectable()
export class ImportFileSizeInterceptor implements NestInterceptor {
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
              ? fileTooLarge(IMPORT_MULTER_CEILING_BYTES)
              : error,
          ),
        ),
      );
  }
}
