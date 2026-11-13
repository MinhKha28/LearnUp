import { describe, expect, it } from "vitest";
import { formatFileSize as formatListSize } from "@/utils/helper";
import { formatFileSize as formatSubmissionSize } from "@/utils/submission.labels";

describe("file size display contracts", () => {
  it.each([
    [0, "1 KB", ""],
    [512, "1 KB", "0,5 KB"],
    [1536, "2 KB", "1,5 KB"],
    [1572864, "1,5 MB", "1,5 MB"],
  ])("preserves the list and submission formats for %d bytes", (bytes, list, submission) => {
    expect(formatListSize(bytes)).toBe(list);
    expect(formatSubmissionSize(bytes)).toBe(submission);
  });

  it("omits the size when a submission has no file size", () => {
    expect(formatSubmissionSize()).toBe("");
    expect(formatSubmissionSize(null)).toBe("");
  });
});
