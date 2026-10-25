import { afterEach, describe, expect, it, vi } from "vitest";
import { draftFromSettings, signerDirty, signerTextError, signatureHeader, validateSignature, SIGNATURE_MAX_BYTES } from "./certificate.signer";
import type { SignerSettings } from "@/types/certificate-signer.types";

function png(width = 450, height = 150, size = 33) {
  const bytes = new Uint8Array(size);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width); view.setUint32(20, height); bytes[24] = 8; bytes[25] = 6;
  return bytes;
}
function jpeg(width: number, height: number) {
  return new Uint8Array([255, 216, 255, 192, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 0x11, 0]);
}
const settings: SignerSettings = { configured: true, signerName: "An", signerTitle: "Giám đốc", signature: null, version: 1, updatedAt: null };
afterEach(() => vi.unstubAllGlobals());

describe("signature headers before decoding", () => {
  it("full validation accepts 2 MiB but blocks +1 before invoking the decoder", async () => {
    const decode = vi.fn().mockResolvedValue(undefined), revoke = vi.fn();
    const image = vi.fn().mockImplementation(() => ({ decode, naturalWidth: 450, naturalHeight: 150, src: "" }));
    vi.stubGlobal("Image", image);
    vi.stubGlobal("URL", { createObjectURL: () => "blob:boundary", revokeObjectURL: revoke });
    await expect(validateSignature(new File([png(450, 150, SIGNATURE_MAX_BYTES)], "boundary.png"))).resolves.toBeUndefined();
    await expect(validateSignature(new File([png(450, 150, SIGNATURE_MAX_BYTES + 1)], "over.png"))).rejects.toThrow("2 MiB");
    expect(image).toHaveBeenCalledOnce(); expect(decode).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledOnce();
  });
  it("accepts exactly 2 MiB and rejects one extra byte", () => {
    expect(signatureHeader(png(450, 150, SIGNATURE_MAX_BYTES)).width).toBe(450);
    expect(() => signatureHeader(png(450, 150, SIGNATURE_MAX_BYTES + 1))).toThrow("2 MiB");
  });
  it.each([[4096, 1], [4000, 4000]])("accepts boundary %i × %i", (w, h) => {
    expect(signatureHeader(png(w, h))).toMatchObject({ width: w, height: h });
  });
  it.each([[4097, 1], [4000, 4001]])("rejects excessive pixels %i × %i", (w, h) => {
    expect(() => signatureHeader(png(w, h))).toThrow("pixel");
  });
  it("recognizes JPEG SOF independent of suffix/MIME", () => {
    expect(signatureHeader(jpeg(4096, 100))).toEqual({ mime: "image/jpeg", width: 4096, height: 100 });
    expect(() => signatureHeader(jpeg(4097, 100))).toThrow("pixel");
  });
  it.each([new Uint8Array(), new Uint8Array([255, 216, 255]), png(0, 1), png().slice(0, 20)])("rejects malformed/truncated headers", bytes => {
    expect(() => signatureHeader(bytes)).toThrow();
  });
  it("rejects HEIC/WebP and forged filename without decoding", async () => {
    const image = vi.fn();
    vi.stubGlobal("Image", image);
    const file = new File(["RIFFxxxxWEBP"], "forged.png", { type: "image/png" });
    await expect(validateSignature(file)).rejects.toThrow("HEIC");
    expect(image).not.toHaveBeenCalled();
  });
  it("checks header limits before decoding a decompression-sized image", async () => {
    const image = vi.fn();
    vi.stubGlobal("Image", image);
    await expect(validateSignature(new File([png(4097, 4096)], "x.png"))).rejects.toThrow("pixel");
    expect(image).not.toHaveBeenCalled();
  });
  it("decodes a magic-byte PNG despite a misleading extension and revokes its temporary URL", async () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:owned", revokeObjectURL: revoke });
    const decode = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("Image", class { naturalWidth = 450; naturalHeight = 150; decode = decode; src = ""; });
    await validateSignature(new File([png()], "wrong.webp", { type: "image/webp" }));
    expect(decode).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith("blob:owned");
  });
  it("rejects decode failure and still revokes URL", async () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:broken", revokeObjectURL: revoke });
    vi.stubGlobal("Image", class { decode = () => Promise.reject(new Error()); src = ""; });
    await expect(validateSignature(new File([png()], "broken.png"))).rejects.toThrow("Không đọc được");
    expect(revoke).toHaveBeenCalledWith("blob:broken");
  });
});

describe("signer text and draft lifecycle", () => {
  it("counts code points after NFC and trim, including Vietnamese combining marks and emoji", () => {
    expect(signerTextError("  " + "a\u0301".repeat(100) + "  ", 100)).toBeNull();
    expect(signerTextError("😀".repeat(100), 100)).toBeNull();
    expect(signerTextError("😀".repeat(101), 100)).toContain("100");
    expect(signerTextError("a".repeat(200), 200)).toBeNull();
    expect(signerTextError("a".repeat(201), 200)).toContain("200");
  });
  it.each([" ", "An\n", "\ud800"])("rejects invalid required text", value => expect(signerTextError(value, 100)).not.toBeNull());
  it("tracks keep/replace/remove and discards both text and File", () => {
    const original = draftFromSettings(settings);
    expect(signerDirty(original, settings)).toBe(false);
    const file = new File(["image"], "signature.png");
    expect(signerDirty({ ...original, signatureAction: "replace", file }, settings)).toBe(true);
    expect(signerDirty({ ...original, signatureAction: "remove" }, settings)).toBe(true);
    expect(signerDirty({ ...original, name: "Bình" }, settings)).toBe(true);
    expect(draftFromSettings(settings)).toEqual({ name: "An", title: "Giám đốc", signatureAction: "keep" });
  });
});
