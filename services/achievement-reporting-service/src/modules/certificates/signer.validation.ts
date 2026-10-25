import { HttpException } from '@nestjs/common';
export const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;
export interface UploadedSignature {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
export function fail(status: number, code: string): never {
  throw new HttpException({ code }, status);
}
export function expectedVersion(value: unknown): number {
  if (value === undefined) fail(428, 'PRECONDITION_REQUIRED');
  if (typeof value !== 'string' || !/^"(0|[1-9][0-9]*)"$/.test(value))
    fail(400, 'INVALID_IF_MATCH');
  const version = Number(value.slice(1, -1));
  if (!Number.isSafeInteger(version) || version > 2147483646)
    fail(400, 'INVALID_IF_MATCH');
  return version;
}
function name(value: unknown, max: number): string {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cs}]/u.test(value))
    fail(400, 'SIGNER_NAME_INVALID');
  const normalized = value.normalize('NFC').trim();
  if (!normalized || [...normalized].length > max)
    fail(400, 'SIGNER_NAME_INVALID');
  return normalized;
}
export interface SignatureImage {
  bytes: Buffer;
  mime: 'image/png' | 'image/jpeg';
}
export function signatureImage(bytes: Buffer): SignatureImage {
  if (!bytes.length) fail(400, 'SIGNATURE_IMAGE_INVALID');
  if (bytes.length > SIGNATURE_MAX_BYTES) fail(413, 'SIGNATURE_TOO_LARGE');
  let width = 0,
    height = 0,
    mime: SignatureImage['mime'];
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    mime = 'image/png';
    if (
      bytes.length < 33 ||
      bytes.readUInt32BE(8) !== 13 ||
      bytes.toString('ascii', 12, 16) !== 'IHDR'
    )
      fail(400, 'SIGNATURE_IMAGE_INVALID');
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
    const depth = bytes[24],
      color = bytes[25];
    const depths: Record<number, number[]> = {
      0: [1, 2, 4, 8, 16],
      2: [8, 16],
      3: [1, 2, 4, 8],
      4: [8, 16],
      6: [8, 16],
    };
    if (
      !depths[color]?.includes(depth) ||
      bytes[26] !== 0 ||
      bytes[27] !== 0 ||
      bytes[28] > 1
    )
      fail(400, 'SIGNATURE_IMAGE_INVALID');
  } else if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  ) {
    mime = 'image/jpeg';
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 255) fail(400, 'SIGNATURE_IMAGE_INVALID');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (
        marker === undefined ||
        marker === 0 ||
        marker === 0xd9 ||
        marker === 0xda
      )
        break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) fail(400, 'SIGNATURE_IMAGE_INVALID');
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length)
        fail(400, 'SIGNATURE_IMAGE_INVALID');
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        if (
          length < 8 ||
          length !== 8 + 3 * bytes[offset + 7] ||
          bytes[offset + 7] === 0 ||
          ![8, 12, 16].includes(bytes[offset + 2])
        )
          fail(400, 'SIGNATURE_IMAGE_INVALID');
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
        break;
      }
      offset += length;
    }
  } else fail(415, 'SIGNATURE_UNSUPPORTED_TYPE');
  if (!width || !height) fail(400, 'SIGNATURE_IMAGE_INVALID');
  if (width > 4096 || height > 4096 || width * height > 16000000)
    fail(400, 'SIGNATURE_DIMENSIONS_TOO_LARGE');
  return { bytes, mime };
}
export function validateSigner(body: unknown, file?: UploadedSignature) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    fail(400, 'SIGNER_REQUEST_INVALID');
  const data = body as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (k) => !['signerName', 'signerTitle', 'signatureAction'].includes(k),
    )
  )
    fail(400, 'SIGNER_REQUEST_INVALID');
  const signerName = name(data.signerName, 100),
    signerTitle = name(data.signerTitle, 200);
  const action = data.signatureAction;
  if (
    !['keep', 'replace', 'remove'].includes(String(action)) ||
    typeof action !== 'string'
  )
    fail(400, 'SIGNATURE_ACTION_INVALID');
  if (
    (action === 'replace') !== Boolean(file) ||
    (file && file.fieldname !== 'signature')
  )
    fail(400, 'SIGNATURE_FILE_INVALID');
  if (
    file &&
    (!Buffer.isBuffer(file.buffer) || file.size !== file.buffer.length)
  )
    fail(400, 'SIGNATURE_FILE_INVALID');
  return {
    signerName,
    signerTitle,
    action: action as 'keep' | 'replace' | 'remove',
    image: file ? signatureImage(file.buffer) : null,
  };
}
