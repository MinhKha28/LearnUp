import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;

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
