import { describe, expect, it } from "vitest";
import {
  exceededLimitLines,
  renewalErrorMessage,
  renewalTermNote,
} from "./renewal.view";

describe("UC10.1 renewal view", () => {
  it("BR-4: lists each limit below current usage, storage in GB", () => {
    expect(
      exceededLimitLines([
        { limit: "learners", used: 120, newLimit: 100 },
        {
          limit: "storageBytes",
          used: 60 * 1024 ** 3,
          newLimit: 50 * 1024 ** 3,
        },
      ]),
    ).toEqual([
      "Số học viên: đang dùng 120, giới hạn mới 100",
      "Dung lượng lưu trữ: đang dùng 60 GB, giới hạn mới 50 GB",
    ]);
    expect(exceededLimitLines([])).toEqual([]);
  });

  it("explains when the new term starts for each status", () => {
    expect(renewalTermNote("Active")).toContain("khi kỳ hiện tại hết hạn");
    expect(renewalTermNote("Grace")).toContain("ngày hết hạn cũ");
    expect(renewalTermNote("Suspended")).toContain("ngày thanh toán");
  });

  it("maps backend errors without raw codes", () => {
    expect(renewalErrorMessage("RENEWAL_ALREADY_SCHEDULED")).toContain(
      "được thanh toán",
    );
    expect(renewalErrorMessage("SOMETHING_NEW")).not.toContain("SOMETHING_NEW");
    expect(renewalErrorMessage(undefined)).toContain("thử lại sau");
    expect(renewalErrorMessage("RENEWAL_NOT_APPLIED")).toContain(
      "Đừng thanh toán lần nữa",
    );
  });
});
