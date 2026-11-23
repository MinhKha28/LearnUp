/**
 * Đọc .env cho script demo đúng như các service đọc: dùng dotenv.parse của tenant-service (giá trị nhiều dòng trong
 * nháy, giá trị có "=", CRLF, comment cuối dòng). Không bao giờ in giá trị ra log hay thông báo lỗi.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** dotenv.parse lấy từ node_modules của service (tenant dùng chính bản này để đọc .env của nó). */
export function loadDotenvParse(serviceDir) {
  try {
    return createRequire(path.join(serviceDir, "package.json"))("dotenv").parse;
  } catch {
    throw new Error(
      `Không tìm thấy dotenv trong ${serviceDir}. Hãy chạy npm ci trong thư mục đó rồi chạy lại.`,
    );
  }
}

/** Map KEY -> giá trị của một tệp .env; tệp không có thì null. */
export function readEnvFile(file, parse) {
  if (!fs.existsSync(file)) return null;
  return new Map(Object.entries(parse(fs.readFileSync(file))));
}

/**
 * BR-13: tenant không chạy nếu thiếu EMAIL_OTP_SECRET. Biến môi trường có khóa thì giữ (undefined: không ghi đè);
 * biến môi trường rỗng nhưng .env của tenant có khóa thì truyền hẳn khóa đó (Nest ưu tiên biến môi trường, kể cả rỗng);
 * không có ở đâu thì sinh một khóa chỉ dùng cho lượt demo này. onGenerate nhận một câu không chứa giá trị nào.
 */
export function tenantDemoEnv({
  processValue,
  fileEnv,
  onGenerate = () => {},
}) {
  if (processValue?.trim()) return undefined;
  const fileKey = fileEnv?.get("EMAIL_OTP_SECRET");
  if (fileKey?.trim()) return { EMAIL_OTP_SECRET: fileKey };
  onGenerate("Chưa có EMAIL_OTP_SECRET: sinh khóa tạm cho lượt demo này.");
  return { EMAIL_OTP_SECRET: randomBytes(32).toString("base64url") };
}
