import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';
import { validationErrorMap } from './validationMessage';

/**
 * zodResolver with validationErrorMap, so issues without a vmsg() in the schema still produce a
 * "validation" i18n key. Use it for every form: useForm({ resolver: formResolver(schema) }).
 */
export const formResolver = <Schema extends z.ZodType<FieldValues, FieldValues>>(
  schema: Schema
): Resolver<z.input<Schema>, unknown, z.output<Schema>> =>
  zodResolver(schema, { error: validationErrorMap });
