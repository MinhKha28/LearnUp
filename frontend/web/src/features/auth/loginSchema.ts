import { z } from 'zod';
import { vmsg } from '@/lib/form';

/**
 * UC05 sign-in form. The field is labelled "Email" but is sent as `username`, which the backend
 * matches against username or email — so there is no email-format check.
 */
export const loginSchema = z.object({
  // TODO(spec): backend xác nhận có bỏ đăng nhập bằng username (chỉ nhận email) không
  username: z.string().trim().min(1),
  // Sent as typed (no trim); a whitespace-only password counts as empty.
  password: z.string().refine((value) => value.trim().length > 0, vmsg('required')),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
