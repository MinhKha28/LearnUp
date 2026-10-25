import { apiGetWithHeaders, apiPutWithHeaders } from "@/services/api.client";
import { ApiError } from "@/types/api.types";
import type { SignerDraft, SignerSettings } from "@/types/certificate-signer.types";

const PATH = "/api/v1/certificates/signer-settings";

const withEtag = (response: { data: SignerSettings; headers: Record<string, unknown> }) => ({
  settings: response.data,
  etag: typeof response.headers.etag === "string" ? response.headers.etag : null,
});

export const getSettings = async (signal?: AbortSignal) =>
  withEtag(await apiGetWithHeaders<SignerSettings>(PATH, { signal }));

export const getSignatureBlob = async (signal?: AbortSignal) =>
  (await apiGetWithHeaders<Blob>(PATH + "/signature", { responseType: "blob", signal })).data;

export const updateSettings = async (draft: SignerDraft, etag: string | null) => {
  if (!etag) throw new ApiError(428, "PRECONDITION_REQUIRED", "Cần tải lại cấu hình trước khi lưu.");
  const body = new FormData();
  body.append("signerName", draft.name.normalize("NFC").trim());
  body.append("signerTitle", draft.title.normalize("NFC").trim());
  body.append("signatureAction", draft.signatureAction);
  if (draft.signatureAction === "replace" && draft.file) body.append("signature", draft.file);
  return withEtag(await apiPutWithHeaders<SignerSettings>(PATH, body, { headers: { "If-Match": etag } }));
};
