import { describe, expect, it } from "vitest";

import { parsePageParam, resolvePageRedirect } from "@/utils/page.param";

describe("parsePageParam", () => {
  it("nhận số nguyên dương", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("12")).toBe(12);
    expect(parsePageParam(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([null, "", "0", "-1", "abc", "1.5", "1e20", "99999999999999999999", " 2", "2 ", "01", "+1", "0x10"])(
    "từ chối %j",
    (raw) => {
      expect(parsePageParam(raw)).toBeNull();
    },
  );
});

describe("resolvePageRedirect", () => {
  const meta = (current: number, pages: number, total: number) => ({ current, pageSize: 12, pages, total });

  it("không có dòng nào thì hiện trạng thái rỗng", () => {
    expect(resolvePageRedirect(meta(1, 0, 0), 0)).toBe("empty");
    expect(resolvePageRedirect(meta(5, 0, 0), 0)).toBe("empty");
  });

  it("trang vượt tổng thì về trang cuối", () => {
    expect(resolvePageRedirect(meta(3, 2, 13), 0)).toBe(2);
    expect(resolvePageRedirect(meta(Number.MAX_SAFE_INTEGER, 1, 1), 0)).toBe(1);
  });

  it("trang hợp lệ thì giữ nguyên", () => {
    expect(resolvePageRedirect(meta(1, 1, 2), 2)).toBeNull();
    expect(resolvePageRedirect(meta(2, 2, 13), 1)).toBeNull();
  });
});
