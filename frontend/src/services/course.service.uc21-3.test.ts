import { beforeEach, describe, expect, it, vi } from "vitest";
import { courseAxios } from "@/services/axios.customize";
import { approveCourseAPI, rejectCourseAPI, fetchOrganizationCoursesAPI } from "./course.service";

vi.mock("@/services/axios.customize", () => ({
  courseAxios: { post: vi.fn(), get: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("UC21.3 Course approval API", () => {
  it("posts approval to the Course Gateway with an encoded Course ID", async () => {
    vi.mocked(courseAxios.post).mockResolvedValue({ statusCode: 200 });
    await approveCourseAPI("abc/def");
    expect(courseAxios.post).toHaveBeenCalledWith("/api/v1/courses/abc%2Fdef/approve");
  });

  it("posts rejection with the reason as JSON", async () => {
    vi.mocked(courseAxios.post).mockResolvedValue({ statusCode: 200 });
    await rejectCourseAPI("course-id", { reason: "Revise rubric" });
    expect(courseAxios.post).toHaveBeenCalledWith(
      "/api/v1/courses/course-id/reject",
      { reason: "Revise rubric" },
    );
  });

  it("queries only Submitted Courses for Pending Approval", async () => {
    vi.mocked(courseAxios.get).mockResolvedValue({ statusCode: 200 });
    await fetchOrganizationCoursesAPI({ current: 2, pageSize: 10, status: "Submitted" });
    expect(courseAxios.get).toHaveBeenCalledWith("/api/v1/courses/organization", {
      params: { current: 2, pageSize: 10, status: "Submitted" },
    });
  });
});
