# Thiết kế database tenant-service (`tenant_db`)

Trạng thái: **đã chốt toàn bộ 10 bảng**, chưa sinh migration SQL.
Nguồn nghiệp vụ: `LearnUP_QuyTacNghiepVu.docx` (đến BR-283), `LearnUP_UseCase.docx`, `LearnUP_Service_Architecture.docx`.

---

## 1. Quy ước chung (áp cho mọi service)

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Hệ quản trị | PostgreSQL 18 | Có sẵn hàm `uuidv7()` |
| Khóa chính | `uuid`, mặc định `uuidv7()` | `user_id` đi khắp 8 service và vào JWT; ID lộ trên URL không nên là số tăng dần; v7 tăng theo thời gian nên chỉ mục B-tree không phân mảnh |
| Cột thời gian | `timestamptz` | Lưu thời điểm tuyệt đối; quy đổi múi giờ tổ chức (BR-44) chỉ khi tính mốc hoặc hiển thị |
| `created_at`, `updated_at` | `timestamptz NOT NULL DEFAULT now()`, `updated_at` do tầng ứng dụng cập nhật | Một chỗ duy nhất phải nhớ, không dùng trigger |
| Trạng thái | `text` + `CHECK`, giá trị viết PascalCase | Thêm giá trị không cần `ALTER TYPE`; theo cách đặt tên của BR-115 |
| Tiền | `bigint`, đơn vị nhỏ nhất của tiền tệ (đồng với VND) | VND không có đơn vị lẻ (ISO 4217); số thực có sai số. Mở rộng đa tiền tệ sau này chỉ cần thêm cột `currency` |
| Chữ | `varchar(n)` khi có căn cứ; `text` khi không có | Giới hạn vô căn cứ chỉ thêm rủi ro chặn dữ liệu hợp lệ |
| Chuẩn hóa chữ | API chuẩn hóa Unicode NFC và cắt khoảng trắng **trước** khi kiểm độ dài và lưu; từ chối ký tự điều khiển ở ô một dòng | Tiếng Việt có dấu có thể gửi lên dạng dấu rời, làm lệch độ dài, tìm kiếm và gom nhóm |
| Kích thước request | API Gateway giới hạn 64 KB cho endpoint JSON của tenant-service (endpoint import có giới hạn riêng) | Chặn gửi dữ liệu khổng lồ ở cổng vào |
| Khóa ngoại | Chỉ trong cùng database; tham chiếu sang service khác lưu ID logic | Tài liệu kiến trúc mục 2 |

### 1.1 Ngoại lệ của quy ước "mọi truy vấn lọc theo `organization_id`"

Các truy vấn sau bản chất là toàn nền tảng. Trong code, chúng được gom thành các repository method có hậu tố `AcrossOrganizations`. Mọi truy vấn khác bắt buộc lọc theo tổ chức.

| Truy vấn | Căn cứ |
|---|---|
| Đăng nhập: tìm tài khoản theo email | BR-27, UC05 |
| Kiểm email trùng khi tạo tài khoản hoặc import | BR-26, BR-30 |
| Mở liên kết mời, xác thực, thanh toán lại | UC02.2, UC03, UC04 |
| Đăng ký và gửi lại liên kết | UC02, UC03.1 |
| Màn hình của Admin, bảng gói, bảng tham số | UC43, UC44, UC45 |

### 1.2 Giới hạn giao diện đã thống nhất (loại 3)

Frontend đặt `maxLength` đúng các con số này; API kiểm sau khi chuẩn hóa NFC; database dùng `varchar(n)` cùng con số.

| Ô nhập | Giới hạn (ký tự) |
|---|---|
| Tên tổ chức | 200 |
| Địa chỉ tổ chức | 300 |
| Họ tên | 100 |
| Đơn vị công tác | 100 |
| Tên gói | 100 |
| Mọi ô "lý do" trong toàn hệ thống (BR-271) | 1000, cho phép xuống dòng |

Tăng độ dài `varchar` trong PostgreSQL không phải ghi lại dữ liệu bảng, nên nới giới hạn sau này rất rẻ.

---

## 2. Danh sách bảng

| # | Bảng | Giữ gì | Căn cứ chính |
|---|---|---|---|
| 1 | `organizations` | Hồ sơ tổ chức, múi giờ, trạng thái do Admin đặt | BR-42–BR-45, BR-280 |
| 2 | `users` | Tài khoản của cả 4 vai trò | BR-30–BR-37, BR-40, BR-279 |
| 3 | `account_tokens` | Liên kết mời và liên kết xác thực (chỉ lưu mã băm) | BR-6, BR-20–BR-22, BR-35, BR-278 |
| 4 | `subscription_plans` | Gói dịch vụ | BR-1–BR-3 |
| 5 | `registrations` | Lượt đăng ký chờ thanh toán | BR-4–BR-9, BR-32, BR-275, BR-276 |
| 6 | `subscriptions` | Từng kỳ hiệu lực, có bản chụp giá và giới hạn | BR-9–BR-17, BR-274, BR-281 |
| 7 | `payments` | Từng giao dịch thanh toán | UC02.1, BR-277, BR-282 |
| 8 | `organization_suspensions` | Lịch sử tạm khóa tổ chức | BR-45–BR-47, BR-271, BR-283 |
| 9 | `platform_settings` | 20 tham số nền tảng, một dòng | BR-268, BR-269 |
| 10 | `outbox_events` | Hàng đợi event gửi lên Kafka | Tài liệu kiến trúc mục 2.1, 2.3 |

Không có khóa ngoại nào ra khỏi `tenant_db`.

---

## 3. Chi tiết từng bảng

Ký hiệu: **B** = bắt buộc (`NOT NULL`). Mọi bảng có thêm `created_at`, `updated_at` như quy ước.

### 3.1 `organizations`

| Cột | Kiểu | B | Mặc định | Giới hạn, căn cứ, ràng buộc |
|---|---|---|---|---|
| `id` | uuid | ✓ | `uuidv7()` | — |
| `name` | varchar(200) | ✓ | — | Giới hạn giao diện. CHECK không rỗng |
| `tax_code` | varchar(13) | ✓ | — | Thông tư 86/2024/TT-BTC: 10 hoặc 13 chữ số. Lưu chữ số, bỏ gạch ngang. CHECK `^[0-9]{10}([0-9]{3})?$`. **Không duy nhất** (BR-280) |
| `address` | varchar(300) | ✓ | — | Giới hạn giao diện. CHECK không rỗng |
| `contact_phone` | varchar(16) | ✓ | — | ITU-T E.164: tối đa 15 chữ số cộng dấu `+`. CHECK `^\+[1-9][0-9]{1,14}$`. API quy đổi "09…" về "+849…" |
| `contact_email` | varchar(254) | | — | RFC 5321 / RFC 3696 erratum 1690: tối đa 254. CHECK chữ thường |
| `logo_file_key` | text | | — | Khóa tệp do dịch vụ lưu trữ sinh ra |
| `timezone` | text | ✓ | `'Asia/Ho_Chi_Minh'` | Tên múi giờ IANA. API kiểm thuộc danh sách múi giờ hợp lệ |
| `status` | text | ✓ | `'PendingPayment'` | CHECK ∈ {`PendingPayment`, `Active`, `Suspended`, `Cancelled`} |

Chuyển trạng thái: `PendingPayment → Active` (thanh toán, BR-9); `PendingPayment → Cancelled` (đăng ký quá hạn, BR-7); `Active ↔ Suspended` (Admin khóa và gỡ khóa, BR-45, BR-47).
Không có `deleted_at` (chấm dứt tổ chức nằm ngoài MVP). Không có chỉ mục phụ.

### 3.2 `users`

| Cột | Kiểu | B | Mặc định | Giới hạn, căn cứ, ràng buộc |
|---|---|---|---|---|
| `id` | uuid | ✓ | `uuidv7()` | `user_id` dùng chung toàn hệ thống, là `sub` của JWT |
| `organization_id` | uuid | trừ Admin | — | Khóa ngoại tới `organizations` |
| `email` | varchar(254) | ✓ | — | RFC 5321. CHECK `email = lower(btrim(email))` |
| `full_name` | varchar(100) | ✓ | — | Giới hạn giao diện. Organizer nhập lúc tạo (BR-34) |
| `avatar_file_key` | text | | — | — |
| `role` | text | ✓ | — | CHECK ∈ {`Admin`, `Organizer`, `Instructor`, `Learner`} |
| `department` | varchar(100) | | — | Chữ tự do (BR-279), Organizer quản lý ở mọi thời điểm (BR-34) |
| `status` | text | ✓ | `'Pending'` | CHECK ∈ {`Pending`, `Active`, `Deactivated`} |
| `activated_at` | timestamptz | | — | Để biết kích hoạt lại thì về `Active` hay `Pending` |
| `deleted_at` | timestamptz | | — | BR-31, BR-37 |

| Ràng buộc hoặc chỉ mục | Định nghĩa | Căn cứ |
|---|---|---|
| Email duy nhất | UNIQUE `(email)` WHERE `deleted_at IS NULL` | BR-30, BR-31; chỉ mục cho đăng nhập |
| Một Organizer | UNIQUE `(organization_id)` WHERE `role='Organizer' AND deleted_at IS NULL AND status<>'Deactivated'` | BR-40 (tính cả Organizer đang chờ nhận lời mời) |
| Admin không thuộc tổ chức | CHECK `(role='Admin') = (organization_id IS NULL)` | — |
| Đếm chỗ, danh sách | INDEX `(organization_id, role)` WHERE `deleted_at IS NULL` | BR-23, BR-25, BR-36, BR-37 |
| Phục vụ khóa ngoại kép | UNIQUE `(id, organization_id)` | `account_tokens`, `registrations` |

Chuyển trạng thái: `Pending → Active` (UC03, UC04); `Pending|Active → Deactivated`; `Deactivated → Active` nếu có `activated_at`, ngược lại `→ Pending`. Xóa = đặt `deleted_at`.

### 3.3 `account_tokens`

Chuỗi gốc là 32 byte ngẫu nhiên, gửi trong email dạng base64url (43 ký tự). Database chỉ lưu mã băm SHA-256. Dùng SHA-256 thay vì bcrypt vì chuỗi có entropy 256 bit (không dò được) và cần tra bằng phép so sánh bằng.

| Cột | Kiểu | B | Giới hạn, căn cứ, ràng buộc |
|---|---|---|---|
| `id` | uuid | ✓ | — |
| `organization_id` | uuid | ✓ | Khóa ngoại kép `(user_id, organization_id)` → `users(id, organization_id)` |
| `user_id` | uuid | ✓ | như trên |
| `purpose` | text | ✓ | CHECK ∈ {`Invitation`, `EmailVerification`} |
| `token_hash` | bytea | ✓ | SHA-256 = 32 byte (FIPS 180-4). CHECK `octet_length = 32`. UNIQUE |
| `expires_at` | timestamptz | ✓ | Thời điểm tạo + tham số 19, chép lúc tạo (BR-278, BR-269). CHECK `> created_at` |
| `consumed_at` | timestamptz | | Đã dùng |
| `revoked_at` | timestamptz | | Thu hồi: phát liên kết mới, sửa email (BR-35), hủy lời mời Organizer (BR-40). CHECK không đồng thời có cả `consumed_at` và `revoked_at` |

Chỉ mục: UNIQUE `(user_id, purpose)` WHERE `consumed_at IS NULL AND revoked_at IS NULL`. Phát liên kết mới phải thu hồi liên kết cũ trong cùng transaction; nếu quên, chỉ mục này báo lỗi.

### 3.4 `subscription_plans`

Bảng cấp nền tảng, không có `organization_id`. Không bao giờ xóa gói; gỡ gói bằng `is_offered = false`.

| Cột | Kiểu | B | Mặc định | Ràng buộc |
|---|---|---|---|---|
| `id` | uuid | ✓ | `uuidv7()` | — |
| `name` | varchar(100) | ✓ | — | Giới hạn giao diện |
| `price` | bigint | ✓ | — | Đồng. CHECK `> 0` (không có gói miễn phí) |
| `duration_days` | integer | ✓ | — | Ngày (không dùng tháng vì độ dài tháng thay đổi). CHECK `> 0` |
| `max_learners` | integer | ✓ | — | CHECK `> 0` |
| `max_instructors` | integer | ✓ | — | CHECK `> 0` |
| `max_course_chains` | integer | ✓ | — | Đếm theo chuỗi phiên bản (BR-1). CHECK `> 0` |
| `max_storage_bytes` | bigint | ✓ | — | Byte, khớp đơn vị dịch vụ lưu trữ. CHECK `> 0` |
| `is_offered` | boolean | ✓ | `true` | BR-3 |

### 3.5 `registrations`

| Cột | Kiểu | B | Mặc định | Giới hạn, căn cứ, ràng buộc |
|---|---|---|---|---|
| `id` | uuid | ✓ | `uuidv7()` | — |
| `organization_id` | uuid | ✓ | — | Khóa ngoại. UNIQUE |
| `organizer_user_id` | uuid | ✓ | — | Khóa ngoại kép tới `users(id, organization_id)`. UNIQUE |
| `plan_id` | uuid | ✓ | — | Khóa ngoại; gói phải đang được cung cấp lúc đăng ký |
| `price`, `duration_days`, `max_learners`, `max_instructors`, `max_course_chains`, `max_storage_bytes` | như bảng gói | ✓ | — | **Bản chụp lúc tạo** (BR-275) |
| `status` | text | ✓ | `'PendingPayment'` | CHECK ∈ {`PendingPayment`, `Paid`, `Expired`} |
| `expires_at` | timestamptz | ✓ | — | Tạo + tham số 1, chép lúc tạo (BR-7, BR-269) |
| `paid_at` | timestamptz | | — | CHECK `(status='Paid') = (paid_at IS NOT NULL)` |
| `reopen_token_hash` | bytea | ✓ | — | 32 byte, UNIQUE. Gửi lại = ghi đè, liên kết cũ tự mất hiệu lực |
| `resend_count` | integer | ✓ | `0` | Trong khung 24 giờ hiện tại, dùng chung hai trường hợp (BR-32). CHECK `>= 0` |
| `resend_window_started_at` | timestamptz | | — | Quá 24 giờ thì bộ đếm về 0 |

Chỉ mục: INDEX `(expires_at)` WHERE `status='PendingPayment'` cho lịch chạy BR-7.
BR-276 (một email một đăng ký đang chờ) được đảm bảo gián tiếp: email duy nhất trong tài khoản chưa xóa, đăng ký một-một với tài khoản, đăng ký hết hạn thì tài khoản bị xóa mềm.

### 3.6 `subscriptions`

Mỗi dòng là một kỳ hiệu lực. Trạng thái lưu hẳn trong bảng (không tính ra từ ngày tháng), để chép tham số đúng lúc chuyển trạng thái (BR-269) và để phát event trong cùng transaction.

| Cột | Kiểu | B | Giới hạn, căn cứ, ràng buộc |
|---|---|---|---|
| `id` | uuid | ✓ | — |
| `organization_id` | uuid | ✓ | Khóa ngoại |
| `plan_id` | uuid | ✓ | Khóa ngoại |
| `source` | text | ✓ | CHECK ∈ {`Registration`, `Renewal`, `Upgrade`} |
| `status` | text | ✓ | CHECK ∈ {`Scheduled`, `Active`, `Grace`, `Suspended`, `Ended`} |
| 6 cột bản chụp | như bảng gói | ✓ | Kỳ đăng ký chép từ `registrations`; gia hạn và nâng cấp chép cấu hình hiện tại của gói lúc thanh toán (BR-2, BR-274) |
| `starts_at` | timestamptz | ✓ | — |
| `expires_at` | timestamptz | ✓ | `starts_at + duration_days × 24h`; kỳ nâng cấp giữ ngày hết hạn của kỳ cũ. Là thời điểm chính xác, không làm tròn cuối ngày (BR-9; BR-44 không áp cho Subscription). CHECK `> starts_at` |
| `grace_ends_at` | timestamptz | | `expires_at` + tham số 2, chép lúc vào `Grace` |
| `suspended_at` | timestamptz | | — |
| `read_only_ends_at` | timestamptz | | `suspended_at` + tham số 3, chép lúc vào `Suspended` (BR-17) |
| `ended_at` | timestamptz | | Lúc bị thay thế |
| `last_reminder_days` | integer | | Mốc nhắc gần nhất đã gửi (BR-18), chống gửi trùng |

| Ràng buộc | Định nghĩa |
|---|---|
| Một kỳ hiện hành | UNIQUE `(organization_id)` WHERE `status IN ('Active','Grace','Suspended')` |
| Tối đa một kỳ trả trước | UNIQUE `(organization_id)` WHERE `status='Scheduled'` (BR-281) |
| Đủ mốc theo trạng thái | CHECK: `Grace` ⇒ có `grace_ends_at`; `Suspended` ⇒ có `suspended_at`, `read_only_ends_at`; `Ended` ⇒ có `ended_at` |

| Sự kiện | Kỳ hiện tại | Kỳ mới |
|---|---|---|
| Thanh toán đăng ký | — | `Active`, bắt đầu lúc thanh toán (BR-9) |
| Gia hạn khi `Active` | giữ nguyên | `Scheduled`, bắt đầu từ `expires_at` hiện tại (BR-281) |
| Gia hạn khi `Grace` | `Ended` | `Active`, bắt đầu từ `expires_at` cũ (BR-11) |
| Gia hạn khi `Suspended` | `Ended` | `Active`, bắt đầu lúc thanh toán (BR-12) |
| Nâng cấp (chỉ `Active`, không có kỳ `Scheduled`) | `Ended` | `Active`, bắt đầu ngay, cùng `expires_at` (BR-13, BR-282) |
| Lịch chạy: tới `expires_at`, có kỳ `Scheduled` | `Ended` | `Scheduled → Active` |
| Lịch chạy: tới `expires_at`, không có kỳ `Scheduled` | `Grace` | — |
| Lịch chạy: tới `grace_ends_at` | `Suspended` | — |

**Tính tiền nâng cấp (BR-277)**, bằng số nguyên không giới hạn độ lớn (ví dụ `BigInteger`), làm tròn lên một lần:
`số tiền = ⌈(P_mới × D_cũ − P_cũ × D_mới) × R ÷ (D_mới × D_cũ)⌉`, với P là giá, D là số ngày thời hạn, R là số ngày còn lại (ngày lẻ tính tròn thành một ngày). Kết quả nhỏ hơn hoặc bằng 0 thì nâng cấp miễn phí, không tạo giao dịch.

**Kiểm số chỗ khi thao tác đồng thời:** trước khi đếm, khóa dòng tổ chức bằng `SELECT … FOR UPDATE` trên `organizations`. Luồng nâng cấp cũng khóa dòng này.

### 3.7 `payments`

Giữ bảng riêng (quan hệ một kỳ, nhiều giao dịch) để cổng thanh toán thật lắp vào được mà không đổi cấu trúc.

| Cột | Kiểu | B | Mặc định | Ràng buộc |
|---|---|---|---|---|
| `id` | uuid | ✓ | `uuidv7()` | — |
| `organization_id` | uuid | ✓ | — | Khóa ngoại |
| `kind` | text | ✓ | — | CHECK ∈ {`Registration`, `Renewal`, `Upgrade`} |
| `plan_id` | uuid | ✓ | — | Gói đang mua |
| `registration_id` | uuid | | — | CHECK có giá trị ⇔ `kind='Registration'` |
| `amount` | bigint | ✓ | — | Đồng, tính lúc khởi tạo. CHECK `> 0` |
| `status` | text | ✓ | `'Pending'` | CHECK ∈ {`Pending`, `Succeeded`, `Failed`} |
| `subscription_id` | uuid | | — | Kỳ sinh ra từ giao dịch. UNIQUE |
| `provider_reference` | text | | — | Mã giao dịch từ dịch vụ thanh toán |
| `failure_reason` | text | | — | Thông báo lỗi từ dịch vụ thanh toán |
| `paid_at` | timestamptz | | — | CHECK `status='Succeeded'` ⇔ có `paid_at` và `subscription_id` |

Luồng MVP: tạo `Pending` → gọi Mock Payment Service → thành công thì trong cùng transaction ghi `Succeeded`, tạo kỳ hiệu lực, gắn `subscription_id`; thất bại thì ghi `Failed`.

### 3.8 `organization_suspensions`

| Cột | Kiểu | B | Ràng buộc |
|---|---|---|---|
| `id` | uuid | ✓ | — |
| `organization_id` | uuid | ✓ | Khóa ngoại |
| `started_at` | timestamptz | ✓ | — |
| `ended_at` | timestamptz | | Trống = đang khóa. CHECK `> started_at` |
| `reason` | varchar(1000) | ✓ | Bắt buộc (BR-271). CHECK không rỗng |

Chỉ mục: UNIQUE `(organization_id)` WHERE `ended_at IS NULL`. `organizations.status='Suspended'` và dòng đang mở được ghi trong cùng transaction. Subscription vẫn trôi ngày khi tổ chức bị khóa (BR-283).

### 3.9 `platform_settings`

Một dòng, mỗi tham số một cột có kiểu riêng. Ép một dòng bằng `CREATE UNIQUE INDEX … ON platform_settings ((true))`, vẫn giữ khóa chính `uuid`.

| # | Cột | Kiểu, đơn vị | Mặc định | CHECK |
|---|---|---|---|---|
| 1 | `pending_registration_ttl_hours` | integer, giờ | 168 | > 0 |
| 2 | `subscription_grace_days` | integer, ngày | 7 | > 0 |
| 3 | `organizer_read_only_days` | integer, ngày | 30 | > 0 |
| 4 | `usage_warning_threshold_percent` | integer, % | 80 | 1–100 |
| 5 | `reading_speed_words_per_minute` | integer, từ/phút | 200 | > 0 |
| 6 | `study_minutes_per_day` | integer, phút | 60 | > 0 |
| 7 | `duration_gap_threshold_percent` | integer, % | 20 | > 0 |
| 8 | `video_completion_percent` | integer, % | 90 | 1–100 |
| 9 | `report_handling_days` | integer, ngày | 7 | > 0 |
| 10 | `instructor_violation_threshold` | integer, lần | 3 | > 0 |
| 11 | `evaluation_form_days` | integer, ngày | 14 | > 0 |
| 12 | `default_peer_review_cycle_days` | integer, ngày | 7 | > 0 |
| 13 | `default_peer_review_deadline_days` | integer, ngày | 3 | > 0 |
| 14 | `peer_review_reminder_hours` | integer, giờ | 24 | > 0 |
| 15 | `default_max_consecutive_attempts` | integer, lượt | 3 | > 0 |
| 16 | `default_lockout_hours` | integer, giờ | 24 | > 0 |
| 17a | `max_video_size_bytes` | bigint, byte | 2147483648 | > 0 |
| 17b | `max_video_duration_minutes` | integer, phút | 120 | > 0 |
| 17c | `max_reading_size_bytes` | bigint, byte | 52428800 | > 0 |
| 17d | `allowed_video_mime_types` | text[] | `{video/mp4}` | `cardinality >= 1` |
| 17e | `allowed_reading_mime_types` | text[] | `{application/pdf}` | `cardinality >= 1` |
| 18 | `max_link_resends_per_24h` | integer, lần | 5 | > 0 |
| 19 | `invitation_link_ttl_days` | integer, ngày | 7 | > 0 |
| 20 | `subscription_reminder_days` | integer[], ngày | `{7,1}` | `cardinality >= 1 AND 0 < ALL(...)` |

Phân phối: service khác giữ bản sao cục bộ, cập nhật qua event `PlatformSettingsChanged`, gọi REST một lần lúc khởi động. Theo BR-269, bên dùng chép giá trị vào bản ghi của mình lúc tạo.

### 3.10 `outbox_events`

| Cột | Kiểu | B | Ghi chú |
|---|---|---|---|
| `id` | uuid | ✓ | Mã event để bên nhận lọc trùng; sắp theo `id` là sắp theo thời gian |
| `aggregate_type` | text | ✓ | `Organization`, `User`, `Subscription`, `PlatformSettings` |
| `aggregate_id` | uuid | ✓ | Key của message Kafka (giữ thứ tự theo đối tượng) |
| `event_type` | text | ✓ | Ví dụ `OrganizationSuspended` |
| `organization_id` | uuid | | Trống với event cấp nền tảng |
| `payload` | jsonb | ✓ | — |
| `occurred_at` | timestamptz | ✓ | Thời điểm nghiệp vụ xảy ra |
| `published_at` | timestamptz | | Trống = chưa gửi |

Chỉ mục: INDEX `(id)` WHERE `published_at IS NULL`. Relay hỏi định kỳ khoảng 1 giây, dùng `FOR UPDATE SKIP LOCKED` khi chạy nhiều bản. Dòng đã gửi xóa sau 7 ngày.

**Liên kết chứa mã bí mật:** relay xóa trường liên kết khỏi `payload` ngay sau khi gửi; topic email giữ message 24 giờ; notification-service không lưu liên kết gốc.

| Event | Bên nhận | Căn cứ |
|---|---|---|
| `OrganizationSuspended`, `OrganizationReinstated` (kèm `id` lần khóa, `started_at`, `ended_at`) | learning | BR-46, BR-47 |
| `UserDeactivated`, `UserReactivated` | learning, assessment, identity | BR-38, BR-39 |
| `UserDeleted` | identity, learning | BR-37 |
| `SubscriptionStatusChanged` | notification, learning, identity | BR-15–BR-18 |
| `PlatformSettingsChanged` | course, learning, assessment, achievement-reporting | BR-268, BR-269 |
| Yêu cầu gửi email | notification | Tài liệu kiến trúc mục 6.5 |
| Bản ghi nhật ký | audit | BR-270, tài liệu kiến trúc mục 3.8 |

---

## 4. Ảnh chụp dữ liệu

**Chép từ service khác:** không có. Số chuỗi Course đã dùng, dung lượng đã dùng, số Course Instructor phụ trách và số vi phạm đều hỏi trực tiếp service sở hữu lúc cần.

**Chép trong nội bộ tenant-service:**

| Dữ liệu | Từ | Vào | Khi nào | Căn cứ |
|---|---|---|---|---|
| Giá, thời hạn, 4 giới hạn | gói | `registrations` | tạo đăng ký | BR-275 |
| Như trên | `registrations` | `subscriptions` | thanh toán đăng ký | BR-9, BR-275 |
| Như trên | gói (cấu hình hiện tại) | `subscriptions` | thanh toán gia hạn, nâng cấp | BR-2, BR-274 |
| Số tiền phải trả | tính toán | `payments.amount` | khởi tạo giao dịch | BR-275, BR-277 |
| Thời hạn chờ thanh toán | tham số 1 | `registrations.expires_at` | tạo đăng ký | BR-7, BR-269 |
| Hạn liên kết | tham số 19 | `account_tokens.expires_at` | phát liên kết | BR-278, BR-269 |
| Số ngày ân hạn | tham số 2 | `subscriptions.grace_ends_at` | vào `Grace` | BR-15, BR-269 |
| 30 ngày chỉ xem | tham số 3 | `subscriptions.read_only_ends_at` | vào `Suspended` | BR-17, BR-269 |

**Service khác lấy từ tenant-service:**
- `user_id` làm tham chiếu logic. Họ tên và email hỏi lúc cần, trừ Certificate chốt họ tên lúc cấp (BR-219, BR-220).
- `max_course_chains`, `max_storage_bytes`: course-service hỏi **lúc kiểm**, không chép (đổi ngay khi nâng cấp).
- Tham số nền tảng: bản sao cục bộ qua `PlatformSettingsChanged`.
- Mốc tạm khóa: learning-service nhận qua event để dời hạn (BR-47).
- Múi giờ tổ chức: learning và assessment hỏi lúc tạo mốc, lưu thành thời điểm tuyệt đối; đổi múi giờ không phát event (BR-44).

---

## 5. Những gì cố ý không làm

Mọi mục dưới đây khi cần đều thêm được bằng migration loại "thêm vào" (thêm bảng, thêm cột, thêm chỉ mục), trừ mục cuối.

| Không làm | Lý do | Thêm lại khi |
|---|---|---|
| Chỉ mục phụ trên `organizations`, gợi ý đơn vị, lịch chạy trên `subscriptions`, lịch sử tạm khóa | Bảng nhỏ, quét toàn bảng đủ nhanh | Quy mô lớn |
| Cột người thực hiện (`deactivated_by`, `suspended_by`…), lý do gỡ khóa | Đã có trong audit log (BR-270) | Màn hình cần đọc thẳng |
| `last_login_at` | Thuộc identity-service | — |
| CHECK định dạng email bằng biểu thức chính quy | Dễ chặn nhầm; API kiểm | — |
| Cột mô tả gói, cột tiền tệ, chụp tên gói | Không quy tắc nào cần | Bán đa tiền tệ, hiển thị lịch sử tên gói |
| Bảng import, nhật ký gửi lại, lịch sử tham số | Xử lý không cần lưu trạng thái, hoặc không có quy tắc đòi | Có yêu cầu mới |
| Bảng `departments` | BR-279 chọn chữ tự do | Cần danh mục đơn vị |
| Cột số lần thử, lỗi gần nhất trên outbox; Debezium | Log đủ dùng; tránh thêm hạ tầng | Cần giám sát relay |
| Bảng `memberships` | BR-30: một tài khoản thuộc đúng một tổ chức | **Chi phí cao**: chỉ cần khi đổi mô hình cho một người thuộc nhiều tổ chức, kéo theo đổi BR-30, identity và mọi service |

---

## 6. Việc tiếp theo

- Sinh migration SQL (Flyway) cho 10 bảng, theo yêu cầu riêng.
- Seed: một dòng `platform_settings` với giá trị mặc định ở mục 3.9; tài khoản Admin đầu tiên (không có Use Case tạo Admin).
