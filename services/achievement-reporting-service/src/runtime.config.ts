/** Missing NODE_ENV is production-like, as with the fake-client guards. */
export function validateRuntimeConfig(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  if (environment.NODE_ENV === 'development' || environment.NODE_ENV === 'test')
    return environment;

  if (
    typeof environment.INTERNAL_SERVICE_KEY !== 'string' ||
    !environment.INTERNAL_SERVICE_KEY.trim()
  )
    throw new Error(
      'INTERNAL_SERVICE_KEY is required outside development/test',
    );

  try {
    if (typeof environment.DATABASE_URL !== 'string') throw new Error();
    const url = new URL(environment.DATABASE_URL);
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2 ||
      !decodeURIComponent(url.username).trim() ||
      !decodeURIComponent(url.password).trim()
    )
      throw new Error();
  } catch {
    // Never include a connection string or parser error in startup diagnostics.
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with explicit username and password outside development/test',
    );
  }

  return environment;
}
