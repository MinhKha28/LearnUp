/**
 * Logo in trên Certificate (#148). URL công khai không hết hạn nên expiresAt là null; mimeType và sizeBytes
 * là null cho tới khi UC11.1 lưu chúng. achievement tự nhận dạng ảnh từ dữ liệu tải về.
 */
export interface ICertificateLogo {
  url: string;
  expiresAt: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}
