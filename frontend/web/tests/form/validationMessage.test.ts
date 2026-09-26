import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { decodeValidationMessage, formResolver, vmsg } from '@/lib/form';

const schema = z.object({
  email: z.email(),
  name: z.string().min(1),
  password: z.string().min(8),
  note: z.string().max(5),
  custom: z.string().min(3, vmsg('passwordsDoNotMatch')),
});
type Values = z.input<typeof schema>;

const resolve = (values: Partial<Values>) =>
  formResolver(schema)(values as Values, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  });

describe('vmsg / decodeValidationMessage', () => {
  it('keeps a key without values as the plain key', () => {
    expect(vmsg('required')).toBe('required');
    expect(decodeValidationMessage('required')).toEqual({ key: 'required' });
  });

  it('round-trips interpolation values', () => {
    expect(decodeValidationMessage(vmsg('tooShort', { min: 8 }))).toEqual({
      key: 'tooShort',
      values: { min: 8 },
    });
  });

  it('keeps the key when the values part is not valid JSON', () => {
    expect(decodeValidationMessage('tooShort|{oops')).toEqual({ key: 'tooShort' });
  });
});

describe('formResolver', () => {
  it('turns zod issues into "validation" keys with their values', async () => {
    const { errors } = await resolve({
      email: 'not-an-email',
      name: '',
      password: 'short',
      note: 'too long',
      custom: 'ok',
    });

    expect(errors.email?.message).toBe('email');
    expect(errors.name?.message).toBe('required');
    expect(decodeValidationMessage(String(errors.password?.message))).toEqual({
      key: 'tooShort',
      values: { min: 8 },
    });
    expect(decodeValidationMessage(String(errors.note?.message))).toEqual({
      key: 'tooLong',
      values: { max: 5 },
    });
  });

  it('keeps a message written in the schema', async () => {
    const { errors } = await resolve({ custom: 'ok' });
    expect(errors.custom?.message).toBe('passwordsDoNotMatch');
  });

  it('reports a missing value as required', async () => {
    const { errors } = await resolve({});
    expect(errors.name?.message).toBe('required');
    expect(errors.email?.message).toBe('required');
  });

  it('returns the parsed values when the input is valid', async () => {
    const valid: Values = {
      email: 'a@b.vn',
      name: 'An',
      password: '12345678',
      note: 'hi',
      custom: 'abc',
    };
    const result = await resolve(valid);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual(valid);
  });
});
