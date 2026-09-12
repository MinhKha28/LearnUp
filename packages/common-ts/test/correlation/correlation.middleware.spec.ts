import { CorrelationMiddleware } from '../../src/correlation/correlation.middleware';
import { HeaderConstants } from '../../src/context/header.constants';

describe('CorrelationMiddleware', () => {
  let middleware: CorrelationMiddleware;

  beforeEach(() => {
    middleware = new CorrelationMiddleware();
  });

  it('should preserve incoming correlation ID', () => {
    const req: Record<string, unknown> = {
      headers: {
        [HeaderConstants.X_CORRELATION_ID]: 'corr-existing-123',
      },
    };
    const setHeaderMock = jest.fn();
    const res = { setHeader: setHeaderMock };
    const nextMock = jest.fn();

    middleware.use(req as never, res as never, nextMock);

    expect((req.headers as Record<string, string>)[HeaderConstants.X_CORRELATION_ID]).toBe(
      'corr-existing-123',
    );
    expect(setHeaderMock).toHaveBeenCalledWith(
      HeaderConstants.X_CORRELATION_ID,
      'corr-existing-123',
    );
    expect(nextMock).toHaveBeenCalled();
  });

  it('should generate new correlation ID if absent', () => {
    const req: Record<string, unknown> = {
      headers: {},
    };
    const setHeaderMock = jest.fn();
    const res = { setHeader: setHeaderMock };
    const nextMock = jest.fn();

    middleware.use(req as never, res as never, nextMock);

    const generated = (req.headers as Record<string, string>)[HeaderConstants.X_CORRELATION_ID];
    expect(generated).toBeDefined();
    expect(setHeaderMock).toHaveBeenCalledWith(HeaderConstants.X_CORRELATION_ID, generated);
    expect(nextMock).toHaveBeenCalled();
  });
});
