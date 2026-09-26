import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { http, HttpResponse } from 'msw';
import { createErrorResponse } from '@learnup/ts-common';
import { apiClient } from '@/services/apiClient';
import { Alert, Button, TextField } from '@/components/ui';
import { applyServerFieldErrors, formResolver, useFieldErrorText, vmsg } from '@/lib/form';
import { i18n } from '@/i18n';
import { server } from '@/mocks/node';

afterEach(cleanup);

// A form written the way AGENTS.md asks: schema + formResolver + useFieldErrorText + server errors
const demoSchema = z.object({
  email: z.email(),
  password: z.string().min(8, vmsg('tooShort', { min: 8 })),
});
type DemoValues = z.infer<typeof demoSchema>;

const DemoForm: React.FC = () => {
  const errorText = useFieldErrorText();
  const [alert, setAlert] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DemoValues>({
    resolver: formResolver(demoSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: DemoValues) => {
    setAlert(null);
    try {
      await apiClient.post('/api/demo', values);
    } catch (err) {
      setAlert(applyServerFieldErrors(err, setError, ['email', 'password']));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {alert && <Alert tone="danger">{alert}</Alert>}
      <TextField label="Email" {...register('email')} error={errorText(errors.email)} />
      <TextField
        label="Password"
        type="password"
        {...register('password')}
        error={errorText(errors.password)}
      />
      <Button type="submit">Submit</Button>
    </form>
  );
};

describe('form helpers with TextField', () => {
  it('shows translated client-side errors and marks the fields invalid', async () => {
    const user = userEvent.setup();
    render(<DemoForm />);

    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Vui lòng nhập địa chỉ email hợp lệ.')).toBeDefined();
    expect(screen.getByText('Cần ít nhất 8 ký tự.')).toBeDefined();
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
  });

  it('follows the UI language', async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage('en');
    render(<DemoForm />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Enter at least 8 characters.')).toBeDefined();
  });

  it('shows server field errors on the field and the rest in the Alert (via MSW)', async () => {
    server.use(
      http.post('*/api/demo', () =>
        HttpResponse.json(
          createErrorResponse('VALIDATION_ERROR', 'Request validation failed', [
            'email: Email is already registered',
            'plan: Plan is closed',
          ]),
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    render(<DemoForm />);

    await user.type(screen.getByLabelText('Email'), 'an@congty.vn');
    await user.type(screen.getByLabelText('Password'), '12345678');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Email is already registered')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('Thông tin chưa hợp lệ');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Email')));
  });
});
