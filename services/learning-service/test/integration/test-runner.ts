import { test as nodeTest } from 'node:test';
import { TEST_TIMEOUT_MS } from './deadlines';
export {
  after,
  before,
  beforeEach,
  afterEach,
  describe,
  mock,
} from 'node:test';

// --test-timeout also covers the enclosing test file. Set individual test budgets
// explicitly, while the CLI/parent enforce the separately measured suite cap.
export const test: typeof nodeTest = new Proxy(nodeTest, {
  apply(target, thisArg: unknown, args: unknown[]) {
    const [name, options, fn] = args;
    if (typeof options === 'function')
      return Reflect.apply(target, thisArg, [
        name,
        { timeout: TEST_TIMEOUT_MS },
        options,
      ]);
    return Reflect.apply(target, thisArg, [
      name,
      { timeout: TEST_TIMEOUT_MS, ...(options as object) },
      fn,
    ]);
  },
});
