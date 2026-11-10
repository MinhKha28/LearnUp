import type { SignerDraft, SignerSettings } from "@/types/certificate-signer.types";

export const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

export function signerTextError(value: string, limit: number): string | null {
  const text = value.normalize("NFC").trim();
  if (!text) return "Vui lòng nhập thông tin.";
  if (/[\p{Cc}\p{Cs}]/u.test(value)) return "Thông tin chứa ký tự không hợp lệ.";
  if ([...text].length > limit) return `Nhập tối đa ${limit} ký tự.`;
  return null;
}

export const draftFromSettings = (settings: SignerSettings): SignerDraft => ({
  name: settings.signerName ?? "",
  title: settings.signerTitle ?? "",
  signatureAction: "keep",
});

export const signerDirty = (draft: SignerDraft, baseline: SignerSettings): boolean =>
  draft.name !== (baseline.signerName ?? "") || draft.title !== (baseline.signerTitle ?? "") ||
  draft.signatureAction !== "keep";

/** Check image headers before browser decoding to bound decoded dimensions. */
export function signatureHeader(bytes: Uint8Array): { mime: string; width: number; height: number } {
  const invalid = () => new Error("Ảnh không hợp lệ hoặc đã bị hỏng.");
  if (!bytes.length) throw invalid();
  if (bytes.length > SIGNATURE_MAX_BYTES) throw new Error("Ảnh không được vượt quá 2 MiB (2.097.152 byte).");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, mime = "";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) {
    mime = "image/png";
    if (bytes.length < 33 || view.getUint32(8) !== 13 ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") throw invalid();
    width = view.getUint32(16);
    height = view.getUint32(20);
    const depths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
    if (!depths[bytes[25]]?.includes(bytes[24]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) throw invalid();
  } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    mime = "image/jpeg";
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 255) throw invalid();
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === undefined || marker === 0 || marker === 0xd9 || marker === 0xda) break;
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) throw invalid();
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw invalid();
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 8 || length !== 8 + 3 * bytes[offset + 7] || !bytes[offset + 7] ||
          ![8, 12, 16].includes(bytes[offset + 2])) throw invalid();
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        break;
      }
      offset += length;
    }
  } else {
    throw new Error("Chỉ chấp nhận ảnh PNG hoặc JPEG. HEIC và WebP không được hỗ trợ.");
  }
  if (!width || !height) throw invalid();
  if (width > 4096 || height > 4096 || width * height > 16_000_000)
    throw new Error("Ảnh phải có mỗi cạnh tối đa 4096 px và tổng tối đa 16.000.000 pixel.");
  return { mime, width, height };
}

export async function validateSignature(file: File): Promise<void> {
  if (file.size > SIGNATURE_MAX_BYTES) throw new Error("Ảnh không được vượt quá 2 MiB (2.097.152 byte).");
  const header = signatureHeader(new Uint8Array(await file.arrayBuffer()));
  const url = URL.createObjectURL(new Blob([file], { type: header.mime }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth !== header.width || image.naturalHeight !== header.height)
      throw new Error("Kích thước ảnh không khớp với thông tin trong tệp.");
  } catch {
    throw new Error("Không đọc được ảnh. Vui lòng chọn ảnh PNG hoặc JPEG hợp lệ.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
