import { isAxiosError } from 'axios';

interface UpstreamErrorBody {
  code?: unknown;
  error?: { code?: unknown };
}

export function logHttpClientError(
  error: unknown,
  method: string,
  path: string,
): void {
  const response = isAxiosError<UpstreamErrorBody>(error)
    ? error.response
    : undefined;
  const status = response?.status;
  const code = response?.data?.error?.code ?? response?.data?.code;
  const name = error instanceof Error ? error.name : 'Error';

  console.error(
    JSON.stringify({
      name: /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name) ? name : 'Error',
      status:
        typeof status === 'number' &&
        Number.isInteger(status) &&
        status >= 100 &&
        status <= 599
          ? status
          : undefined,
      code:
        typeof code === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(code)
          ? code
          : undefined,
      method,
      path: path.split(/[?#]/, 1)[0],
    }),
  );
}
