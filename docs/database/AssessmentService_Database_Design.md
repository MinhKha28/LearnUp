# Thiết kế database assessment-service (`assessment_db`)

Trạng thái: **14 bảng** trên `develop` sau migration `20261025000000_drop_completed_enrollments` (bản đầu `20260930084438_assessment` tạo 15 bảng, trong đó `completed_enrollments` đã bị bỏ).
Tài liệu mô tả đúng những gì có trên `develop`. Phần chỉ có ở PR UC33 (chốt chu kỳ chấm chéo, chạy theo lịch) ghi rõ là **đang chờ merge** ở mục 6 và trong các ô "Giá trị".
Nhãn BR dùng số mới của bộ quy tắc v1.5 (`LearnUP_Business_Rules.docx`); mỗi số trích đều đã đối chiếu nội dung với bộ quy tắc, không lấy từ chú thích trong code (chú thích trong code còn lẫn số cũ và số mới).

Nguồn: `services/assessment-service/prisma/schema.prisma`, hai file migration, và code trong `src/modules`. Những điều chưa kiểm chứng hoặc chưa quyết định ghi ở mục 7, 8 và 10, không suy đoán.
Hai điểm cần biết ngay:
- **Migration không có ràng buộc `CHECK` nào.** Mọi giá trị trạng thái (`kind`, `grading_status`, `status`…) là chuỗi tự do ở DB; chỉ tầng ứng dụng giữ tập giá trị (mục 3 và 7).
- **`id` và `updated_at` không có giá trị mặc định ở DB**; Prisma sinh UUID v7 và `updated_at` ở tầng ứng dụng. Chèn tay bằng SQL phải tự điền hai cột này (các test tích hợp làm đúng như vậy).

---

## 1. Áp dụng quy ước

| Chỗ | Thực tế trên `develop` |
|---|---|
| Khóa chính | `uuid`, sinh UUID v7 ở ứng dụng (`@default(uuid(7))`), không có `DEFAULT` ở DB. Ngoại lệ: `learner_accounts.user_id` là ID gốc từ service khác, không sinh ở đây |
| `organization_id` | Có ở mọi bảng, `uuid NOT NULL`, **không có khóa ngoại** (tổ chức thuộc tenant-service) |
| Thời gian | `timestamptz`. `created_at` có `DEFAULT CURRENT_TIMESTAMP`; `updated_at` do ứng dụng điền |
| Điểm | `numeric(5,2)` (điểm Quiz, điểm Assignment, điểm đạt) |
| Xóa | Xóa Assessment kéo theo con bằng `ON DELETE CASCADE` (mục 3). Hai khóa ngoại dùng `RESTRICT` (`quiz_attempt_answers.question_id`, `submission_review_scores.criterion_id`) và một dùng `SET NULL` (`submission_reviews.cycle_id`) |
| Khóa chặn tương tranh | Ba khóa tư vấn `pg_advisory_xact_lock(hashtext(...))`: theo Course (UC19.2, mục 4.1), theo `{assessmentId}:{learnerId}` và theo `cycle:{assessmentId}` (UC30, mục 4.2). Chấm của Instructor dùng khóa dòng `SELECT … FOR UPDATE` trên bài nộp (UC32, mục 4.4) |

### 1.1 Truy vấn không lọc theo `organization_id`

Chưa rà toàn bộ truy vấn của repository để lập danh sách ngoại lệ như tài liệu learning-service. Các truy vấn đã đọc khi viết tài liệu này đều lọc theo `organization_id` (hoặc theo `assessment_id` của một Assessment đã lọc theo tổ chức). Việc rà đầy đủ ghi ở mục 10.

### 1.2 Giới hạn

| Ô nhập | Giới hạn ở DB | Ghi chú |
|---|---|---|
| Tiêu đề Assessment | `varchar(200)` | |
| Đề bài Assignment | `varchar(8000)` | Cần đề bài chữ hoặc một file đề (UC19.2) |
| File đề bài | Một file PDF, tối đa 50 MB (`PROMPT_FILE_MAX_BYTES`); tên `varchar(255)`, MIME `varchar(255)`, kích thước `bigint` | Lưu ở kho ngoài, DB chỉ giữ `prompt_file_key` |
| Câu hỏi Quiz | `varchar(2000)` | |
| Đáp án Quiz | `varchar(500)` | |
| Tên và mô tả tiêu chí Rubric | `varchar(200)` và `varchar(500)` | |
| Điểm tối đa của tiêu chí | `smallint` | |
| Nội dung bài nộp | `varchar(20000)` (`SUBMISSION_CONTENT_MAX_LENGTH`) | |
| File bài nộp | PDF, DOCX hoặc ZIP, một file, tối đa 50 MB (`SUBMISSION_FILE_MAX_BYTES`), kiểm cả chữ ký đầu file | Thư mục kho: `learnup/{organizationId}/assignments/{assessmentId}/submissions` |
| Nhận xét của người chấm | `varchar(2000)` | Dùng cho chấm chéo và chấm của Instructor |
| Nhận xét khi chốt điểm | `varchar(2000)` | `finalization_comment` |
| Số người đánh giá mỗi bài | `smallint` | |

---

## 2. Danh sách bảng

Cột "Có code ghi" cho biết trên `develop` đã có chỗ nào ghi vào bảng. "Chưa" nghĩa là bảng đã có trong schema nhưng chưa có luồng nào dùng.

| # | Bảng | Giữ gì | Căn cứ chính | Có code ghi |
|---|---|---|---|---|
| 1 | `assessments` | Một Quiz hoặc Assignment của một phiên bản Course: cấu hình, đề bài, chấm chéo | BR-206, BR-207, BR-217, BR-224, BR-227 | Có (UC18 tạo Quiz, UC19 Assignment) |
| 2 | `quiz_questions` | Câu hỏi của Quiz | | **Chưa** (UC18.1 chỉ đọc) |
| 3 | `quiz_question_options` | Đáp án của câu hỏi, có cờ đúng | | **Chưa** |
| 4 | `rubric_criteria` | Tiêu chí chấm của Assignment | | Có (UC19.2) |
| 5 | `learner_assessment_states` | Mỗi Learner trên mỗi Assessment: số lượt liên tiếp, khóa tạm, nghĩa vụ chấm chéo | BR-217, BR-218, BR-221, BR-239, BR-241 | Có (UC30, UC30.1) |
| 6 | `quiz_attempts` | Một lượt làm Quiz | BR-198, BR-200, BR-211 | **Chưa** (UC29.1 chưa làm; chỉ đọc) |
| 7 | `quiz_attempt_answers` | Đáp án Learner đã chọn trong một lượt | | **Chưa** (chỉ xóa khi xóa Quiz) |
| 8 | `submissions` | Bài nộp Assignment: nội dung, file, chu kỳ, trạng thái chấm, điểm chốt | BR-208, BR-209, BR-210, BR-212, BR-213 | Có (UC30, UC30.1) |
| 9 | `peer_review_cycles` | Một chu kỳ chấm chéo của một Assignment | BR-208, BR-229, BR-230, BR-335 | Có, chỉ **tạo chu kỳ `Open`** khi có bài nộp (UC30). Chốt, nhắc, hết hạn: đang chờ UC33 |
| 10 | `submission_reviews` | Một lượt đánh giá của một người cho một bài nộp | BR-236, BR-237, BR-242, BR-243, BR-248, BR-249, BR-252 | Có, chỉ **chấm của Instructor** (UC32). Chấm chéo: sinh dòng ở UC33, người chấm ghi (UC31.1) chưa làm |
| 11 | `submission_review_scores` | Điểm từng tiêu chí trong một lượt đánh giá | | Có (cùng giao dịch với chấm của Instructor) |
| 12 | `learner_accounts` | Tài khoản Learner bị vô hiệu hóa hoặc đã xóa, bảng thưa | | **Chưa** (chưa có consumer event) |
| 13 | `platform_settings` | Bản sao tham số mặc định của nền tảng | BR-335 | **Chưa** (chỉ đọc, không có chỗ ghi; thiếu dòng thì dùng giá trị mặc định trong code) |
| 14 | `outbox_events` | Event ghi cùng giao dịch với thay đổi | Quy ước outbox | Có; **chưa có relay đưa lên Kafka** |

assessment-service **không có** bảng Enrollment, Course, Certificate hay thông báo. Quyền làm bài của Learner (BR-210: Course Completed thì chỉ đọc; Halted và Withdrawn thì bị chặn) do learning-service trả lời từng lần qua REST `assessment-access` (L17), không lưu ở đây. Bảng `completed_enrollments` từng làm việc đó nhưng không có nguồn ghi, đã bị bỏ (mục 8).

---

## 3. Chi tiết từng bảng

Ký hiệu: **B** = `NOT NULL`. Mọi bảng có `organization_id` (B), `created_at` (B), `updated_at` (B) như mục 1; các cột đó không lặp lại dưới đây.

### 3.1 `assessments`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `course_id` | `uuid` B | Phiên bản Course; không có khóa ngoại (thuộc course-service) |
| `module_id` | `uuid` | Rỗng = gắn thẳng vào Course |
| `kind` | `text` B | `QUIZ` hoặc `ASSIGNMENT` |
| `title` | `varchar(200)` B | |
| `position` | `int` B | Thứ tự trong Course. Gán bằng "lớn nhất + 1" dưới khóa theo Course (mục 4.1); **không có chỉ mục duy nhất** |
| `passing_score` | `numeric(5,2)` B | |
| `max_consecutive_attempts` (n) | `int` B | BR-217 |
| `lockout_hours` (m) | `int` B | BR-217 |
| `is_required` | `boolean` B | Assignment luôn `true` (BR-206) |
| `time_limit_minutes` | `int` | Quiz |
| `prompt`, `prompt_file_key`, `prompt_file_name`, `prompt_file_mime`, `prompt_file_size_bytes` | | Assignment; file ở kho ngoài |
| `expected_duration_minutes` | `int` | Assignment; cộng vào thời lượng dự kiến của Course |
| `peer_review_enabled` | `boolean` B, mặc định `false` | BR-224, BR-227 |
| `peer_reviewers_per_submission` (N) | `smallint` | Có khi bật chấm chéo |
| `peer_review_cycle_days`, `peer_review_deadline_days` | `int` | Rỗng = lấy mặc định (mục 3.13) |
| `peer_review_score_gap` | `numeric(5,2)` | |
| `disabled_at` | `timestamptz` | Có thì Learner không thấy Assessment. **Chưa có code ghi cột này** (chỉ đọc) |
| `copied_from_id` | `uuid` | **Chưa có code nào dùng cột này** |

Chỉ mục: `(organization_id, course_id)`. Bảng con xóa theo (`ON DELETE CASCADE`): `quiz_questions`, `rubric_criteria`, `learner_assessment_states`, `quiz_attempts`, `submissions`, `peer_review_cycles`.

### 3.2 `quiz_questions` và 3.3 `quiz_question_options`

`quiz_questions`: `assessment_id` B (cascade), `question_type` B, `content` `varchar(2000)` B, `position` B. Duy nhất `(assessment_id, position)`.
`question_type` nhận `SingleChoice`, `MultipleChoice` hoặc `TrueFalse` (`QUIZ_QUESTION_TYPES` trong code); DB không kiểm, code đọc cho qua giá trị lạ.
`quiz_question_options`: `question_id` B (cascade), `content` `varchar(500)` B, `is_correct` B, `position` B. Duy nhất `(question_id, position)`.
Chưa có code ghi hai bảng; UC18.1 chỉ đọc chúng để hiển thị.

### 3.4 `rubric_criteria`

`assessment_id` B (cascade), `name` `varchar(200)` B, `description` `varchar(500)` B, `max_points` `smallint` B, `position` B. Duy nhất `(assessment_id, position)`. Được ghi cùng giao dịch với Assignment (UC19.2).

### 3.5 `learner_assessment_states`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `assessment_id` | `uuid` B | Cascade |
| `learner_id` | `uuid` B | |
| `first_activity_at` | `timestamptz` B | Dòng được tạo ở lần nộp đầu tiên (`ensureState`) |
| `consecutive_count` | `int` B, mặc định 0 | Số lượt liên tiếp (BR-218) |
| `locked_until` | `timestamptz` | Có giá trị khi đủ n lượt: tạm khóa m giờ, hiển thị cho Learner (BR-218, BR-221). Sau mốc này đếm lại từ 0 |
| `recorded_attempt_id` | `uuid` | **Chưa có code dùng.** Điểm ghi nhận của Quiz hiện tính lúc đọc, không lưu |
| `latest_submission_id` | `uuid` | Bài nộp mới nhất; không có khóa ngoại |
| `peer_review_obligation` | `text` | Giá trị `Missed`: Learner đã bỏ chấm ở chu kỳ trước (BR-239). Người ghi giá trị này là job lịch của UC33 (đang chờ); code trên `develop` chỉ **đọc** để quyết định bài nộp lại đi đâu |
| `exempted_at` | `timestamptz` | Instructor miễn nghĩa vụ (BR-241) |
| `exempted_by` | `uuid` | **Chưa có code dùng** |

Duy nhất `(assessment_id, learner_id)`. Mỗi dòng đóng vai trò khóa đếm lượt cho một Learner trên một Assessment.

### 3.6 `quiz_attempts` và 3.7 `quiz_attempt_answers`

`quiz_attempts`: `assessment_id` B (cascade), `learner_id` B, `attempt_number` B, `started_at` B, `deadline_at` B, `submitted_at`, `submission_kind`, `score` `numeric(5,2)`. Duy nhất `(assessment_id, learner_id, attempt_number)`.
`quiz_attempt_answers`: `attempt_id` B (cascade), `question_id` B (**`RESTRICT`**, nên khi xóa Quiz code phải xóa đáp án trước), `option_id` B (không có khóa ngoại). Duy nhất `(attempt_id, question_id, option_id)`.
Chưa có code tạo lượt làm; các cột này chờ UC29.1 (tự nộp khi hết giờ theo BR-200). Điểm ghi nhận của Quiz là lượt cao nhất (BR-198), **tính lúc đọc**.

### 3.8 `submissions`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `assessment_id` | `uuid` B | Cascade |
| `learner_id` | `uuid` B | |
| `submission_number` | `int` B | Tăng dần theo từng Learner trên từng Assignment |
| `content` | `varchar(20000)` | Một trong `content` và `file_key` phải có (kiểm ở ứng dụng) |
| `file_key`, `file_name`, `file_mime`, `file_size_bytes` | | File ở kho ngoài |
| `submitted_at` | `timestamptz` B | Thời gian của máy chủ |
| `cycle_id` | `uuid` | Chu kỳ chấm chéo chứa bài. **Không có khóa ngoại** sang `peer_review_cycles`. Rỗng khi Instructor chấm thẳng |
| `superseded_at` | `timestamptz` | Có khi bị bài nộp lại thay thế; bài đó giữ lại làm lịch sử (BR-213) |
| `grading_status` | `text` B | Mục 3.8.1 |
| `intervention_reason` | `text` | Lý do Instructor phải chấm |
| `final_score`, `finalization_comment`, `finalized_at`, `finalized_by` | | Khi chốt điểm (UC32.3). **Chưa có code ghi các cột này** trên `develop` |

Duy nhất `(assessment_id, learner_id, submission_number)`. **Điểm ghi nhận của Assignment là điểm của bài nộp gần nhất** (BR-212), tính lúc đọc, không lưu.

#### 3.8.1 Giá trị của `grading_status` và `intervention_reason`

`grading_status`: `AwaitingPeerReview` → `AwaitingInstructor` hoặc `AwaitingFinalization` → `Finalized`.

| Giá trị | Ý nghĩa | Ai đặt trên `develop` |
|---|---|---|
| `AwaitingPeerReview` | Bài nằm trong chu kỳ chấm chéo đang mở | UC30, UC30.1 |
| `AwaitingInstructor` | Instructor phải chấm | UC30 (chấm chéo tắt), UC30.1 (nộp lại sau mốc chốt) |
| `AwaitingFinalization` | Đã có đủ đánh giá, chờ chốt điểm | Chấm của Instructor (UC32): từ `AwaitingInstructor` |
| `Finalized` | Đã chốt điểm | **Chưa có code đặt** (UC32.3) |

`intervention_reason`: `PEER_REVIEW_DISABLED` (chấm chéo tắt) và `RESUBMITTED_AFTER_CUTOFF` (nộp lại sau mốc chốt, BR-213). UC33 thêm `TOO_FEW_SUBMISSIONS` (BR-242) và `REVIEW_MISSED` (BR-243) — **đang chờ merge**.

### 3.9 `peer_review_cycles`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `assessment_id` | `uuid` B | Cascade |
| `opens_at`, `closes_at`, `review_due_at` | `timestamptz` B | Ba mốc. Tính theo ngày lịch của múi giờ tổ chức (mặc định `Asia/Ho_Chi_Minh`, chờ endpoint của tenant-service); mốc đóng là cuối ngày thứ L, hạn chấm là cuối ngày thứ D sau ngày chốt (BR-229) |
| `reviewers_per_submission` | `smallint` B | N, **sao chép** từ Assignment lúc tạo chu kỳ |
| `score_gap` | `numeric(5,2)` B | Sao chép |
| `reminder_hours` | `int` B | Sao chép từ `platform_settings` hoặc mặc định 24 |
| `status` | `text` B | Mục 3.9.1 |
| `reviewer_permutation` | `uuid[]`, **cho phép NULL** | Hoán vị ngẫu nhiên của tập người đánh giá, lưu lại để chốt lại cho cùng kết quả (BR-249). NULL khi chu kỳ vừa được tạo ở UC30 và chưa chốt; mã UC33 ghi mảng rỗng khi không giao được |
| `closed_at`, `reminded_at`, `completed_at` | `timestamptz` | Lúc chốt, lúc nhắc, lúc hết hạn đánh giá |

Không có chỉ mục nào ngoài khóa chính. Các giá trị tham số được sao chép nên đổi cấu hình chỉ áp dụng cho chu kỳ tạo sau (BR-335).

#### 3.9.1 Giá trị của `status`

| Giá trị | Ý nghĩa | Có trên `develop` |
|---|---|---|
| `Open` | Đang nhận bài, tạo theo nhu cầu ở lần nộp đầu tiên của một khoảng | Có |
| `Assigned` | Đã chốt, bài đã giao cho người đánh giá | **Đang chờ UC33** |
| `InstructorOnly` | Đã chốt nhưng quá ít bài, Instructor chấm hết (BR-242) | **Đang chờ UC33** |
| `Completed` | Hết hạn đánh giá | **Đang chờ UC33** |

Trong lúc chốt, mã UC33 đặt tạm giá trị `Closing` **bên trong một giao dịch**; không giao dịch khác nhìn thấy giá trị này.

### 3.10 `submission_reviews`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `submission_id` | `uuid` B | Cascade |
| `cycle_id` | `uuid` | Khóa ngoại `ON DELETE SET NULL`; rỗng với đánh giá của Instructor ngoài chu kỳ |
| `reviewer_id` | `uuid` B | |
| `reviewer_role` | `text` B | `Learner` hoặc `Instructor` |
| `status` | `text` B | Mục 3.10.1 |
| `score` | `numeric(5,2)` | Có khi hoàn thành |
| `comment` | `varchar(2000)` | |
| `completed_at` | `timestamptz` | |

Chỉ mục: `(organization_id, reviewer_id)`. Không có chỉ mục theo `submission_id` hay `cycle_id` (mục 10).

#### 3.10.1 Giá trị của `status`

| Giá trị | Ý nghĩa | Có trên `develop` |
|---|---|---|
| `Pending` | Được giao, chưa chấm | **Đang chờ UC33** (người sinh dòng) |
| `Completed` | Đã chấm đủ: mọi tiêu chí có điểm và có nhận xét | Có (Instructor); chấm chéo của Learner chờ UC31.1 |
| `Missed` | Hết hạn mà chưa chấm | **Đang chờ UC33** |

Một đánh giá chỉ tính vào điểm khi `Completed`. Đã có thỏa thuận về bộ ba `Pending → Completed | Missed`.

### 3.11 `submission_review_scores`

`review_id` B (cascade), `criterion_id` B (**`RESTRICT`**), `points` `smallint` B. Duy nhất `(review_id, criterion_id)`: mỗi tiêu chí một điểm trong mỗi lượt đánh giá.

### 3.12 `learner_accounts`

Bảng thưa: `user_id` (khóa chính, ID gốc), `deactivated_at`, `deleted_at`, `status_as_of` B. Dành cho event tài khoản bị vô hiệu hóa hoặc xóa. **Chưa có consumer nào ghi.**

### 3.13 `platform_settings`

Bản sao tham số mặc định: `default_peer_review_cycle_days` 7, `default_peer_review_deadline_days` 3, `peer_review_reminder_hours` 24, `default_max_consecutive_attempts` 3, `default_lockout_hours` 24 (mặc định ở DB), `source_as_of` B. Code đọc dòng mới nhất; **chưa có chỗ ghi**, thiếu dòng thì dùng đúng các giá trị mặc định ghi trong code.

### 3.14 `outbox_events`

`aggregate_type` B, `aggregate_id` B, `event_type` B, `organization_id`, `payload` `jsonb` B, `occurred_at` B, `published_at`. Chỉ mục `(published_at)`. Dòng được ghi cùng giao dịch với thay đổi nó thông báo. Xem mục 5.3 về việc gửi.

---

## 4. Luồng chính

### 4.1 Tạo Assignment (UC19.2)

1. Kiểm quyền Instructor và Course (qua course-service): thuộc Instructor, có thể sửa, chưa Locked.
2. Một transaction: khóa theo Course (`pg_advisory_xact_lock(hashtext(courseId))`) để hai yêu cầu song song không chung `position`; lấy `position` lớn nhất + 1; ghi `assessments`; ghi `rubric_criteria`; ghi `outbox_events` loại `AssignmentMinutesChanged`.
3. Trước khi commit kiểm lại một lần nữa Course còn thêm được (cửa sổ còn lại chỉ bằng một lời gọi).
4. Sau commit: gọi REST course-service đặt tổng số phút của các Assignment; thành công thì đặt `published_at`; thất bại không làm hỏng thao tác, dòng outbox giữ nguyên chưa gửi và lần đổi sau sẽ gửi lại tổng đúng.

### 4.2 Nộp bài lần đầu (UC30)

1. Hỏi learning-service quyền làm bài (L17): `Full` được nộp, `ReadOnly` chỉ đọc (409 `ENROLLMENT_COMPLETED`), `None` bị chặn (409 `ENROLLMENT_NOT_ACTIVE`), chưa Enroll thì 403, lỗi hoặc câu trả lời không hợp lệ thì 503. Không lưu lại câu trả lời.
2. Kiểm tệp (loại, chữ ký, kích thước), tải lên kho ngoài trước giao dịch.
3. Một transaction: khóa theo `(assessment, learner)` (`{assessmentId}:{userId}`); tạo hoặc lấy dòng `learner_assessment_states`; kiểm khóa tạm; đặt chỗ cho bài: chấm chéo bật thì khóa theo Assignment (`cycle:{assessmentId}`), tìm chu kỳ đang `Open` chứa thời điểm nộp, chưa có thì tạo (sao chép tham số của Assignment, BR-335, BR-208), `grading_status = AwaitingPeerReview`; chấm chéo tắt thì `AwaitingInstructor` với lý do `PEER_REVIEW_DISABLED`; ghi `submissions`; cập nhật `consecutive_count`, `locked_until`, `latest_submission_id`; ghi `outbox_events` loại `LearnerAssessmentStatusChanged`.
4. Ghi dở: nếu transaction thất bại thì xóa file đã tải lên.

### 4.3 Nộp lại (UC30.1)

Cùng các bước trên; khác ở chỗ đặt bài (BR-213, BR-239):
- chu kỳ của bài trước **chưa tới mốc chốt**: bài mới thay bài cũ trong cùng chu kỳ;
- **đã qua mốc chốt**: bài mới đi thẳng cho Instructor (`RESUBMITTED_AFTER_CUTOFF`), trừ khi Learner đang nợ nghĩa vụ chấm chéo (`peer_review_obligation = Missed`, chưa được miễn): khi đó bài vào chu kỳ đang mở để bù nghĩa vụ.
Bài cũ được đặt `superseded_at` và giữ lại làm lịch sử. Không giới hạn tổng số lần nộp lại cho tới khi Enrollment Completed (BR-209, BR-210).

### 4.4 Chấm của Instructor (UC32)

Một transaction: khóa dòng bài nộp (`FOR UPDATE`); chỉ chấm được bài đang `AwaitingInstructor` và là bài nộp gần nhất; ghi `submission_reviews` (vai `Instructor`, `Completed`) cùng `submission_review_scores`; đổi `grading_status` sang `AwaitingFinalization` bằng cập nhật có điều kiện (`WHERE grading_status = 'AwaitingInstructor'`). Việc chốt điểm cuối (`Finalized`, `final_score`) chưa có code.

### 4.5 Xem danh sách và kết quả của Learner (UC29, UC30.2)

Không ghi gì. File đề bài do dịch vụ tải từ kho (URL dựng từ khóa) rồi trả qua API sau khi kiểm quyền, trình duyệt không gọi thẳng kho. Trạng thái và điểm ghi nhận **tính lúc đọc** từ lượt làm hoặc bài nộp gần nhất: Quiz lấy lượt cao nhất (BR-198), Assignment lấy bài gần nhất (BR-212), trạng thái `NotStarted`, `InProgress`, `AwaitingResult`, `Completed`. Kết quả một bài chỉ có khi `Finalized`; người đánh giá không bao giờ lộ danh tính.

### 4.6 Chốt chu kỳ, nhắc, hết hạn (UC33) — đang chờ merge

Mô tả ở mục 6. Chưa có trên `develop`.

---

## 5. Dữ liệu trao đổi với service khác

### 5.1 Nhận vào

| Từ | Cách | Dùng để |
|---|---|---|
| course-service | REST khi cần (có thể giả bằng `COURSE_CLIENT_MODE=fake`) | Biết Course có thuộc Instructor, đang sửa được, Locked chưa; thứ tự Module |
| learning-service | REST `GET /api/v1/internal/enrollments/assessment-access` (L17), mỗi yêu cầu một lần, không lưu | Quyền làm bài theo trạng thái Enrollment (BR-210). Bảng ánh xạ trạng thái → quyền: NotStarted, InProgress, Exempted là `Full`; Completed là `ReadOnly`; Halted, Withdrawn là `None`; câu trả lời mâu thuẫn bị coi là 503 |
| tenant-service | REST | Tên hiển thị Learner trên màn của Instructor |
| Event | **Chưa có consumer nào.** Hai bảng `learner_accounts` và `platform_settings` dành sẵn cho event tài khoản và tham số nền tảng | |

### 5.2 Cung cấp

| Cho | Cách | Nội dung |
|---|---|---|
| learning-service | REST nội bộ `GET /internal/learners/{learnerId}/courses/{courseId}/assessment-activity` (UC25.4) | `hasQuizAttempt`, `hasSubmission`, `hasPeerReviewGiven`: Learner đã làm gì trong phiên bản Course (learning-service dùng để quyết định xóa Enrollment hay giữ ở Withdrawn khi Learner rút) |
| learning-service | `completion-snapshot` (REST nội bộ) | **Chưa có.** Kế hoạch giai đoạn 3; hợp đồng với learning đã chốt |

### 5.3 Event phát ra (qua `outbox_events`)

| `event_type` | `aggregate_type` | Khi nào | Payload chính | Việc gửi hiện nay |
|---|---|---|---|---|
| `AssignmentMinutesChanged` | `Assignment` | Tạo, đổi thời lượng, xóa Assignment (`change`: `Created`, `DurationChanged`, `Deleted`) | `assignmentId`, `courseId`, `change`, `expectedDurationMinutes` | Gửi bằng **REST** sang course-service ngay sau commit (mục 4.1), không qua Kafka; dòng được đánh dấu đã gửi khi REST thành công |
| `LearnerAssessmentStatusChanged` | `LearnerAssessmentState` | Mỗi lần nộp hoặc nộp lại | `assessmentId`, `courseId`, `learnerId`, `kind`, `status` (`Submitted` hoặc `Resubmitted`), `submissionId`, `previousSubmissionId`, `consecutiveCount`, `lockedUntil` | **Chưa có relay**: `OutboxService` là lớp rỗng, nên dòng được ghi nhưng không bao giờ được gửi và `published_at` luôn rỗng. Learning-service chờ event này (kế hoạch giai đoạn 5) |

Payload của `LearnerAssessmentStatusChanged` sẽ được mở rộng (`reason`, `revision`, `firstActivityAt`…) ở giai đoạn 5; tài liệu này mô tả bản đang ghi.

---

## 6. Việc chạy theo lịch

**Chưa có trên `develop`.** PR UC33 thêm một bộ hẹn giờ trong tiến trình (`PEER_REVIEW_TICK_MS`, mặc định 60 giây trong Compose, không đặt hoặc 0 là tắt):

| Việc | Điều kiện | Kết quả |
|---|---|---|
| Chốt chu kỳ | `status = Open` và `closes_at` đã qua (BR-230) | Đủ bài (≥ N + 1): sinh hoán vị, tạo `submission_reviews` `Pending` theo vòng, chu kỳ `Assigned`. Thiếu bài: chuyển bài cho Instructor, chu kỳ `InstructorOnly` (BR-242, BR-248, BR-249) |
| Nhắc | `Assigned`, `reminded_at` rỗng, còn trong cửa sổ `reminder_hours` trước `review_due_at` | Gửi một thông báo mỗi người còn nợ, đặt `reminded_at` (BR-232) |
| Hết hạn đánh giá | `Assigned` và `review_due_at` đã qua | Đánh `Pending → Missed`; bài chưa đủ N đánh giá hợp lệ chuyển cho Instructor (BR-237, BR-243); người bỏ chấm bị đặt `peer_review_obligation = Missed` trừ người đã được miễn (BR-241); chu kỳ `Completed` |

Mỗi bước tranh giành chu kỳ bằng cập nhật có điều kiện (`WHERE status = ...`) nên hai lần chạy cùng lúc, hoặc hai bản của service, chỉ làm một lần. Chốt tay của Instructor và việc đặt bài nộp vào chu kỳ dùng chung một khóa theo Assignment (`cycle:{assessmentId}`).

---

## 7. Những gì hiện không có

Đây là mô tả hiện trạng; chưa phải mọi mục đều đã được xác nhận là cố ý.

| Chỗ | Hiện trạng | Ghi chú |
|---|---|---|
| Ràng buộc `CHECK` | Không có một cái nào | Mọi trạng thái là chuỗi tự do; chỉ ứng dụng giữ tập giá trị. Xem mục 8 |
| Khóa ngoại mềm | `submissions.cycle_id`, `learner_assessment_states.latest_submission_id`, `recorded_attempt_id`, `quiz_attempt_answers.option_id`, mọi `organization_id`, `course_id`, `learner_id`, `reviewer_id` | Không có khóa ngoại; toàn vẹn do ứng dụng giữ |
| Cột chưa có code dùng | `assessments.copied_from_id`, `learner_assessment_states.recorded_attempt_id`, `exempted_by` | Dành cho tính năng sau |
| Bảng chưa có luồng ghi | `quiz_questions`, `quiz_question_options`, `quiz_attempts`, `quiz_attempt_answers`, `learner_accounts`, `platform_settings` | Chờ UC18.3, UC29.1 và consumer event |
| Điểm ghi nhận | Không lưu | Tính lúc đọc từ lượt làm hoặc bài nộp gần nhất |
| Trạng thái Overdue, tính lại điểm khi đổi tham số | Không có | Đổi tham số chỉ áp dụng cho dữ liệu sinh sau (BR-335) |
| Bảng `completed_enrollments` | Đã bỏ | Mục 8 |
| Relay outbox sang Kafka | Chưa có | Giai đoạn 5 |

---

## 8. Quyết định nghiệp vụ phát sinh khi thiết kế

| # | Quyết định | Tình trạng |
|---|---|---|
| D5 | Bỏ bảng `completed_enrollments`: nó chỉ là bản chiếu dữ liệu của learning, không có nguồn ghi, nên BR-210 gần như không bao giờ có hiệu lực. Quyền làm bài lấy từ L17 mỗi lần. Migration `20261025000000_drop_completed_enrollments` | Đã chốt; migration cần chạy khi triển khai (PR #159) |
| D6 | Bộ ba trạng thái đánh giá `Pending → Completed \| Missed` | Hào đã chấp nhận; có trên `develop` khi PR UC33 vào |
| D7 | Bốn giá trị trạng thái chu kỳ `Open`, `Assigned`, `InstructorOnly`, `Completed` | Như trên |
| D8 | Thêm `CHECK` cho các cột trạng thái | Hào đồng ý (bình luận trên #174): làm ở PR migration riêng, sau khi PR UC33 (#173) merge vì UC33 thêm giá trị mới. Xem mục 10 việc 5 |
| D9 | File nộp bài và file đề bài nằm ở kho Cloudinary qua `@learnup/ts-storage`; DB giữ khóa, dịch vụ tải file từ kho rồi trả qua API sau khi kiểm quyền. Chuyển sang giao hàng riêng tư với URL ký có hạn (việc P4) | Hào đồng ý hướng đi: dùng chung helper URL ký của course-service (#146, khoảng 28/10), không tự làm riêng. **Hiện file đang ở kiểu giao hàng công khai** (xem mục 10 việc 3) |

---

## 9. Sơ đồ quan hệ

Chỉ vẽ quan hệ có khóa ngoại thật; các quan hệ mềm ghi ở mục 7.

```mermaid
erDiagram
    assessments ||--o{ quiz_questions : "CASCADE"
    assessments ||--o{ rubric_criteria : "CASCADE"
    assessments ||--o{ learner_assessment_states : "CASCADE"
    assessments ||--o{ quiz_attempts : "CASCADE"
    assessments ||--o{ submissions : "CASCADE"
    assessments ||--o{ peer_review_cycles : "CASCADE"
    quiz_questions ||--o{ quiz_question_options : "CASCADE"
    quiz_questions ||--o{ quiz_attempt_answers : "RESTRICT"
    quiz_attempts ||--o{ quiz_attempt_answers : "CASCADE"
    submissions ||--o{ submission_reviews : "CASCADE"
    peer_review_cycles |o--o{ submission_reviews : "SET NULL"
    submission_reviews ||--o{ submission_review_scores : "CASCADE"
    rubric_criteria ||--o{ submission_review_scores : "RESTRICT"
```

Bảng độc lập, không có khóa ngoại: `learner_accounts`, `platform_settings`, `outbox_events`.
Hướng dẫn bố trí cho dbdiagram.io chưa viết (mục 10).

---

## 10. Việc tiếp theo

1. **Cập nhật sau khi PR UC33 được merge:** mục 3.9, 3.10, 5.3 và 6 đổi từ "đang chờ" thành hiện trạng; thêm giá trị `TOO_FEW_SUBMISSIONS` và `REVIEW_MISSED`.
2. **Rà các truy vấn không lọc theo `organization_id`** và lập bảng ngoại lệ như mục 1.1 của tài liệu learning-service.
3. **File riêng tư (P4):** cả hai nơi upload (`assignment-media.service.ts`, `learner-submissions.service.ts`) gọi `storage.upload` với `resourceType: 'raw'` và **không truyền `deliveryType`**; `@learnup/ts-storage` khi đó dùng `upload`, tức giao hàng công khai. Dịch vụ tải file bằng `storage.getUrl(key, 'raw')` là URL thường. Vì vậy ai có URL đều tải được, bất kể kiểm quyền ở API; đây là vấn đề chính, hơn cả việc URL hết hạn. Hướng đi: dùng helper URL ký của course-service (#146) rồi chuyển sang `authenticated`/`private`. Gói Free của Cloudinary chỉ có link hết hạn qua `private_download_url` (api.cloudinary.com), liên quan câu hỏi mở về giới hạn Admin API. Cần kiểm trước: file đã upload là kiểu nào trên môi trường thật (đọc code chưa đủ).
4. **Chỉ mục:** hiện chỉ có `assessments(organization_id, course_id)`, `submission_reviews(organization_id, reviewer_id)` và `outbox_events(published_at)` ngoài các khóa duy nhất. Các truy vấn theo `submissions.cycle_id`, `submission_reviews.cycle_id`, `submission_reviews.submission_id` chưa có chỉ mục. **Chưa đo, và tài liệu không nói chúng cần chỉ mục.** Bước cụ thể: chạy `EXPLAIN ANALYZE` các truy vấn của UC33 trên `cycle_id` / `submission_id` với dữ liệu seed, rồi mới quyết định.
5. **`CHECK` cho trạng thái (PR migration riêng, sau #173):** đếm trước các dòng có giá trị ngoài tập hợp; thêm từng constraint `NOT VALID` rồi `VALIDATE` (cách course-service đã làm); xác nhận Prisma không báo các `CHECK` viết tay là drift.
6. **Các luồng ghi còn thiếu:** câu hỏi và đáp án Quiz (UC18.3), lượt làm Quiz và tự nộp khi hết giờ (UC29.1, BR-200), chốt điểm Assignment (UC32.3), consumer event cho `learner_accounts` và `platform_settings`, ghi `disabled_at`.
7. **Relay outbox** và mở rộng payload `LearnerAssessmentStatusChanged` (giai đoạn 5), endpoint `completion-snapshot` (giai đoạn 3).
8. **Sơ đồ ERD cho dbdiagram.io** và số đo thực nghiệm: chưa làm.
