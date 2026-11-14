import { expect, it } from "vitest";
import { formatMinutes } from "./helper";

it.each([
  [null, "-"],
  [45, "45 phút"],
  [60, "1 giờ"],
  [90, "1 giờ 30 phút"],
] as const)("formats %s minutes as %s", (minutes, expected) => {
  expect(formatMinutes(minutes)).toBe(expected);
});
