import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import environment from "./jsdom.native.environment";
import config from "../vitest.config";

it("accepts a navigation signal in a native Request and forwards cancellation", async () => {
  const NativeAbortController = AbortController;
  const scope = await environment.setup(globalThis, {});
  const controller = new NativeAbortController();
  let navigationSignal: AbortSignal | undefined;
  const router = createMemoryRouter([
    { path: "/" },
    { path: "/next", loader: ({ request }) => {
      navigationSignal = request.signal;
      return null;
    } },
  ]);
  try {
    const request = new Request("http://localhost/", { signal: controller.signal });
    controller.abort("cancelled");
    expect(request.signal.aborted).toBe(true);
    expect(request.signal.reason).toBe("cancelled");
    await router.navigate("/next");
    expect(navigationSignal).toBeInstanceOf(AbortSignal);
    expect(() => new Request("http://localhost/next", { signal: navigationSignal })).not.toThrow();
  } finally {
    router.dispose();
    await scope.teardown(globalThis);
  }
});

it("removes DOM listeners on native signal abort and handles an already aborted signal", async () => {
  const NativeAbortController = AbortController;
  const scope = await environment.setup(globalThis, {});
  try {
    const controller = new NativeAbortController();
    const target = new EventTarget();
    const listener = vi.fn();
    target.addEventListener("change", listener, { signal: controller.signal });
    target.dispatchEvent(new Event("change"));
    expect(listener).toHaveBeenCalledTimes(1);
    controller.abort();
    target.dispatchEvent(new Event("change"));
    expect(listener).toHaveBeenCalledTimes(1);
    target.addEventListener("change", listener, { signal: controller.signal });
    target.dispatchEvent(new Event("change"));
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    await scope.teardown(globalThis);
  }
});

it("restores globals and removes the DOM bridge on teardown", async () => {
  const originalController = AbortController;
  const originalSignal = AbortSignal;
  const originalTarget = EventTarget;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const scope = await environment.setup(globalThis, {});
  const domPrototype = EventTarget.prototype;
  const patchedAddEventListener = domPrototype.addEventListener;
  try {
    expect(AbortController).toBe(originalController);
    expect(AbortSignal).toBe(originalSignal);
    expect(EventTarget).not.toBe(originalTarget);
  } finally {
    await scope.teardown(globalThis);
  }
  expect(AbortController).toBe(originalController);
  expect(AbortSignal).toBe(originalSignal);
  expect(EventTarget).toBe(originalTarget);
  expect(Object.getOwnPropertyDescriptor(globalThis, "window")).toEqual(originalWindow);
  expect(domPrototype.addEventListener).not.toBe(patchedAddEventListener);
});

it("requires the native environment for every jsdom test", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const plainJsdomFiles: string[] = [];
  for (const directory of ["src", "dev"]) {
    for (const file of readdirSync(join(root, directory), { recursive: true, encoding: "utf8" })) {
      if (!/\.test\.[jt]sx?$/.test(file)) continue;
      const relativePath = join(directory, file);
      const code = readFileSync(join(root, relativePath), "utf8");
      const selected = code.match(/@(?:vitest|jest)-environment\s+([\w-]+)\b/)?.[1];
      if (selected === "jsdom") plainJsdomFiles.push(relativePath);
    }
  }
  expect(plainJsdomFiles).toEqual([]);
  expect(config.test?.environment).not.toBe("jsdom");
});
