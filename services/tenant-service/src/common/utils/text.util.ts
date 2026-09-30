/**
 * Chuẩn hóa chữ trước khi kiểm độ dài và lưu (quy ước chung của tenant_db):
 * - normalize('NFC'): gộp chữ tiếng Việt "dấu rời" về dạng dựng sẵn.
 * - trim(): bỏ khoảng trắng đầu/cuối.
 * - Gộp nhiều khoảng trắng liên tiếp thành một.
 */
export function normalizeText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Email luôn lưu chữ thường, không khoảng trắng (CHECK email = lower(btrim(email))). */
export function normalizeEmail(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.normalize('NFC').trim().toLowerCase();
}

/** Mã số thuế: chỉ giữ chữ số (bỏ gạch ngang, khoảng trắng). */
export function normalizeTaxCode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(/[\s-]/g, '');
}

/**
 * Số điện thoại về dạng E.164: "0901 234 567" -> "+84901234567".
 * Bỏ khoảng trắng, dấu chấm, gạch ngang, ngoặc.
 */
export function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const compact = value.replace(/[\s.()-]/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('0')) return `+84${compact.slice(1)}`;
  return compact;
}
