/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL dùng chung cho các service chưa có biến riêng (identity, learner: catalog/learning). */
  readonly VITE_BACKEND_URL: string;
  /** tenant-service (8084): gói, đăng ký Organization, Instructor/Learner, lời mời. */
  readonly VITE_TENANT_BACKEND_URL: string;
  /** course-service (8083): Course, cấu trúc Course (instructor, organizer). */
  readonly VITE_COURSE_BACKEND_URL: string;
  /** assessment-service (8086): Assignment, Quiz, Peer Review. */
  readonly VITE_ASSESSMENT_BACKEND_URL: string;
  /** Dev: bật proxy danh tính cho learner (D37). "1" = bật. */
  readonly VITE_DEV_IDENTITY_PROXY?: string;
  /** Dev: id user giả gửi kèm header x-dev-user-id tới tenant-service. */
  readonly VITE_DEV_FAKE_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
