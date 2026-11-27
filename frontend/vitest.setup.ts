// Các test định dạng hạn giả định giờ máy là GMT+7
process.env.TZ = "Asia/Ho_Chi_Minh";

import { vi } from "vitest";

// jsdom exposes transition properties but never dispatches animation completion events.
vi.mock("rc-motion/lib/util/motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("rc-motion/lib/util/motion") & {
    default: typeof import("rc-motion/lib/util/motion");
  }>();
  // Ant Design's CommonJS dependencies share this export object through require().
  actual.default.supportTransition = false;
  return { ...actual, supportTransition: false };
});

// Evaluate the mock before Ant Design loads its CommonJS motion consumers.
await import("rc-motion/lib/util/motion");
