// UC12.8 / UC13.8 - Chống zip bomb (assertZipExpandsWithin) và đọc dòng của tệp .xlsx. Không cần Postgres.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deflateRawSync } = require('node:zlib');
const ExcelJS = require('exceljs');
const {
  assertZipExpandsWithin,
  parseMemberImportFile,
} = require('../dist/src/modules/member-imports/member-import.parser');
const {
  IMPORT_MAX_ZIP_ENTRIES,
} = require('../dist/src/modules/member-imports/member-import.constants');

const KIB = 1024;
const MIB = 1024 * KIB;

/**
 * Dựng gói ZIP tối thiểu theo APPNOTE (local header + dữ liệu, central directory, EOCD).
 * Mỗi mục: { content } (nén deflate) hoặc { data, method } (byte thô), cùng các trường để làm hỏng
 * có chủ đích: flags, compressedSize, localOffset, localSignature. CRC để 0 vì hàm kiểm không đọc CRC.
 */
function zip(entries, { entryCount } = {}) {
  const parts = [];
  const centrals = [];
  let offset = 0;
  entries.forEach((entry, index) => {
    const name = Buffer.from(entry.name ?? `part-${index}.xml`);
    const method = entry.method ?? 8;
    const data =
      entry.data ?? (method === 8 ? deflateRawSync(entry.content) : entry.content);
    const flags = entry.flags ?? 0;
    const compressedSize = entry.compressedSize ?? data.length;
    const uncompressedSize = entry.content ? entry.content.length : data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(entry.localSignature ?? 0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(compressedSize, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(compressedSize, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(entry.localOffset ?? offset, 42);
    centrals.push(central, name);

    parts.push(local, name, data);
    offset += local.length + name.length + data.length;
  });

  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entryCount ?? entries.length, 8);
  eocd.writeUInt16LE(entryCount ?? entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, eocd]);
}

const errorOf = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.getResponse();
  }
  assert.fail('expected assertZipExpandsWithin to throw');
};
const isTooLarge = (body) =>
  body.code === 'INVALID_IMPORT_FILE' && body.message.includes('quá lớn sau khi giải nén');
const isCorrupt = (body) =>
  body.code === 'INVALID_IMPORT_FILE' && body.message.startsWith('Không đọc được tệp Excel');

async function xlsx(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Import');
  sheet.addRow(['Họ tên*', 'Email*', 'Đơn vị công tác', 'Vai trò*']);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('zip: a real .xlsx written by exceljs passes; the cap is on the measured size, not the declared one', async () => {
  const buffer = await xlsx([['Minh', 'minh@example.test', '', 'Learner']]);
  assert.doesNotThrow(() => assertZipExpandsWithin(buffer, 20 * MIB));
  // Cùng tệp, trần nhỏ hơn dung lượng bung ra thật -> từ chối.
  assert.ok(isTooLarge(errorOf(() => assertZipExpandsWithin(buffer, 100))));
});

test('zip bomb: a small deflate entry that expands past the cap is refused, the message gives the cap in MB', () => {
  const bomb = zip([{ content: Buffer.alloc(8 * MIB) }]);
  assert.ok(bomb.length < 64 * KIB, 'the bomb itself is tiny');
  const body = errorOf(() => assertZipExpandsWithin(bomb, 2 * MIB));
  assert.ok(isTooLarge(body));
  assert.match(body.message, /tối đa 2 MB/);
  assert.doesNotThrow(() => assertZipExpandsWithin(bomb, 8 * MIB), 'exactly at the cap is allowed');
});

test('zip bomb: the declared uncompressed size is ignored (a lying header does not help)', () => {
  const bomb = zip([{ content: Buffer.alloc(4 * MIB) }]);
  // Ghi đè "uncompressed size" ở local header và central directory thành 1 byte.
  bomb.writeUInt32LE(1, 22);
  const centralAt = bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bomb.writeUInt32LE(1, centralAt + 24);
  assert.ok(isTooLarge(errorOf(() => assertZipExpandsWithin(bomb, 1 * MIB))));
});

test('zip bomb: sizes add up across entries', () => {
  const two = zip([
    { content: Buffer.alloc(600 * KIB) },
    { content: Buffer.alloc(600 * KIB) },
  ]);
  assert.doesNotThrow(() => assertZipExpandsWithin(two, 1200 * KIB));
  assert.ok(isTooLarge(errorOf(() => assertZipExpandsWithin(two, 1 * MIB))));
});

test('zip: stored entries count their raw size; empty deflate entries are fine', () => {
  const stored = zip([{ method: 0, data: Buffer.alloc(2 * KIB, 0x41) }]);
  assert.doesNotThrow(() => assertZipExpandsWithin(stored, 2 * KIB));
  assert.ok(isTooLarge(errorOf(() => assertZipExpandsWithin(stored, 1 * KIB))));

  const emptyDeflate = zip([{ method: 8, data: Buffer.alloc(0) }]);
  assert.doesNotThrow(() => assertZipExpandsWithin(emptyDeflate, 1));
});

test('zip: corrupt or unsupported structures are refused as INVALID_IMPORT_FILE', () => {
  const ok = () => ({ content: Buffer.from('<xml/>') });
  const cases = {
    'no end-of-central-directory record': Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(64),
    ]),
    'encrypted entry': zip([{ ...ok(), flags: 0x1 }]),
    'unsupported compression method (bzip2)': zip([{ method: 12, data: Buffer.from('BZh9') }]),
    'ZIP64 marker in compressed size': zip([{ ...ok(), compressedSize: 0xffffffff }]),
    'ZIP64 marker in entry count': zip([ok()], { entryCount: 0xffff }),
    'directory claims more entries than it has': zip([ok()], { entryCount: 2 }),
    'local header with a wrong signature': zip([{ ...ok(), localSignature: 0x12345678 }]),
    'local offset outside the file': zip([{ ...ok(), localOffset: 0x7fffffff }]),
    'compressed data runs past the end of the file': zip([{ ...ok(), compressedSize: 0x00ffffff }]),
    'deflate data that is not deflate': zip([{ method: 8, data: Buffer.from([0xff, 0xff, 0xff, 0xff]) }]),
  };
  for (const [name, buffer] of Object.entries(cases)) {
    assert.ok(isCorrupt(errorOf(() => assertZipExpandsWithin(buffer, 20 * MIB))), name);
  }
});

test('zip: more entries than IMPORT_MAX_ZIP_ENTRIES is refused before anything is inflated', () => {
  const many = zip(
    Array.from({ length: IMPORT_MAX_ZIP_ENTRIES + 1 }, () => ({ method: 0, data: Buffer.alloc(0) })),
  );
  const body = errorOf(() => assertZipExpandsWithin(many, 20 * MIB));
  assert.equal(body.code, 'INVALID_IMPORT_FILE');
  assert.match(body.message, /cấu trúc bất thường/);

  const atLimit = zip(
    Array.from({ length: IMPORT_MAX_ZIP_ENTRIES }, () => ({ method: 0, data: Buffer.alloc(0) })),
  );
  assert.doesNotThrow(() => assertZipExpandsWithin(atLimit, 20 * MIB));
});

test('parser: the zip check runs before exceljs (a bomb never reaches workbook.load)', async () => {
  const bomb = zip([{ name: 'xl/worksheets/sheet1.xml', content: Buffer.alloc(4 * MIB) }]);
  await assert.rejects(parseMemberImportFile(bomb, 10, 1 * MIB), (e) => isTooLarge(e.getResponse()));
});

test('parser: a styled cell on the last Excel row does not make it walk a million empty rows', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Import');
  sheet.addRow(['Họ tên*', 'Email*', 'Đơn vị công tác', 'Vai trò*']);
  sheet.addRow(['Minh', 'minh@example.test', '', 'Learner']);
  sheet.getCell('A1048576').value = ' '; // chỉ khoảng trắng: dòng có giá trị nhưng được coi là trống
  sheet.getCell('B1048576').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFF0000' },
  };
  sheet.getCell('C1048575').numFmt = '0.00'; // ô chỉ có định dạng, không có giá trị
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  // Điều kiện của ca này: sau khi đọc lại, rowCount đúng là ~1 triệu.
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer);
  assert.equal(reloaded.worksheets[0].rowCount, 1_048_576);

  // Vòng lặp cũ (1..rowCount + getRow) vẫn chạy < 1 s nhưng tạo ~1 triệu Row (~600 MB heap),
  // nên đo thời gian không bắt được; đếm số lần getRow thì chắc chắn.
  const worksheetProto = Object.getPrototypeOf(reloaded.worksheets[0]);
  const originalGetRow = worksheetProto.getRow;
  let getRowCalls = 0;
  worksheetProto.getRow = function (...args) {
    getRowCalls++;
    return originalGetRow.apply(this, args);
  };
  let rows;
  try {
    rows = await parseMemberImportFile(buffer, 10);
  } finally {
    worksheetProto.getRow = originalGetRow;
  }
  assert.deepEqual(rows, [
    { rowNumber: 2, fullName: 'Minh', email: 'minh@example.test', department: '', role: 'Learner' },
  ]);
  assert.ok(getRowCalls < 100, `getRow called ${getRowCalls} times`);
});

test('parser: TOO_MANY_ROWS still stops early inside eachRow, row numbers skip gaps', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Import');
  sheet.addRow(['Họ tên*', 'Email*', 'Đơn vị công tác', 'Vai trò*']);
  sheet.getRow(3).values = ['A', 'a@example.test', '', 'Learner'];
  sheet.getRow(10).values = ['B', 'b@example.test', '', 'Learner'];
  sheet.getRow(20).values = ['C', 'c@example.test', '', 'Learner'];
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const rows = await parseMemberImportFile(buffer, 3);
  assert.deepEqual(rows.map((row) => row.rowNumber), [3, 10, 20]);
  await assert.rejects(parseMemberImportFile(buffer, 2), (e) => {
    const body = e.getResponse();
    return body.code === 'TOO_MANY_ROWS' && body.maxRows === 2;
  });
});
