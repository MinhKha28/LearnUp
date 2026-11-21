import { builtinEnvironments, type Environment } from "vitest/environments";

// Keep native abort globals compatible with Node fetch: https://github.com/vitest-dev/vitest/issues/8374; remove when Vitest >= 4.
const environment: Environment = {
  name: "jsdom-native",
  transformMode: "web",
  async setup(global, options) {
    const NativeAbortController = global.AbortController as typeof AbortController;
    const NativeAbortSignal = global.AbortSignal as typeof AbortSignal;
    const jsdomEnvironment = await builtinEnvironments.jsdom.setup(global, options);
    const window = global.jsdom.window as {
      AbortController: typeof AbortController;
      AbortSignal: typeof AbortSignal;
      EventTarget: typeof EventTarget;
    };
    const JsdomAbortController = window.AbortController;
    const JsdomAbortSignal = window.AbortSignal;
    const prototype = window.EventTarget.prototype;
    const originalAddEventListener = prototype.addEventListener;
    const controllers = new WeakMap<AbortSignal, AbortController>();
    const removeAbortListeners = new Set<() => void>();

    function getDomSignal(signal: AbortSignal): AbortSignal {
      const existing = controllers.get(signal);
      if (existing) return existing.signal;

      const controller = new JsdomAbortController();
      controllers.set(signal, controller);
      if (signal.aborted) {
        controller.abort(signal.reason);
        return controller.signal;
      }

      const removeListener = () => signal.removeEventListener("abort", onAbort);
      function onAbort() {
        controller.abort(signal.reason);
        removeAbortListeners.delete(removeListener);
      }
      signal.addEventListener("abort", onAbort, { once: true });
      removeAbortListeners.add(removeListener);
      return controller.signal;
    }

    prototype.addEventListener = function (type, listener, options) {
      if (typeof options === "object" && options?.signal && !(options.signal instanceof JsdomAbortSignal)) {
        return originalAddEventListener.call(this, type, listener, {
          ...options,
          signal: getDomSignal(options.signal),
        });
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    global.AbortController = NativeAbortController;
    global.AbortSignal = NativeAbortSignal;

    return {
      async teardown(global) {
        prototype.addEventListener = originalAddEventListener;
        for (const removeListener of removeAbortListeners) removeListener();
        removeAbortListeners.clear();
        await jsdomEnvironment.teardown(global);
      },
    };
  },
};

export default environment;
