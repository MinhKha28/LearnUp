import { expect, it } from "vitest";
import { QUIZ_PASSING_SCORE_RULE, TIME_LIMIT_RULE, validateNumber } from "./validation";

it.each([
  [null, TIME_LIMIT_RULE, "Nhập một số."],
  [Number.NaN, TIME_LIMIT_RULE, "Nhập một số hợp lệ."],
  [1.5, TIME_LIMIT_RULE, "Nhập số nguyên."],
  [2.125, QUIZ_PASSING_SCORE_RULE, "Nhập tối đa 2 chữ số thập phân."],
  [0, TIME_LIMIT_RULE, "Nhập số từ 1 trở lên."],
  [1441, TIME_LIMIT_RULE, "Nhập số không vượt quá 1440."],
  [1440, TIME_LIMIT_RULE, null],
  [null, {}, null],
] as const)("validates %s using Vietnamese feedback", (value, rule, message) => {
  expect(validateNumber(value, rule)).toBe(message);
});
