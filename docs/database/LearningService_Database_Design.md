# Thiết kế database learning-service (`learning_db`)

Trạng thái: thiết kế nền **10 bảng**; UC27.2 đã bổ sung migration `20261022000000_video_resume_position` (chi tiết mục 3.3 và 7).
Các dẫn chiếu UC27.2 dùng số mới: BR-140 (cũ BR-307), BR-184 (cũ BR-309), BR-182 (cũ BR-339), BR-181 (cũ BR-299). Những tham chiếu khác vẫn theo bản thiết kế lịch sử, chưa chuyển đổi toàn bộ số BR.

Nguồn nghiệp vụ: `LearnUP_QuyTacNghiepVu.docx` (đến BR-336), `LearnUP_UseCase.docx` (167 UC), `LearnUP_Service_Architecture.docx`.
Quy ước chung: `Database_Conventions.md` (mục 6B là phần learning-service cung cấp). Sơ đồ: `claude/learning_db.dbml`.
Đồng bộ nền trước UC27.2, sau khi thiết kế achievement-reporting-service: chốt payload `EnrollmentCompleted`, hai REST báo cáo, thêm chỉ mục `ix_enrollments_org_period` (BR-329, đã dựng thử). Không thêm bảng hay cột.
Mọi CHECK, khóa ngoại kép, chỉ mục có điều kiện, phép gộp `int4multirange` và `range_agg` đã được dựng thử trên PostgreSQL 16 (dùng hàm giả thay `uuidv7()`); 11 trường hợp dữ liệu sai đều bị chặn đúng ràng buộc.

---

## 1. Áp dụng quy ước

Áp dụng nguyên quy ước chung. Ba chỗ đáng chú ý:

| Chỗ | Quyết định | Lý do |
|---|---|---|
| Khóa chính của bảng bản sao | ID gốc của service sở hữu, không có mặc định (`course_version_snapshots`, `material_snapshots`, `lesson_snapshots`, `organization_suspensions`, `learner_accounts`) | Một đối tượng một ID trên toàn hệ thống. Đã bổ sung vào quy ước mục 1 |
| Trạng thái Overdue | Không lưu, tính lúc đọc | Quy ước mục 4: chỉ lưu trạng thái khi chuyển trạng thái phải chép tham số hoặc phát event; Overdue không làm điều nào. Kéo theo bỏ việc chạy theo lịch của learning-service (kiến trúc mục 7) |
| Chịu event trùng | Không có bảng mã event đã xử lý | Mọi handler dùng một trong ba cách: khóa duy nhất + `ON CONFLICT DO NOTHING`; cột `…_as_of`; quy tắc "không quay lui" (quy ước mục 5) |

### 1.1 Truy vấn không lọc theo `organization_id`

| Repository method | Bảng | Căn cứ |
|---|---|---|
| `OutboxRepository.findUnpublishedAcrossOrganizations` | `outbox_events` | Relay chạy chung mọi tổ chức (quy ước mục 5) |
| `OutboxRepository.deletePublishedOlderThanAcrossOrganizations` | `outbox_events` | Xóa dòng đã gửi quá 7 ngày |

`platform_settings` không thuộc phạm vi tổ chức nên không tính là ngoại lệ. Mọi event nhận vào và mọi lời gọi REST từ service khác đều mang `organizationId`.

### 1.2 Giới hạn

| Ô nhập hoặc tham số | API | DB | Loại căn cứ |
|---|---|---|---|
| Lý do đánh dấu Miễn (bắt buộc, BR-271) | ≤ 1000 ký tự, NFC, cắt khoảng trắng, còn ≥ 1 ký tự, cho phép xuống dòng | `varchar(1000)` | 3 |
| Lý do kéo dài hạn (không bắt buộc) | ≤ 1000 ký tự | Không lưu; đi theo event sang audit-service | 3 |
| Hạn mới khi kéo dài | Sau `due_at` hiện tại | `bigint` giây | Nghiệp vụ (BR-140); 4 |
| Số Learner mỗi lần phân công (UC24.2) | ≤ 500 | — | 3, đã bổ sung vào quy ước mục 2. Xét nâng lên 1000 sau thử thực nghiệm |
| Số khoảng trong một heartbeat video | 0–20; rỗng khi chỉ báo vị trí | — | Hợp đồng UC27.2 hiện tại |
| Giây trong khoảng video | API nhận số hữu hạn ≥ 0, đầu < cuối; làm tròn đầu lên, cuối xuống và cắt về thời lượng | `int4multirange` nguyên | BR-181 |
| Chu kỳ heartbeat | 15 giây, gửi thêm lần cuối khi đóng trang | — | Cấu hình kỹ thuật, không phải tham số nghiệp vụ |
| `expected_completion_days` | Không có ô nhập ở đây; nhận từ course-service | 1–365 | 3 |

---

## 2. Danh sách bảng

| # | Bảng | Giữ gì | Căn cứ chính | GĐ |
|---|---|---|---|---|
| 1 | `enrollments` | Một Learner trên một phiên bản Course: loại, 6 trạng thái lưu, các thành phần của hạn, ảnh chụp tham số, hoàn thành | BR-108, BR-112–BR-143, BR-213, BR-298–BR-308 | 1 (cột và giá trị Withdrawn do Learner rút: 2) |
| 2 | `enrollment_status_intervals` | Mỗi lần ở Exempted hoặc Halted một dòng: nguồn gốc và căn cứ dời hạn | BR-120–BR-125, BR-249, BR-250, BR-271 | 2 |
| 3 | `material_progress` | Tiến độ một Enrollment trên một học liệu: khoảng video đã xem, thời điểm hoàn thành | BR-148, BR-149, BR-243, BR-181, BR-184 | 1 |
| 4 | `course_version_snapshots` | Bản sao phiên bản Course: chuỗi, trạng thái vô hiệu hóa | Mục 6A quy ước; BR-249, BR-250 | 1 (cột vô hiệu hóa: 2) |
| 5 | `material_snapshots` | Bản sao học liệu: Lesson, loại, cờ bắt buộc, thời lượng, vô hiệu hóa | BR-146, BR-147, BR-243, BR-286 | 1 (cột vô hiệu hóa: 2) |
| 6 | `lesson_snapshots` | Cờ vô hiệu hóa Lesson, bảng thưa | BR-239, BR-243, BR-244 | 2 |
| 7 | `organization_suspensions` | Các lần tổ chức bị tạm khóa | BR-46, BR-47, BR-144, BR-311 | 2 |
| 8 | `learner_accounts` | Tài khoản bị vô hiệu hóa hoặc đã xóa, bảng thưa | BR-37, BR-38, BR-144, BR-304 | 1 |
| 9 | `platform_settings` | Bản sao `video_completion_percent` | BR-148, BR-269 | 1 |
| 10 | `outbox_events` | Event gửi lên Kafka | Quy ước mục 5 | 1 |

learning-service **không có** bảng Quiz, Attempt, Submission, Grade, Peer Review (assessment-service), Certificate (achievement-reporting-service) hay danh mục Course (course-service). UC28.1 không có bảng: learning-service kiểm Enrollment thuộc đúng Learner rồi hỏi assessment-service.

---

## 3. Chi tiết từng bảng

Ký hiệu: **B** = `NOT NULL`. Mọi bảng có `created_at`, `updated_at` theo quy ước.

### 3.1 `enrollments`

| Cột | Kiểu | B | Mặc định | Ghi chú, căn cứ |
|---|---|---|---|---|
| `id` | uuid | ✓ | `uuidv7()` | — |
| `organization_id` | uuid | ✓ | — | Khóa ngoại kép `(course_id, organization_id)` → `course_version_snapshots` |
| `learner_id` | uuid | ✓ | — | `user_id` do tenant-service sinh |
| `course_id` | uuid | ✓ | — | ID một phiên bản (BR-108, BR-213) |
| `enrollment_type` | text | ✓ | — | Required / Optional (BR-112) |
| `status` | text | ✓ | `'NotStarted'` | NotStarted / InProgress / Completed / Exempted / Withdrawn / Halted. **Không lưu Overdue** |
| `enrolled_at` | timestamptz | ✓ | `now()` | Lúc tạo; giữ nguyên khi chuyển Optional → Required |
| `assigned_at` | timestamptz | | — | Lúc phân công hoặc lúc chuyển Optional → Required (BR-134) |
| `expected_completion_days` | integer | | — | **Ảnh chụp** từ course-service (BR-84, BR-136). 1–365 |
| `base_due_at` | timestamptz | | — | Hạn gốc theo BR-300: 00:00 ngày kế tiếp ngày thứ N, múi giờ tổ chức lúc phân công |
| `extension_seconds` | bigint | ✓ | 0 | Tổng thời gian Organizer đã kéo dài (UC24.3, BR-140) |
| `due_at` | timestamptz | | — | Hạn hiện hành, tính lại từ đầu (mục 3.1.2) |
| `video_completion_percent` | integer | ✓ | — | **Ảnh chụp** `platform_settings` lúc tạo (BR-181, BR-269) |
| `first_activity_at` | timestamptz | | — | Với UC27.2, chỉ gán khi học liệu vừa hoàn thành (BR-140), không gán khi chỉ lưu coverage/bookmark. Các nguồn khác theo luồng thiết kế bên dưới |
| `completed_at` | timestamptz | | — | — |
| `completed_late` | boolean | | — | **Chốt lúc hoàn thành** (BR-143, BR-215). NULL với Optional; khi phát `EnrollmentCompleted` gửi `COALESCE(completed_late, false)` |
| `withdrawn_at` | timestamptz | | — | — |
| `withdrawn_reason` | text | | — | LearnerWithdrew (BR-132, GĐ2) / AccountDeleted (BR-304, GĐ1) / HaltedClosed (BR-303, GĐ2) |

| Ràng buộc hoặc chỉ mục | Định nghĩa | Căn cứ |
|---|---|---|
| `ck_enrollments_type`, `ck_enrollments_status` | Giá trị hợp lệ | BR-112, BR-115 |
| `ck_enrollments_deadline` | Required ⇒ `assigned_at`, `expected_completion_days`, `base_due_at`, `due_at` đều có; Optional ⇒ cả bốn NULL và `extension_seconds = 0` | BR-129, BR-136, BR-138 |
| `ck_enrollments_days` | `expected_completion_days BETWEEN 1 AND 365` | Quy ước mục 2 |
| `ck_enrollments_due` | `extension_seconds >= 0 AND due_at >= base_due_at` | BR-140 |
| `ck_enrollments_video_pct` | 1–100 | — |
| `ck_enrollments_activity` | NotStarted ⇒ `first_activity_at` NULL; InProgress ⇒ có | BR-140 |
| `ck_enrollments_completed` | `(status = 'Completed') = (completed_at IS NOT NULL)` | — |
| `ck_enrollments_late` | `(completed_late IS NOT NULL) = (Completed AND Required)` | BR-143 |
| `ck_enrollments_exempted` | Exempted ⇒ Required | BR-120, BR-122 |
| `ck_enrollments_withdrawn` | Withdrawn ⇔ có `withdrawn_at` ⇔ có `withdrawn_reason` (3 giá trị) | BR-132, BR-303, BR-304 |
| UNIQUE `(learner_id, course_id)` | Một Enrollment mỗi phiên bản; UC26; báo cáo theo Learner | BR-298, BR-228 |
| UNIQUE `(id, organization_id)` | Khóa ngoại kép từ bảng con | Quy ước mục 4 |
| INDEX `(course_id, status)` | BR-75, BR-95, số Learner theo phiên bản, chuyển Halted hàng loạt | Mục 6A |
| INDEX `(organization_id, due_at)` WHERE `enrollment_type = 'Required'` | UC24, UC24.7, Overdue, tính lại hạn khi gỡ tạm khóa | BR-142, BR-47 |
| INDEX `(organization_id, enrollment_type, status)` | Báo cáo tổng quan (GĐ2) | BR-224–BR-227 |
| INDEX `ix_enrollments_org_period` `(organization_id, (COALESCE(assigned_at, enrolled_at)))` | Bộ lọc khoảng thời gian của hai REST báo cáo (GĐ2); truy vấn phải viết đúng biểu thức này mới dùng được chỉ mục | BR-329 |

Tầng Service ép: Completed không có đường ra (BR-116); `status` khớp dòng `enrollment_status_intervals` đang mở.

#### 3.1.1 Ba câu hỏi cho từng trạng thái (nguyên tắc 20.2)

Hàm **tính lại theo tiến độ** (BR-123, BR-250, BR-132, BR-305): chưa có `first_activity_at` → NotStarted; có → InProgress; học liệu bắt buộc còn hoạt động đã đủ và REST assessment-service trả đạt → Completed.

| Trạng thái | Ai đưa vào | Ai đưa ra → về đâu |
|---|---|---|
| NotStarted | Tạo Enrollment; hàm tính lại | Hệ thống (hoạt động đầu tiên) → InProgress; `CourseDisabled` → Halted; Organizer hủy phân công → xóa dòng; Learner rút → xóa dòng (BR-131); tài khoản bị xóa → Withdrawn |
| InProgress | Hệ thống; hàm tính lại | Hệ thống → Completed; Organizer → Exempted; `CourseDisabled` → Halted; Learner rút (Optional): có kết quả đánh giá → Withdrawn, chưa có → xóa dòng; tài khoản bị xóa → Withdrawn |
| Overdue (tính lúc đọc) | Thời gian qua `due_at` | Kéo dài hạn, dời hạn, đổi trạng thái → tự hết; các đường ra như trạng thái lưu bên dưới |
| Completed | Hệ thống | **Không có** (BR-116). Chỉ đổi loại Optional → Required và đặt `completed_late = false` (BR-135) |
| Exempted | Organizer, Required đã có dữ liệu học tập (BR-120) | Organizer gỡ → hàm tính lại, hoặc Halted nếu Course đang Disabled (BR-302); hệ thống → Completed (BR-301, đóng khoảng Exempted tại `completed_at`); tài khoản bị xóa → Withdrawn |
| Withdrawn | Learner (BR-132); hệ thống khi xóa tài khoản (BR-304); Organizer đóng Halted (BR-303) | Learner đăng ký lại hoặc Organizer phân công cùng phiên bản → hàm tính lại (BR-305). `AccountDeleted` và `HaltedClosed`: không có đường ra, có chủ đích |
| Halted | Hệ thống khi nhận `CourseDisabled`, từ NotStarted/InProgress; gỡ Exempted khi Course Disabled (BR-302) | Organizer khôi phục khi phiên bản Published trở lại → hàm tính lại (UC24.8, BR-250); Organizer đóng → Withdrawn (BR-303); tài khoản bị xóa → Withdrawn |

Chuyển Optional → Required được từ NotStarted, InProgress, Completed, Withdrawn; không xảy ra khi Halted vì Course đang Disabled (BR-70).

#### 3.1.2 Hạn hoàn thành

**`due_at = base_due_at + extension_seconds + |phần hợp các khoảng tạm dừng|`**

- Khoảng tạm dừng gồm: khoảng Exempted/Halted **đã đóng** (BR-124) và lần tạm khóa tổ chức **đã gỡ** (BR-46, BR-47, BR-311).
- Mỗi khoảng chỉ tính phần sau `assigned_at`. Phần hợp tính bằng `range_agg(tstzrange(...))` nên khoảng chồng nhau chỉ tính một lần (đã thử).
- Tính lại **từ đầu** khi: kéo dài hạn, đóng khoảng Exempted/Halted, nhận `OrganizationReinstated`, chuyển Optional → Required. Enrollment đã Completed hoặc Withdrawn không tính lại.
- **Kéo dài hạn:** hạn mới (cuối ngày theo múi giờ tổ chức hỏi REST lúc đó) trừ `due_at` hiện tại, cộng phần chênh vào `extension_seconds`. Lưu phần chênh để các lần tạm dừng sau vẫn cộng lên trên.

**Overdue khi đọc:** Required, `status IN ('NotStarted','InProgress')`, `due_at <= now()`, và không có lần tạm khóa tổ chức nào đang mở bắt đầu trước `due_at` (BR-144). `completed_late` dùng cùng quy tắc lúc hoàn thành.

**Thống kê quá hạn (BR-38, BR-144):** loại thêm Enrollment của tài khoản có `learner_accounts.deactivated_at` khác NULL. Exempted, Halted, Optional tự bị loại vì không thỏa điều kiện trên.

### 3.2 `enrollment_status_intervals` (GĐ2)

| Cột | Kiểu | B | Mặc định | Ghi chú |
|---|---|---|---|---|
| `id` | uuid | ✓ | `uuidv7()` | — |
| `organization_id` | uuid | ✓ | — | Khóa ngoại kép `(enrollment_id, organization_id)` → `enrollments`, ON DELETE CASCADE |
| `enrollment_id` | uuid | ✓ | — | như trên |
| `kind` | text | ✓ | — | Exempted / Halted |
| `started_at` | timestamptz | ✓ | — | Halted: thời điểm vô hiệu hóa lấy từ event, không phải lúc nhận |
| `ended_at` | timestamptz | | — | NULL = đang ở trạng thái này |
| `reason` | varchar(1000) | | — | Bắt buộc với Exempted (BR-271) |

| Ràng buộc hoặc chỉ mục | Định nghĩa |
|---|---|
| `ck_intervals_kind`, `ck_intervals_reason`, `ck_intervals_range` | Giá trị hợp lệ; lý do ⇔ Exempted; `ended_at >= started_at` |
| UNIQUE `(enrollment_id, kind, started_at)` | Event `CourseDisabled` trùng → `ON CONFLICT DO NOTHING` |
| UNIQUE `(enrollment_id)` WHERE `ended_at IS NULL` | Tối đa một khoảng đang mở |

Organizer đương nhiệm gỡ được Exempted do người tiền nhiệm đặt (BR-123), nên không lưu người đặt hay người gỡ; audit-service giữ người thực hiện (BR-270).

### 3.3 `material_progress`

| Cột | Kiểu | B | Mặc định | Ghi chú |
|---|---|---|---|---|
| `id` | uuid | ✓ | `uuidv7()` | — |
| `organization_id` | uuid | ✓ | — | Khóa ngoại kép → `enrollments` (CASCADE) và → `material_snapshots` |
| `enrollment_id` | uuid | ✓ | — | — |
| `material_id` | uuid | ✓ | — | — |
| `watched_ranges` | int4multirange | | — | Chỉ Video: các khoảng giây đã phát (BR-181) |
| `last_reported_at` | timestamptz | | NULL | Mốc ghi coverage; báo cáo chỉ vị trí không thay đổi cột này |
| `position_seconds` | integer | | NULL | Bookmark độc lập với coverage, không âm; kẹp về duration (BR-182) |
| `position_reported_at` | timestamptz | | NULL | Timestamp client; chỉ nhận bản mới hơn; quá server 60 giây thì dùng giờ server (BR-182) |
| `completed_at` | timestamptz | | — | Không bao giờ xóa (BR-184) |

| Ràng buộc hoặc chỉ mục | Định nghĩa | Căn cứ |
|---|---|---|
| `ck_progress_not_empty` | `watched_ranges IS NOT NULL OR completed_at IS NOT NULL` | Chỉ tạo dòng khi có dữ liệu |
| `ck_progress_ranges_lower` | `lower(watched_ranges) >= 0` (bỏ qua NULL, rỗng) | — |
| `ck_progress_position_nonnegative` | `position_seconds IS NULL OR position_seconds >= 0` | BR-182 |
| UNIQUE `(enrollment_id, material_id)` | UC27, UC27.1, UC28; xét hoàn thành; BR-119, BR-140 | — |
| INDEX `(material_id)` WHERE `completed_at IS NOT NULL` | BR-95 | Mục 6A |

**Đo video (BR-181):** trình duyệt gom các đoạn phát liền mạch thành `[giây đầu, giây cuối)`, tua thì đóng khoảng cũ mở khoảng mới; mỗi 15 giây gửi một heartbeat. Server cắt khoảng về `[0, duration_seconds)` rồi ghi bằng một câu lệnh:
`INSERT … ON CONFLICT (enrollment_id, material_id) DO UPDATE SET watched_ranges = material_progress.watched_ranges + EXCLUDED.watched_ranges`.
Database tự gộp khoảng chồng và khoảng liền kề (đã thử: `[0,12) + [12,30) + [20,45) + [80,95)` → `{[0,45),[80,95)}` = 60 giây). Hoàn thành khi tổng độ dài ≥ `⌈duration_seconds × video_completion_percent ÷ 100⌉`.

**BR-182/BR-184:** bookmark không tham gia tính hoàn thành, lưu cả khi học liệu hoặc Enrollment Completed. Enrollment Completed bỏ qua ranges, giữ coverage/completed_at và các timestamp coverage; vẫn ghi bookmark và trả 200. UPDATE bookmark có điều kiện `position_reported_at IS NULL OR position_reported_at < reportedAt`, trong cùng transaction với coverage. BR-140 chỉ chuyển NotStarted → InProgress khi học liệu vừa hoàn thành; lưu coverage chưa đủ ngưỡng hoặc chỉ lưu vị trí không kích hoạt Enrollment. BR-181 không đặt ngân sách/trần tốc độ.

**Tầng Service kiểm trước khi ghi:** học liệu thuộc đúng phiên bản của Enrollment; NotStarted, InProgress, Exempted được ghi coverage và bookmark, Completed chỉ ghi bookmark; học liệu, Lesson và phiên bản chưa bị vô hiệu hóa (BR-243); Reading không nhận heartbeat, Video không nhận đánh dấu thủ công.

**BR-95:** tập cần xét = học liệu bắt buộc còn hoạt động của Lesson; nếu rỗng thì mọi học liệu còn hoạt động (BR-306). Có Enrollment nào hoàn thành đủ tập đó không: gom dòng đã hoàn thành theo Enrollment, so số lượng.

### 3.4 `course_version_snapshots`

| Cột | Kiểu | B | Ghi chú |
|---|---|---|---|
| `course_id` | uuid | ✓ | PK = ID phiên bản bên course-service |
| `organization_id` | uuid | ✓ | — |
| `chain_id` | uuid | ✓ | Từ kết quả REST gắn Locked |
| `tree_fetched_at` | timestamptz | ✓ | — |
| `disabled_at` | timestamptz | | GĐ2. Có giá trị = Course Disabled |
| `disabled_as_of` | timestamptz | ✓ | GĐ2. Lần đầu = `asOf` của REST cây; sau đó = `occurredAt` của event |

Chỉ mục: UNIQUE `(course_id, organization_id)`.

### 3.5 `material_snapshots`

| Cột | Kiểu | B | Ghi chú |
|---|---|---|---|
| `material_id` | uuid | ✓ | PK = ID học liệu bên course-service |
| `organization_id`, `course_id` | uuid | ✓ | Khóa ngoại kép → `course_version_snapshots` |
| `lesson_id` | uuid | ✓ | ID logic |
| `material_type` | text | ✓ | Video / Reading |
| `is_required` | boolean | ✓ | BR-147; không đổi sau Locked (BR-90) |
| `duration_seconds` | integer | | Chỉ Video, > 0 |
| `duration_as_of` | timestamptz | | Bỏ qua `MaterialFileReplaced` cũ hơn |
| `disabled_at` | timestamptz | | GĐ2 |
| `disabled_as_of` | timestamptz | ✓ | GĐ2 |

Chỉ mục: UNIQUE `(material_id, organization_id)`; INDEX `(course_id, lesson_id)`.
CHECK: loại hợp lệ; `(material_type = 'Video') = (có duration_seconds và duration_as_of)`, `duration_seconds > 0`.

### 3.6 `lesson_snapshots` (GĐ2, bảng thưa)

| Cột | Kiểu | B | Ghi chú |
|---|---|---|---|
| `lesson_id` | uuid | ✓ | PK = ID Lesson bên course-service |
| `organization_id`, `course_id` | uuid | ✓ | Khóa ngoại kép → `course_version_snapshots` |
| `disabled_at` | timestamptz | | Loại mọi học liệu bên trong (BR-243) |
| `disabled_as_of` | timestamptz | ✓ | — |

Chỉ có dòng cho Lesson từng bị vô hiệu hóa. Không gộp cờ Lesson vào học liệu, vì học liệu bị vô hiệu hóa riêng phải giữ nguyên khi Lesson được kích hoạt lại.

**Học liệu còn hoạt động** ⇔ `material_snapshots.disabled_at IS NULL` và Lesson không có dòng hoặc `disabled_at IS NULL` và phiên bản `disabled_at IS NULL`.

### 3.7 `organization_suspensions` (GĐ2)

| Cột | Kiểu | B | Ghi chú |
|---|---|---|---|
| `id` | uuid | ✓ | PK = mã lần khóa bên tenant-service |
| `organization_id` | uuid | ✓ | — |
| `started_at` | timestamptz | ✓ | — |
| `ended_at` | timestamptz | | NULL = đang khóa. Ghi `COALESCE(mới, cũ)`: đã kết thúc thì không mở lại |

Chỉ mục: INDEX `(organization_id, started_at)`; UNIQUE `(organization_id)` WHERE `ended_at IS NULL`. CHECK `ended_at > started_at`.
Không cần `…_as_of` vì tenant-service dùng ID tổ chức làm key Kafka nên event cùng tổ chức đến đúng thứ tự. Không chép lý do khóa.

### 3.8 `learner_accounts` (bảng thưa)

| Cột | Kiểu | B | Ghi chú |
|---|---|---|---|
| `user_id` | uuid | ✓ | PK = `user_id` |
| `organization_id` | uuid | ✓ | — |
| `deactivated_at` | timestamptz | | Đang bị vô hiệu hóa |
| `deleted_at` | timestamptz | | Đã gán thì không xóa |
| `status_as_of` | timestamptz | ✓ | — |

Không có dòng = tài khoản bình thường. Không có khóa ngoại từ `enrollments.learner_id` vì bảng thưa. Chỉ giữ trạng thái hiện tại vì BR-38, BR-144 xét "đang bị vô hiệu hóa".

### 3.9 `platform_settings`

Một dòng (`CREATE UNIQUE INDEX … ON platform_settings ((true))`). Cột: `video_completion_percent` integer (CHECK 1–100, chép từ tenant-service), `source_as_of` timestamptz. Nhận `PlatformSettingsChanged`, bỏ qua event cũ hơn `source_as_of`; bảng trống lúc khởi động thì gọi REST.

### 3.10 `outbox_events`

Cấu trúc chuẩn ở quy ước mục 5. `aggregate_type` = `Enrollment`, `aggregate_id` = ID Enrollment (key Kafka), để event của một Enrollment đến đúng thứ tự.

---

## 4. Luồng chính

### 4.1 Tạo Enrollment (UC24.2 phân công, UC25.3 tự đăng ký)

1. Kiểm cục bộ: trùng Enrollment trên phiên bản (Optional/Withdrawn cùng phiên bản không phải lỗi, BR-308), tổng số ≤ 500.
2. REST tenant-service một lần theo lô: Learner đúng vai trò, cùng tổ chức, chưa bị vô hiệu hóa hoặc xóa (chưa kích hoạt vẫn được); trạng thái Subscription (ân hạn thì chặn, BR-15); múi giờ tổ chức (phân công).
3. Có lỗi thì chặn cả lần, trả danh sách lỗi (BR-308).
4. REST course-service gắn Locked: kiểm Published (BR-70), với tự đăng ký kiểm thêm Public (BR-62); nhận `chainId`, `expectedCompletionDays`.
5. Chưa có `course_version_snapshots` thì REST lấy cây.
6. **Một transaction:** ghi bản sao cây (nếu cần), ghi hoặc chuyển Enrollment, `EnrollmentAssigned` vào outbox.

**Gắn Locked thành công mà bước 6 thất bại:** Course bị Locked mà không có Enrollment. Kết quả học tập không sai, nhưng Instructor mất quyền sửa cấu trúc và không có đường gỡ (BR-83). Giảm rủi ro bằng cách kiểm mọi thứ ở bước 1–3 trước khi gọi, và thử lại cả thao tác (lời gọi gắn Locked chịu được gọi lại). Khoảng hở còn lại khi người dùng bỏ ngang được chấp nhận.

### 4.2 Hoàn thành

1. **Transaction 1:** ghi `completed_at` học liệu; nếu NotStarted thì gán `first_activity_at` và chuyển InProgress. Commit.
2. **Ngoài transaction:** nếu mọi học liệu bắt buộc còn hoạt động đã xong, REST assessment-service lấy điều kiện và bản chốt điểm. Không gọi mạng khi đang giữ khóa.
3. **Transaction 2:** `SELECT … FOR UPDATE` Enrollment, kiểm lại trạng thái, chuyển Completed, tính `completed_late`, ghi `EnrollmentCompleted` kèm bản chốt điểm vào outbox.

Các nguồn kích hoạt xét lại: học liệu hoàn thành; event assessment-service báo tình trạng thay đổi; `ContentDisabled` (BR-310, REST theo lô); gỡ Exempted; khôi phục Halted.

### 4.3 Rút khỏi Course tự chọn (UC25.4) và hủy phân công (UC24.4)

| Thao tác | Điều kiện hỏi assessment-service | Kết quả |
|---|---|---|
| Hủy phân công | Chưa có dữ liệu học tập: không học liệu hoàn thành (cục bộ), không lượt Quiz, không bài nộp (REST) — BR-119 | Xóa dòng; CASCADE xóa tiến độ và khoảng tạm dừng |
| Rút, chưa có kết quả đánh giá | Không lượt Quiz, không bài nộp, không chấm chéo (REST) — BR-131 | Xóa dòng (kể cả tiến độ học liệu) |
| Rút, đã có kết quả đánh giá | — | Withdrawn, `LearnerWithdrew`; giữ dữ liệu (BR-132) |

Việc rút không gỡ Locked (BR-83).

### 4.4 Event nhận vào

| Event | Nguồn | Xử lý |
|---|---|---|
| `CourseDisabled` | course | Chưa có bản sao thì bỏ qua. Mới hơn `disabled_as_of` thì ghi `disabled_at`, chuyển NotStarted/InProgress sang Halted với `started_at` = thời điểm vô hiệu hóa |
| `CourseReactivated` | course | Xóa `disabled_at`; không khôi phục Enrollment (BR-250) |
| `ContentDisabled`, `ContentReactivated` | course | Lesson/học liệu: cập nhật cờ. Quiz/Assignment: không lưu. Sau vô hiệu hóa: xét lại hoàn thành (BR-310). Completed giữ nguyên (BR-244) |
| `MaterialFileReplaced` | course | Cập nhật `duration_seconds` nếu mới hơn; học liệu đã hoàn thành giữ nguyên (BR-184) |
| Tình trạng Assessment của Learner đã đổi | assessment | Gán `first_activity_at` (LEAST), NotStarted → InProgress; xét lại hoàn thành |
| `OrganizationSuspended`, `OrganizationReinstated` | tenant | Ghi lần khóa (COALESCE); Reinstated → tính lại `due_at` (BR-47, BR-311) |
| `UserDeactivated`, `UserReactivated` | tenant | Cập nhật `learner_accounts` theo `status_as_of`; bỏ qua nếu đã xóa |
| `UserDeleted` | tenant | Gán `deleted_at`; Enrollment chưa Completed → Withdrawn `AccountDeleted`, đóng khoảng đang mở (BR-304) |
| `PlatformSettingsChanged` | tenant | Cập nhật theo `source_as_of` |

`SubscriptionStatusChanged` không dùng: trạng thái Subscription hỏi REST lúc tạo Enrollment.

---

## 5. Dữ liệu trao đổi với service khác

### 5.1 Ảnh chụp và dữ liệu nhận vào

| Dữ liệu | Cách lấy | Khi nào | Lý do |
|---|---|---|---|
| `expected_completion_days` | Chép từ kết quả REST gắn Locked | Phân công, chuyển Optional → Required | BR-84 |
| Múi giờ tổ chức | REST tenant-service, không lưu | Phân công, kéo dài hạn | BR-44 |
| `video_completion_percent` | Chép từ `platform_settings` | Tạo Enrollment | BR-269, BR-181 |
| `completed_late` | Tính | Chuyển Completed | BR-215, BR-219 |
| Cây chương trình (không tiêu đề) | REST course-service → bảng bản sao | Enrollment đầu tiên; gặp học liệu lạ | Mục 6A |
| Vô hiệu hóa Course, Lesson, học liệu | Event | Khi xảy ra | BR-243, BR-249 |
| Lần tạm khóa tổ chức; trạng thái tài khoản | Event | Khi xảy ra | BR-47, BR-38, BR-37 |
| Trạng thái Subscription; vai trò, tổ chức, trạng thái tài khoản của Learner được phân công | REST tenant-service, không chép | Tạo Enrollment | BR-15, BR-308 |
| Trạng thái kích hoạt tài khoản | REST tenant-service theo lô, không chép | Hiển thị UC24, UC24.1 (nhãn "Tài khoản chưa kích hoạt") | BR-308 |
| Điều kiện và điểm Quiz, Assignment | REST assessment-service | Xét hoàn thành; UC28.1 | BR-211, BR-212, BR-219 |
| Đã có lượt Quiz, bài nộp, chấm chéo | REST assessment-service | Hủy phân công, rút | BR-119, BR-131 |

### 5.2 Những gì learning-service cung cấp

Xem quy ước mục 6B.

### 5.3 Hợp đồng với course-service: đã chốt

1. REST gắn Locked trả `chainId`, `expectedCompletionDays`, `courseType`; nhận tham số "tự đăng ký" để kiểm Public (BR-62).
2. REST cây trả `disabledAt` cho Lesson và học liệu, `asOf` cho cả lần trả lời.
3. Payload event vô hiệu hóa mang trạng thái tuyệt đối: `organizationId`, `courseId`, loại và ID thành phần, `disabled`, `occurredAt`.
4. `MaterialFileReplaced` gửi thêm cho learning-service kèm `durationSeconds`.

Chi tiết ở `CourseService_Database_Design.md` mục 4.2, 4.3.

### 5.4 Hợp đồng với assessment-service: đã chốt

1. REST điều kiện Quiz/Assignment của một Learner trên một Course, kèm bản chốt điểm.
2. REST theo lô: ai trong danh sách đã đạt (BR-310).
3. REST: đã có lượt Quiz, bài nộp, chấm chéo chưa (BR-119, BR-131).
4. `LearnerAssessmentStatusChanged` (key `learnerId`), mang `firstActivityAt` (BR-140).
5. REST điểm các bài đã làm (UC28.1).
6. assessment-service hỏi REST `GET /api/v1/internal/enrollments/assessment-access` (L17, quy ước mục 6B) khi bắt đầu lượt Quiz và khi nộp bài; không nhận `EnrollmentCompleted` và không giữ bản sao Enrollment Completed (BR-169, BR-325; số mới BR-210, BR-211). Hợp đồng HTTP: `contracts/openapi/learning-service.yaml`.

Chi tiết ở quy ước mục 6C.

### 5.4A REST báo cáo cho achievement-reporting-service (GĐ2)

| REST | Vào | Ra |
|---|---|---|
| Báo cáo tổng hợp | `organizationId`; bộ lọc `courseIds`, loại Enrollment, `learnerIds` (≤ 500), khoảng thời gian (thời điểm tuyệt đối, lọc `COALESCE(assigned_at, enrolled_at)`, BR-329), tình trạng; `groupBy` ∈ {none, course} | Mỗi nhóm × loại Enrollment: `total`, `notStarted`, `inProgress`, `overdue`, `completedOnTime`, `completedLate`, `exempted`, `halted`, `withdrawn`, `distinctLearners` |
| Báo cáo danh sách | Cùng bộ lọc; con trỏ; `limit ≤ 100` | Mỗi Enrollment: `enrollmentId`, `learnerId`, `courseId`, `enrollmentType`, `status` (có Overdue), `progressPercent`, `dueAt`, `completedAt`, `completedLate`; `nextCursor` |

Quy tắc tính (phải khớp nhau để bên gọi kiểm tổng):
- Mỗi Enrollment rơi vào **đúng một** ô trạng thái: Overdue tách khỏi NotStarted/InProgress theo cùng điều kiện mục 3.1.2; Completed tách thành `completedOnTime` / `completedLate`. Tổng các ô bằng `total`.
- Enrollment Optional không có hạn: `overdue` và `completedLate` luôn 0, mọi Completed tính vào `completedOnTime`.
- Overdue loại tài khoản đang bị vô hiệu hóa (BR-38) và thời gian tổ chức bị tạm khóa (BR-144), như màn hình của learning-service; Enrollment bị loại khỏi Overdue vì BR-38 tính vào ô trạng thái lưu của nó.
- `progressPercent` tính giống tiến độ Learner thấy ở UC27 (trên thành phần còn hoạt động, BR-243).
- Danh sách phân trang theo con trỏ `id` (keyset), không dùng OFFSET.

### 5.5 Event phát ra (qua `outbox_events`)

| Event | Bên nhận | Căn cứ | GĐ |
|---|---|---|---|
| `EnrollmentAssigned` | notification | BR-118, UC24.2 | 1 |
| `EnrollmentDueDateExtended` (`previousDueAt`, `newDueAt`, `reason`, `actorId`, `occurredAt`) | notification, audit | UC24.3, BR-139, BR-270 | 1 |
| `EnrollmentCompleted`: `enrollmentId`, `organizationId`, `learnerId`, `courseId`, `completedAt`, `completedLate` (boolean; Optional gửi `false`), `scoreSnapshot` (mảng, nguyên văn kết quả REST điều kiện của assessment-service), `occurredAt`. Key Kafka = `enrollmentId` | achievement-reporting (Certificate, phiếu đánh giá) | BR-213, BR-215, BR-219, BR-326 | 1 |
| `EnrollmentExempted`, `ExemptionRemoved` | notification, audit | BR-120, BR-123, BR-270, BR-271 | 2 |
| `EnrollmentRestored`, `HaltedEnrollmentClosed` | notification | BR-250, BR-303, UC24.8 | 2 |
| `LearnerWithdrew` (`withdrawnAt`) | Chưa có bên nhận (notification không gửi, quyết định D2 23/10) | BR-132, UC25.4 | 2 |

Mọi event trên dùng chung topic `learnup.learning.enrollment-events` (key `enrollmentId`), envelope v1; hợp đồng chi tiết ở `contracts/events/learning-enrollment-events.md`.

---

## 6. Việc chạy theo lịch

| Việc | Căn cứ |
|---|---|
| Relay outbox (~1 giây), xóa dòng đã gửi sau 7 ngày | Quy ước mục 5 |

Không có việc nghiệp vụ nào: Overdue tính lúc đọc (kiến trúc mục 7 đã bỏ dòng Learning).

---

## 7. Những gì cố ý không làm

Cập nhật UC27.2 ngày 22/10/2026: vị trí xem dở đã được triển khai bằng `position_seconds` (integer nullable) và `position_reported_at` (timestamptz nullable), migration `20261022000000_video_resume_position`; không còn thuộc phần chưa làm. BR-182 quy định bookmark, BR-181 quy định coverage mọi tốc độ, BR-184 đóng băng coverage khi Enrollment Completed, BR-140 kích hoạt Enrollment khi học liệu vừa hoàn thành. Chi tiết cột và transaction ở mục 3.3.

| Không làm | Đánh đổi | Chi phí nếu cần lại |
|---|---|---|
| Lưu Overdue và việc chạy theo lịch | Không có thông báo "vừa quá hạn" | **Đập đi một phần**: mọi truy vấn suy ra Overdue phải sửa sang đọc cột |
| Bảng lịch sử kéo dài hạn | UC24.1 không hiện các lần kéo dài; lịch sử ở audit | Thêm bảng; lần cũ chỉ còn trong audit |
| `chain_id` trên `enrollments` | Truy vấn theo chuỗi phải join bản sao | Thêm cột, lấp từ bản sao |
| Cột người phân công, người đánh dấu, người gỡ; loại kết thúc khoảng | Xem ở audit | Thêm cột |
| Mốc từng lần chuyển trạng thái | Không quy tắc nào dùng | Thêm cột; dữ liệu cũ mất |
| Giới hạn trên khi kéo dài hạn | Không BR nào đặt | Kiểm ở API, rẻ |
| Bảng Lesson/Module đã hoàn thành | Suy ra từ `material_progress` | Thêm bảng, tính lại được |
| Cột số giây đã xem | Tính từ `watched_ranges` | Thêm cột, lấp bằng một câu SQL |
| Lịch sử từng vị trí video | Chỉ giữ bookmark mới nhất; position_seconds và position_reported_at đã có (BR-182) | Thêm bảng nếu cần lịch sử |
| Cách hoàn thành (tự động/thủ công) | Suy ra từ loại học liệu | Thêm cột |
| Chống gian lận heartbeat ở server | Gửi giả được | Thêm cột heartbeat cuối và logic kiểm |
| `course_id` + khóa ngoại ghép trên `material_progress` | Tầng Service kiểm học liệu thuộc phiên bản | Thêm cột, lấp, thêm UNIQUE ở `enrollments` |
| Lịch sử xem video | — | Thêm bảng |
| Tiêu đề, thứ tự, Module trong bản sao | UC27 cần course-service chạy | **Tốn**: course-service phải phát event đổi tiêu đề |
| Bản sao đủ mọi Lesson | Không liệt kê Lesson từ learning_db | Lấy lại cây mọi phiên bản |
| Bản sao Quiz, Assignment | assessment-service tự loại thành phần bị vô hiệu hóa | Thêm bảng |
| Trạng thái Published/Archived trong bản sao | REST gắn Locked kiểm mỗi lần | Thêm cột + event |
| Dò bản sao lệch định kỳ | Event bị sót thì lệch mà không biết | Thêm việc chạy theo lịch so cây |
| Bảng lưu bản chốt điểm | Bản chốt nằm trong Certificate | Thêm bảng; bản cũ không lấy lại được ở đây |
| Lý do tạm khóa tổ chức | — | Thêm cột |
| Lịch sử vô hiệu hóa tài khoản | Không trả lời "tại ngày X có bị vô hiệu hóa không" | Thêm bảng khoảng |
| Bản sao trạng thái Subscription | REST lúc tạo Enrollment | Thêm bảng + nhận event |
| Bảng mã event đã xử lý | Handler dùng khóa duy nhất, `…_as_of`, "không quay lui" | Thêm khi có handler buộc cộng dồn |

---

## 8. Quyết định nghiệp vụ phát sinh khi thiết kế

Đã ghi vào `LearnUP_QuyTacNghiepVu.docx`, `LearnUP_UseCase.docx` và `LearnUP_Service_Architecture.docx`.

| BR | Nội dung tóm tắt | Vị trí trong tài liệu |
|---|---|---|
| BR-298 | Một Enrollment mỗi phiên bản; học bản cũ vẫn được phân công bản mới; BR-133 chỉ áp cùng phiên bản | Mục 7.5, sau BR-133 |
| BR-181 | Đo video bằng tổng đoạn đã phát, không trùng, không tua, mọi tốc độ; tỉ lệ chép lúc tạo Enrollment | Mục 9, sau BR-148 |
| BR-300 | Hạn là cuối ngày thứ N theo múi giờ tổ chức lúc phân công | Mục 8.1, sau BR-136 |
| BR-301 | Exempted hoàn thành thì Completed ngay | Mục 7.2, sau BR-123 |
| BR-302 | "Đang dở" ở BR-249 = NotStarted, InProgress, Overdue; gỡ Exempted khi Disabled → Halted | Mục 17.3, sau BR-249 |
| BR-303 | Khôi phục Halted chỉ khi Published lại; bản bị thay thì đóng → Withdrawn; qua UC24.8 | Mục 17.3, sau BR-250 |
| BR-304 | Xóa tài khoản → Enrollment chưa Completed chuyển Withdrawn | Mục 2.5, sau BR-37 |
| BR-305 | Khôi phục tiến độ chỉ cùng phiên bản; phân công lại Withdrawn → Required | Mục 7.4, sau BR-132 |
| BR-306 | Lesson không có học liệu bắt buộc hoàn thành khi xong mọi học liệu | Mục 9, sau BR-150 |
| BR-140 | UC27.2 chỉ kích hoạt NotStarted → InProgress khi học liệu vừa hoàn thành, không phải khi chỉ lưu coverage/bookmark | Mục 7.1, sau BR-115 |
| BR-308 | Phân công hàng loạt: chặn cả lần khi có lỗi; tài khoản chưa kích hoạt vẫn được | Mục 7.2, sau BR-118 |
| BR-184 | Hoàn thành học liệu không đảo ngược | Mục 9, sau BR-149 |
| BR-310 | Vô hiệu hóa làm đủ điều kiện → Completed ngay | Mục 17.2, sau BR-243 |
| BR-311 | "Đang dở" ở BR-47 = mọi Required chưa Completed/Withdrawn | Mục 3, sau BR-47 |

Use Case: thêm **UC24.8 – Khôi phục Enrollment tạm dừng** (GĐ2, Organizer); tổng 168 UC, Phân công đào tạo 14 UC. Cập nhật ghi chú UC24.2, UC24.6, UC25.4, UC27.2, UC27.3, UC40 và khái niệm "Chưa phát sinh dữ liệu học tập".

Kiến trúc: mục 3.4 (nguồn kích hoạt xét hoàn thành; hạn và Overdue), mục 6.3 (phạm vi "đang dở", UC24.8), mục 6.4 (EnrollmentCompleted qua outbox + Kafka thay cho gọi REST), mục 7 (bỏ việc chạy theo lịch của Learning), mục 8 (Learning 19 UC, tổng 168; GĐ1 giữ 86).

---

## 9. Hướng dẫn bố trí sơ đồ ERD trên dbdiagram.io

dbdiagram lưu vị trí bảng trong sơ đồ trên web, **không** lưu trong file DBML. Mỗi lần dán lại DBML vào sơ đồ mới thì phải xếp lại, nên giữ một sơ đồ cố định cho mỗi service và chỉ cập nhật mã.

**Bố cục đề xuất** (mũi tên = khóa ngoại, chỉ đi ngang hoặc dọc, không cắt nhau):

```
 ┌ tenant_state (tím) ─────┐   ┌──────────── enrollment (xanh dương) ──────────┐   ┌ progress (xanh lá) ┐
 │ organization_suspensions│   │ enrollment_status_intervals ──►  enrollments   │◄──│ material_progress  │
 │ learner_accounts        │   └────────────────────────────────────┬───────────┘   └─────────┬──────────┘
 └─────────────────────────┘                                        ▼                         ▼
                                ┌──────────────── curriculum_snapshot (xanh ngọc) ─────────────────────────┐
                                │               course_version_snapshots  ◄────────  material_snapshots    │
                                │                         ▲                                                │
                                │                  lesson_snapshots                                        │
                                └──────────────────────────────────────────────────────────────────────────┘
 ┌ infrastructure (xám) ───┐
 │ platform_settings       │
 │ outbox_events           │
 └─────────────────────────┘
```

**Nguyên tắc:**
1. **Bảng trung tâm ở giữa.** `enrollments` là nơi mọi luồng đi qua; đặt ở giữa hàng trên, các bảng con (`enrollment_status_intervals`, `material_progress`) hai bên.
2. **Bảng cha nằm dưới bảng con.** Mũi tên khóa ngoại chỉ xuống dưới hoặc sang ngang về phía bảng được tham chiếu, nên người đọc đi từ nghiệp vụ (trên) xuống dữ liệu nền (dưới).
3. **Không để đường cắt nhau.** Nếu hai đường cắt, đổi chỗ hai bảng trong cùng nhóm trước khi dời cả nhóm.
4. **Bảng không có khóa ngoại để ở rìa**, tách hẳn khỏi phần có quan hệ: `tenant_state` bên trái (dữ liệu đi vào), `infrastructure` góc dưới trái.
5. **Một nhóm một màu, `headercolor` trùng màu nhóm.** Giữ màu thống nhất giữa các service: hạ tầng luôn xám `#6B7280`; bản sao dữ liệu của service khác dùng màu riêng để nhìn là biết không phải dữ liệu gốc.
6. **Gióng mép và khoảng cách đều.** Các bảng cùng hàng gióng mép trên; khoảng trống giữa các nhóm bằng nhau.
7. **Hai ảnh cho tài liệu:** một ảnh tổng quan chỉ hiện tên bảng và cột khóa (nếu dbdiagram của bạn có chế độ ẩn bớt cột), một ảnh chi tiết cho từng nhóm. Ảnh tổng quan dùng khi thuyết trình, ảnh chi tiết dùng khi code.
8. **CHECK và điều kiện chỉ mục nằm trong note** của bảng, không thể hiện trên hình; khi thuyết trình nhắc rằng chi tiết ràng buộc nằm trong tài liệu này.

---

## 10. Việc tiếp theo

- Sinh migration SQL theo yêu cầu riêng. Seed: một dòng `platform_settings` lấy từ tenant-service lúc khởi động.
- **Thử thực nghiệm giới hạn 500 Learner mỗi lần phân công; xét nâng lên 1000 nếu đạt** (đo thời gian transaction và kích thước request).
- UC24, UC24.1 hiển thị nhãn "Tài khoản chưa kích hoạt" (REST tenant-service theo lô).
- Hợp đồng với course-service, assessment-service, achievement-reporting-service: **đã chốt** (mục 5.3, 5.4, 5.4A, 5.5).
- **Topic `EnrollmentCompleted` giữ message 30 ngày** (cấu hình Kafka, mặc định 7 ngày). learning-service không lưu bản chốt điểm (mục 7), dòng outbox xóa sau 7 ngày, nên message trên Kafka là bản gốc duy nhất trước khi Certificate được tạo. Bên nhận bị sót (lỗi code, dừng lâu) khôi phục bằng cách **đặt lại offset** của consumer group về trước thời điểm sót rồi đọc lại; mọi bên nhận chịu trùng nên đọc lại an toàn. 30 ngày đủ rộng so với cảnh báo độ trễ consumer của achievement-reporting-service (1 giờ).
