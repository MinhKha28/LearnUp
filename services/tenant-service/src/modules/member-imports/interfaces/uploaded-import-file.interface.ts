/** Tệp multer (memory storage) của endpoint import; chỉ các trường service dùng. */
export interface IUploadedImportFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
