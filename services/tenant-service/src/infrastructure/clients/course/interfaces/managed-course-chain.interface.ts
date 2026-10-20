/**
 * UC12.1: một chuỗi Course (course_chains) Instructor đang phụ trách, đại diện bằng phiên bản
 * hiện hành. BR-287: quyền phụ trách gắn với cả chuỗi. BR-336: phiên bản hiện hành là phiên bản
 * có ngày phê duyệt gần nhất (kể cả đang Disabled); chuỗi chưa từng được duyệt -> phiên bản mới nhất.
 */
export interface IManagedCourseChain {
  chainId: string;
  courseId: string; // id của phiên bản đại diện
  name: string;
  versionNumber: number;
  status: string; // Draft | Submitted | Published | Rejected | Disabled (không bao giờ Archived)
  courseType: string; // Public | Private
  approvedAt: Date | null; // published_at của phiên bản đại diện; null nếu chuỗi chưa từng được duyệt
}
