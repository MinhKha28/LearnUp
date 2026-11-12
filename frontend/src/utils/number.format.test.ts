import { describe, expect, it } from "vitest";
import { formatStorage, formatFileSize } from "./helper";
import { formatNumberVN, formatPercentageVN } from "./number.format";

describe("Vietnamese number format", () => {
  it("uses a decimal comma and can keep a fixed number of decimals", () => {
    expect(formatNumberVN(75.5)).toBe("75,5");
    expect(formatNumberVN(4.4, 1, 1)).toBe("4,4");
    expect(formatNumberVN(4, 1, 1)).toBe("4,0");
    expect(formatNumberVN(1234.5)).toBe("1.234,5");
    expect(formatPercentageVN(75.5)).toBe("75,5%");
  });

  it("shows sizes with a decimal comma", () => {
    expect(formatStorage(50 * 1024 ** 3)).toBe("50 GB");
    expect(formatStorage(1.5 * 1024 ** 3)).toBe("1,5 GB");
    expect(formatFileSize(1.5 * 1024 ** 2)).toBe("1,5 MB");
    expect(formatFileSize(2048)).toBe("2 KB");
  });
});
