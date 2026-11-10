export interface SignerSettings {
  configured: boolean;
  signerName: string | null;
  signerTitle: string | null;
  signature: { mimeType: "image/png" | "image/jpeg"; sizeBytes: number } | null;
  version: number;
  updatedAt: string | null;
}

export interface SignerDraft {
  name: string;
  title: string;
  signatureAction: "keep" | "replace" | "remove";
  file?: File;
}
