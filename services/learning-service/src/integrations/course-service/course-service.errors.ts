/** Lỗi gốc khi gọi course-service; các lớp con cho biết lớp trên cần xử lý thế nào. */
export class CourseServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Course (hoặc Lesson) không tồn tại với tổ chức này, hoặc Course không còn nhận Enrollment. */
export class CourseNotAvailableError extends CourseServiceError {
  constructor(
    /** Mã lỗi course-service trả về: COURSE_NOT_FOUND, COURSE_NOT_AVAILABLE, LESSON_NOT_FOUND. */
    readonly code: string | null,
    message: string,
  ) {
    super(message);
  }
}

/** course-service không trả lời kịp, lỗi mạng hoặc lỗi 5xx. */
export class CourseServiceUnavailableError extends CourseServiceError {}

/** course-service từ chối khóa nội bộ hoặc user context (401, 403): sai cấu hình giữa hai service. */
export class CourseServiceConfigurationError extends CourseServiceError {}

/** Response không đúng hợp đồng đã chốt (D16); dữ liệu không được trả cho lớp trên. */
export class CourseServiceContractError extends CourseServiceError {
  constructor(
    readonly endpoint: string,
    readonly field: string,
    reason: string,
  ) {
    super(`${endpoint}: ${field} ${reason}`);
  }
}
