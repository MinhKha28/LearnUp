// UC12.8 / UC13.8 - Kiểm từng dòng của tệp import (BR-34) và đọc tệp .xlsx. Không cần Postgres.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ExcelJS = require('exceljs');
const {
  checkImportRows,
  emailsToLookUp,
  previewDigestOf,
  splitImportRows,
} = require('../dist/src/modules/member-imports/member-import.validator');
const {
  assertXlsxFile,
  parseMemberImportFile,
} = require('../dist/src/modules/member-imports/member-import.parser');

let nextRow = 2;
const raw = (values = {}) => ({
  rowNumber: nextRow++,
  fullName: 'Trần Văn Minh',
  email: `minh${nextRow}@example.test`,
  department: 'Phòng Kỹ thuật',
  role: 'Instructor',
  ...values,
});
const codes = (row) => row.errors.map((error) => `${error.field}:${error.code}`);
const check = (rows, role = 'Instructor') => checkImportRows(rows, role);

test('a valid row is normalized like UC12.2 (NFC, trim, lower-case, spaces collapsed)', () => {
  const [row] = check([
    raw({
      fullName: '  Trần   Văn  Minh ',
      email: '  Minh.Tran@ABC.VN ',
      department: '   ',
      role: ' instructor ',
    }),
  ]);
  assert.deepEqual(row.errors, []);
  assert.equal(row.normalized.fullName, 'Trần Văn Minh');
  assert.equal(row.normalized.email, 'minh.tran@abc.vn');
  assert.equal(row.normalized.department, null);
});

test('BR-34: each missing required field gives MISSING_REQUIRED_FIELD only', () => {
  const [noName, noEmail, noRole, onlyDepartmentMissing] = check([
    raw({ fullName: '   ' }),
    raw({ email: '' }),
    raw({ role: ' ' }),
    raw({ department: '' }),
  ]);
  assert.deepEqual(codes(noName), ['fullName:MISSING_REQUIRED_FIELD']);
  assert.deepEqual(codes(noEmail), ['email:MISSING_REQUIRED_FIELD']);
  assert.deepEqual(codes(noRole), ['role:MISSING_REQUIRED_FIELD']);
  assert.deepEqual(codes(onlyDepartmentMissing), [], 'department is optional');
});

test('BR-34: invalid email', () => {
  for (const email of ['not-an-email', 'a@', '@b.vn', 'a b@c.vn']) {
    const [row] = check([raw({ email })]);
    assert.deepEqual(codes(row), ['email:INVALID_EMAIL'], email);
  }
});

test('BR-34: invalid role, depending on the import role', () => {
  const [learnerInInstructorFile, organizer] = check([
    raw({ role: 'Learner' }),
    raw({ role: 'Organizer' }),
  ]);
  assert.deepEqual(codes(learnerInInstructorFile), ['role:INVALID_ROLE']);
  assert.deepEqual(codes(organizer), ['role:INVALID_ROLE']);

  const [learner, instructorInLearnerFile] = check(
    [raw({ role: 'LEARNER' }), raw({ role: 'Instructor' })],
    'Learner',
  );
  assert.deepEqual(codes(learner), []);
  assert.deepEqual(codes(instructorInLearnerFile), ['role:INVALID_ROLE']);
});

test('BR-34: field rules of CreateAccountDto give INVALID_VALUE', () => {
  const [longName, angle, longDepartment] = check([
    raw({ fullName: 'x'.repeat(101) }),
    raw({ fullName: '<b>Minh</b>' }),
    raw({ department: 'd'.repeat(101) }),
  ]);
  assert.deepEqual(codes(longName), ['fullName:INVALID_VALUE']);
  assert.deepEqual(codes(angle), ['fullName:INVALID_VALUE']);
  assert.deepEqual(codes(longDepartment), ['department:INVALID_VALUE']);
});

test('two errors on one row are both reported', () => {
  const [row] = check([raw({ fullName: '', email: 'bad', role: 'Learner' })]);
  assert.deepEqual(codes(row), [
    'fullName:MISSING_REQUIRED_FIELD',
    'email:INVALID_EMAIL',
    'role:INVALID_ROLE',
  ]);
});

test('duplicates in the file are found after NFC + trim + lower-case, every row of the group is marked', () => {
  const composed = 'nguyễn@example.test'; // "ễ" một ký tự
  const decomposed = 'nguyễn@example.test'; // "e" + dấu mũ + dấu ngã
  assert.notEqual(composed, decomposed);
  const rows = check([
    raw({ rowNumber: 2, email: 'An@Example.Test' }),
    raw({ rowNumber: 3, email: '  an@example.test ' }),
    raw({ rowNumber: 4, email: 'AN@EXAMPLE.TEST' }),
    raw({ rowNumber: 5, email: composed }),
    raw({ rowNumber: 6, email: decomposed }),
    raw({ rowNumber: 7, email: 'unique@example.test' }),
  ]);
  const duplicate = (row) =>
    row.errors.find((error) => error.code === 'DUPLICATE_EMAIL_IN_FILE');

  assert.deepEqual(duplicate(rows[0]).relatedRows, [3, 4]);
  assert.deepEqual(duplicate(rows[1]).relatedRows, [2, 4]);
  assert.deepEqual(duplicate(rows[2]).relatedRows, [2, 3]);
  assert.equal(rows[3].normalized.email, rows[4].normalized.email);
  assert.deepEqual(duplicate(rows[3]).relatedRows, [6]);
  assert.deepEqual(duplicate(rows[4]).relatedRows, [5]);
  assert.deepEqual(codes(rows[5]), []);
});

test('a row whose email is invalid is not counted as a duplicate', () => {
  const rows = check([
    raw({ email: 'same@example.test' }),
    raw({ email: 'SAME@example.test', fullName: '' }),
    raw({ email: 'same@@example.test' }),
  ]);
  // Dòng 2 lỗi họ tên nhưng email hợp lệ: vẫn trùng với dòng 1.
  assert.deepEqual(codes(rows[0]), ['email:DUPLICATE_EMAIL_IN_FILE']);
  assert.deepEqual(codes(rows[1]), [
    'fullName:MISSING_REQUIRED_FIELD',
    'email:DUPLICATE_EMAIL_IN_FILE',
  ]);
  assert.deepEqual(codes(rows[2]), ['email:INVALID_EMAIL']);
});

test('BR-34/BR-39: an email used by a non-deleted account is EMAIL_ALREADY_USED; only clean emails are looked up', () => {
  const rows = check([
    raw({ rowNumber: 10, email: 'Taken@Example.Test' }),
    raw({ rowNumber: 11, email: 'free@example.test' }),
    raw({ rowNumber: 12, email: 'broken' }),
    raw({ rowNumber: 13, email: 'dup@example.test' }),
    raw({ rowNumber: 14, email: 'dup@example.test' }),
  ]);
  assert.deepEqual(emailsToLookUp(rows).sort(), [
    'free@example.test',
    'taken@example.test',
  ]);

  const { validRows, invalidRows } = splitImportRows(
    rows,
    new Set(['taken@example.test']),
  );
  assert.deepEqual(
    validRows.map((row) => row.rowNumber),
    [11],
  );
  assert.deepEqual(
    invalidRows.map((row) => [row.rowNumber, row.errors.map((e) => e.code)]),
    [
      [10, ['EMAIL_ALREADY_USED']],
      [12, ['INVALID_EMAIL']],
      [13, ['DUPLICATE_EMAIL_IN_FILE']],
      [14, ['DUPLICATE_EMAIL_IN_FILE']],
    ],
  );
  // Dòng lỗi trả lại giá trị thô để Organizer sửa tệp.
  assert.equal(invalidRows[0].values.email, 'Taken@Example.Test');
  assert.equal(invalidRows[0].values.rowNumber, undefined);
  // splitImportRows không sửa mảng lỗi của dòng đã kiểm (preview và confirm gọi lại được).
  assert.deepEqual(rows[0].errors, []);
});

test('previewDigest depends on role and on every stored value of the valid rows', () => {
  const rows = [
    { rowNumber: 2, fullName: 'A', email: 'a@example.test', department: null },
  ];
  const digest = previewDigestOf('Instructor', rows);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(previewDigestOf('Instructor', structuredClone(rows)), digest);
  assert.notEqual(previewDigestOf('Learner', rows), digest);
  for (const change of [
    { rowNumber: 3 },
    { fullName: 'B' },
    { email: 'b@example.test' },
    { department: 'D' },
  ]) {
    assert.notEqual(
      previewDigestOf('Instructor', [{ ...rows[0], ...change }]),
      digest,
      JSON.stringify(change),
    );
  }
  assert.notEqual(previewDigestOf('Instructor', []), digest);
});

async function xlsx(rows, header = ['Họ tên*', 'Email*', 'Đơn vị công tác', 'Vai trò*']) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Import');
  sheet.addRow(header);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('parser: reads by header name, skips blank rows, keeps Excel row numbers', async () => {
  const buffer = await xlsx(
    [
      ['minh@example.test', 'Instructor', 'Minh'],
      [],
      ['', '', ''],
      ['lan@example.test', 'Instructor', 'Lan'],
    ],
    ['E-mail', 'Role', 'Full name'],
  );
  assert.doesNotThrow(() => assertXlsxFile('danh-sach.XLSX', buffer));
  const rows = await parseMemberImportFile(buffer, 10);
  assert.deepEqual(rows, [
    { rowNumber: 2, fullName: 'Minh', email: 'minh@example.test', department: '', role: 'Instructor' },
    { rowNumber: 5, fullName: 'Lan', email: 'lan@example.test', department: '', role: 'Instructor' },
  ]);
});

test('parser: rejects a renamed file, a missing column, too many rows and an empty file', async () => {
  const csv = Buffer.from('Họ tên,Email,Vai trò\nA,a@example.test,Instructor\n');
  assert.throws(() => assertXlsxFile('list.csv', csv), (e) => e.getResponse().code === 'INVALID_IMPORT_FILE');
  assert.throws(() => assertXlsxFile('list.xlsx', csv), (e) => e.getResponse().code === 'INVALID_IMPORT_FILE');
  const good = await xlsx([['A', 'a@example.test', '', 'Instructor']]);
  assert.throws(() => assertXlsxFile('list.xls', good), (e) => e.getResponse().code === 'INVALID_IMPORT_FILE');

  const corrupt = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);
  await assert.rejects(parseMemberImportFile(corrupt, 10), (e) => e.getResponse().code === 'INVALID_IMPORT_FILE');

  const noRole = await xlsx([['A', 'a@example.test']], ['Họ tên', 'Email']);
  await assert.rejects(parseMemberImportFile(noRole, 10), (e) => {
    const body = e.getResponse();
    return body.code === 'INVALID_IMPORT_TEMPLATE' && body.missingColumns.join() === 'Vai trò';
  });

  const three = await xlsx([1, 2, 3].map((n) => [`U${n}`, `u${n}@example.test`, '', 'Instructor']));
  assert.equal((await parseMemberImportFile(three, 3)).length, 3);
  await assert.rejects(parseMemberImportFile(three, 2), (e) => e.getResponse().code === 'TOO_MANY_ROWS');

  const empty = await xlsx([[], ['', '']]);
  await assert.rejects(parseMemberImportFile(empty, 10), (e) => e.getResponse().code === 'EMPTY_IMPORT_FILE');
});
