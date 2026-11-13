import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { READING_UPLOAD_BUFFER_MAX_BYTES } from './course-values';
import { readIntegerSetting } from './reading-text-extractor';
import { readingParseBusyException } from './reading-upload-busy';

// Đo được: 6 upload 49 MiB được nhận -> RSS đỉnh ~441 MiB trên mức nhàn rỗi
// (2 parse đang chạy + 4 parse chờ của hàng đợi parse).
export const DEFAULT_READING_UPLOAD_MAX_IN_FLIGHT = 6;
export const MIN_READING_UPLOAD_MAX_IN_FLIGHT = 1;

// Thời gian xả body bị từ chối: bằng timeout tạo Reading của frontend (120 s),
// đủ cho 50 MiB ở ~0,42 MiB/s. Số kết nối xả tối đa: ước lượng, chưa đo.
export const DEFAULT_READING_UPLOAD_DRAIN_TIMEOUT_MS = 120_000;
export const MIN_READING_UPLOAD_DRAIN_TIMEOUT_MS = 1_000;
export const DEFAULT_READING_UPLOAD_DRAIN_MAX_CONNECTIONS = 20;
export const MIN_READING_UPLOAD_DRAIN_MAX_CONNECTIONS = 0;

// Giới hạn tạo Reading cộng phần vỏ multipart (tiêu đề, trường form).
export const READING_UPLOAD_DRAIN_MAX_BYTES =
  READING_UPLOAD_BUFFER_MAX_BYTES + 1024 * 1024;

export interface ReadingUploadAdmissionLimits {
  maxInFlight: number;
  drainTimeoutMs: number;
  maxDrainingConnections: number;
}

export const resolveReadingUploadAdmissionLimits = (
  env: Record<string, string | undefined>,
): ReadingUploadAdmissionLimits => ({
  maxInFlight: readIntegerSetting(
    env,
    'READING_UPLOAD_MAX_IN_FLIGHT',
    DEFAULT_READING_UPLOAD_MAX_IN_FLIGHT,
    MIN_READING_UPLOAD_MAX_IN_FLIGHT,
  ),
  drainTimeoutMs: readIntegerSetting(
    env,
    'READING_UPLOAD_DRAIN_TIMEOUT_MS',
    DEFAULT_READING_UPLOAD_DRAIN_TIMEOUT_MS,
    MIN_READING_UPLOAD_DRAIN_TIMEOUT_MS,
  ),
  maxDrainingConnections: readIntegerSetting(
    env,
    'READING_UPLOAD_DRAIN_MAX_CONNECTIONS',
    DEFAULT_READING_UPLOAD_DRAIN_MAX_CONNECTIONS,
    MIN_READING_UPLOAD_DRAIN_MAX_CONNECTIONS,
  ),
});

// Signal bị abort khi client ngắt kết nối trước khi response gửi xong.
export const clientAbortSignal = (res: Response): AbortSignal => {
  const controller = new AbortController();

  res.once('close', () => {
    if (!res.writableFinished) controller.abort();
  });

  return controller.signal;
};

// Giới hạn số request tạo Reading đang xử lý. Chạy trước Multer nên request
// bị từ chối không được đọc body vào bộ nhớ.
@Injectable()
export class ReadingUploadAdmissionInterceptor implements NestInterceptor {
  private readonly limits = resolveReadingUploadAdmissionLimits(process.env);
  private active = 0;
  private draining = 0;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (this.active >= this.limits.maxInFlight) {
      this.discardRejectedBody(req, res);
      throw readingParseBusyException();
    }

    this.active += 1;

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.active -= 1;
    };

    res.once('finish', release);
    res.once('close', release);

    return next.handle();
  }

  // Trình duyệt chỉ đọc được 503 khi đã gửi xong body, nên tiếp tục đọc và bỏ
  // body (không giữ byte nào). Đóng socket khi: body xong, quá giới hạn byte,
  // hoặc quá thời gian xả. Quá số kết nối xả cho phép thì đóng ngay.
  private discardRejectedBody(req: Request, res: Response): void {
    const socket = req.socket;

    if (this.draining >= this.limits.maxDrainingConnections) {
      res.setHeader('Connection', 'close');
      res.once('finish', () => socket.destroy());
      return;
    }

    this.draining += 1;

    let drained = 0;
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      this.draining -= 1;
      req.removeListener('data', discard);
      socket.destroy();
    };
    const discard = (chunk: Buffer) => {
      drained += chunk.length;
      if (drained > READING_UPLOAD_DRAIN_MAX_BYTES) stop();
    };
    const timer = setTimeout(stop, this.limits.drainTimeoutMs);

    // Gắn listener trước khi trả response để Node không tự xả body.
    req.on('data', discard);
    req.once('end', () => {
      if (res.writableFinished) stop();
      else res.once('finish', stop);
    });
    socket.once('close', stop);
  }
}
