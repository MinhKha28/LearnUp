import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;
export const EMAIL_OTP_SECRET_MIN_BYTES = 32;

/**
 * BR-13: khóa HMAC của mã xác thực email phải là bí mật riêng, đủ dài. Kiểm khi khởi động để tenant dừng ngay,
 * không đợi tới lượt đăng ký đầu tiên mới lỗi 500. Thông báo lỗi không chứa giá trị của khóa.
 */
export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const secret = config.EMAIL_OTP_SECRET;
  if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(
      'EMAIL_OTP_SECRET is required: set a private random value of at least 32 bytes.',
    );
  }
  if (Buffer.byteLength(secret, 'utf8') < EMAIL_OTP_SECRET_MIN_BYTES) {
    throw new Error(
      `EMAIL_OTP_SECRET must be at least ${EMAIL_OTP_SECRET_MIN_BYTES} bytes.`,
    );
  }
  return config;
}

export function generateOtp(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');
}

export function hashOtp(
  secret: string,
  registrationId: string,
  otp: string,
): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    createHmac('sha256', secret).update(`${registrationId}:${otp}`).digest(),
  );
}

export function isOtpMatch(
  secret: string,
  registrationId: string,
  otp: string,
  storedHash: Uint8Array,
): boolean {
  const candidate = hashOtp(secret, registrationId, otp);
  return (
    candidate.length === storedHash.length &&
    timingSafeEqual(candidate, storedHash)
  );
}
