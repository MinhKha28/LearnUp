const { createHash, randomUUID } = require('node:crypto');
const png = () =>
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=',
    'base64',
  );
const hash = (b) => createHash('sha256').update(b).digest('hex');
const file = (buffer = png()) => ({
  fieldname: 'signature',
  originalname: 'signature.png',
  mimetype: 'application/octet-stream',
  size: buffer.length,
  buffer,
});
const user = () => ({
  userId: randomUUID(),
  organizationId: randomUUID(),
  role: 'ORGANIZER',
  isAuthenticated: true,
});
const body = (signatureAction = 'keep') => ({
  signerName: 'Nguyễn Văn A',
  signerTitle: 'Director',
  signatureAction,
});
const setting = (overrides = {}) => ({
  organization_id: randomUUID(),
  signer_name: 'A',
  signer_title: 'Director',
  signature_asset_key: 'achievement/test/config',
  signature_hash: hash(png()),
  signature_mime: 'image/png',
  signature_size_bytes: png().length,
  version: 1,
  updated_at: new Date(),
  ...overrides,
});
module.exports = { png, hash, file, user, body, setting };
