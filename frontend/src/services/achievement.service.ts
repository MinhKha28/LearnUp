import { apiGet, apiGetWithHeaders } from "@/services/api.client";
import type {
  CertificateDetail,
  CertificatePage,
} from "@/types/achievement.types";
import { ApiError } from "@/types/api.types";
const ROOT = "/api/v1/certificates/me";
export const getCertificates = (cursor?: string, signal?: AbortSignal) =>
  apiGet<CertificatePage>(ROOT, {
    params: cursor ? { cursor } : undefined,
    signal,
  });
export const getCertificate = (id: string, signal?: AbortSignal) =>
  apiGet<CertificateDetail>(ROOT + "/" + encodeURIComponent(id), { signal });
export const certificateDate = (date: string) =>
  date.split("-").reverse().join("/");
export function certificateFilename(value: unknown): string {
  if (typeof value !== "string") return "chung-chi.pdf";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  const plain = /filename="([^"]+)"/i.exec(value)?.[1];
  let name = plain;
  try {
    if (encoded) name = decodeURIComponent(encoded);
  } catch {
    /* Use the ASCII fallback for malformed encoding. */
  }
  if (
    !name ||
    name.includes("/") ||
    name.includes("\\") ||
    /\p{Cc}/u.test(name) ||
    !name.toLowerCase().endsWith(".pdf")
  )
    return "chung-chi.pdf";
  return name;
}
function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export async function downloadCertificate(id: string, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await apiGetWithHeaders<Blob>(
        ROOT + "/" + encodeURIComponent(id) + "/pdf",
        { responseType: "blob", signal },
      );
      return {
        blob: result.data,
        filename: certificateFilename(result.headers["content-disposition"]),
      };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 503 || attempt === 2)
        throw error;
      await wait((attempt + 1) * 1000, signal);
    }
  }
}
