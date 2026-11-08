import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatFileSize,
  gradingStatusView,
  interventionLabel,
  personName,
  reviewerRoleLabel,
  reviewStatusView,
} from "./submission.labels";

describe("the labels of the submission screens", () => {
  it("every grading status has a Vietnamese label and a tone; an unknown one is shown as it is", () => {
    expect(gradingStatusView("AwaitingPeerReview")).toEqual({
      label: "Đang chấm chéo",
      tone: "info",
    });
    expect(gradingStatusView("AwaitingInstructor")).toEqual({
      label: "Chờ bạn chấm",
      tone: "warning",
    });
    expect(gradingStatusView("AwaitingFinalization")).toEqual({
      label: "Chờ chốt điểm",
      tone: "info",
    });
    expect(gradingStatusView("Finalized")).toEqual({
      label: "Đã chốt điểm",
      tone: "success",
    });
    expect(gradingStatusView("Pending").label).toBe("Chưa xử lý");
    expect(gradingStatusView("Something").label).toBe("Something");
  });

  it("every reason for intervention the server writes has a Vietnamese text", () => {
    for (const reason of [
      "PEER_REVIEW_DISABLED",
      "NOT_ENOUGH_SUBMISSIONS",
      "REVIEWER_MISSED_DEADLINE",
      "REVIEW_MISSED",
      "REVIEWER_DEACTIVATED",
      "SCORE_GAP_EXCEEDED",
      "RESUBMITTED_AFTER_CUTOFF",
    ]) {
      const text = interventionLabel(reason);
      expect(text).toBeTruthy();
      expect(text).not.toBe(reason);
      expect(text).toMatch(
        /[ạảãàáâấầẩẫăắằẳẵặẹẻẽèéêếềểễệỉĩịọỏõòóôốồổỗộơớờởỡợụủũùúưứừửữựỳỷỹýđ]|Assignment|Không/i,
      );
    }
    expect(interventionLabel(null)).toBeNull();
    expect(interventionLabel("NEW_REASON")).toBe("NEW_REASON");
  });

  it("a review has a state and a role in Vietnamese", () => {
    expect(reviewStatusView("Completed")).toEqual({
      label: "Đã chấm",
      tone: "success",
    });
    expect(reviewStatusView("Pending").label).toBe("Chưa chấm");
    expect(reviewStatusView("Missed").label).toBe("Bỏ lỡ");
    expect(reviewStatusView("Waived").label).toBe("Được miễn");
    expect(reviewStatusView("Other").label).toBe("Other");
    expect(reviewerRoleLabel("Instructor")).toBe("Giảng viên");
    expect(reviewerRoleLabel("Learner")).toBe("Học viên");
    expect(reviewerRoleLabel("Robot")).toBe("Robot");
  });

  it("a person without a name is a short code, never an empty text", () => {
    expect(
      personName({
        id: "00000000-0000-4000-8000-0000000000ab",
        fullName: null,
        email: null,
        status: null,
      }),
    ).toBe("Learner 00AB");
    expect(
      personName({
        id: "x",
        fullName: "Nguyễn Văn A",
        email: null,
        status: null,
      }),
    ).toBe("Nguyễn Văn A");
  });

  it("dates are in the Vietnamese order (day/month/year), and a missing one is a dash", () => {
    expect(formatDateTime("2026-10-12T08:30:00.000Z")).toMatch(/12\/10\/2026/);
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime(undefined)).toBe("-");
  });

  it("file sizes", () => {
    expect(formatFileSize(null)).toBe("");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3 * 1024 ** 2)).toBe("3 MB");
  });
});
