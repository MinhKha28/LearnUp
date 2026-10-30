const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isIanaTimezone } = require('../dist/src/common/utils/timezone.util');
const {
  detectLogoType,
} = require('../dist/src/modules/organizations/organizations.service');

test('TN3: IANA zone names are accepted', () => {
  for (const zone of [
    'Asia/Ho_Chi_Minh',
    'Asia/Tokyo',
    'Europe/Kyiv',
    'America/Argentina/Buenos_Aires',
    'America/Port-au-Prince',
    'Etc/GMT-7',
    'UTC',
  ]) {
    assert.equal(isIanaTimezone(zone), true, zone);
  }
});

test('TN3: names Intl tolerates but that are not IANA names are rejected', () => {
  for (const zone of [
    '+07:00',
    'UTC+7',
    'EST',
    'asia/tokyo',
    'Asia/Hanoi',
    'Asia/',
    '/Tokyo',
    '',
    ' Asia/Tokyo',
    null,
    7,
  ]) {
    assert.equal(isIanaTimezone(zone), false, String(zone));
  }
});

test('#148: PNG and JPEG are detected from the file signature', () => {
  assert.equal(
    detectLogoType(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
    ),
    'image/png',
  );
  assert.equal(
    detectLogoType(Buffer.from([0xff, 0xd8, 0xff, 0xdb])),
    'image/jpeg',
  );
});

test('#148: WebP, GIF, SVG, truncated or empty files are not logos', () => {
  for (const buffer of [
    Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]),
    Buffer.from('GIF89a'),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    Buffer.from([0xff, 0xd8]),
    Buffer.alloc(0),
  ]) {
    assert.equal(detectLogoType(buffer), null);
  }
});
