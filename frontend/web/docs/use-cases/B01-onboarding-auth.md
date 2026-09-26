# Đợt B01 — Onboarding & Auth (Inter 1)

> Nguồn: danh sách Use Case trong Report. Ràng buộc trường dữ liệu CHƯA chốt (chưa có database):
> đặt tạm trong file schema của từng form và đánh dấu `TODO(spec)`; không tự suy diễn thêm quy tắc nghiệp vụ.
> Ảnh: `.design-refs/Inter1/B01_onboarding-auth/`.

## Phạm vi theo milestone

| UC     | Tên                      | Milestone | Ghi chú                                             |
| ------ | ------------------------ | --------- | --------------------------------------------------- |
| UC01   | Xem Subscription Plan    | 1         |                                                     |
| UC02   | Đăng ký Organization     | 1         |                                                     |
| UC02.1 | Thực hiện thanh toán     | 1         | Mock Payment                                        |
| UC02.2 | Thanh toán lại đăng ký   | 2         | Chưa làm; bố cục chừa chỗ                           |
| UC03   | Xác thực email Organizer | 1         |                                                     |
| UC03.1 | Gửi lại liên kết đăng ký | 2         | Chưa làm; bố cục chừa chỗ                           |
| UC04   | Kích hoạt tài khoản      | 1         | Không có ảnh form; dựng bằng AuthLayout + TextField |
| UC05   | Đăng nhập                | 1         |                                                     |
| UC05.1 | Đăng nhập bằng Google    | 3         | Chưa làm; không render nút; bố cục chừa chỗ         |

## UC01 — Xem Subscription Plan

- Actor: Guest.
- Hiển thị danh sách gói đang cung cấp: tên, giá, thời hạn sử dụng, 4 giới hạn (số Learner, số Instructor, số Course, dung lượng lưu trữ).
- Không có gói nào đang mở → trạng thái rỗng (ảnh `UC01_GUEST_No_Available_Plans`).
- Chọn một gói → bắt đầu UC02 với gói đã chọn.

## UC02 — Đăng ký Organization (include UC02.1)

- Actor: Guest. Actor phụ: Email Service.
- Bắt buộc chọn gói trước, vì gói quyết định số tiền và giới hạn của tổ chức.
- Bước khai báo tổ chức: tên tổ chức, mã số thuế, địa chỉ, thông tin liên hệ.
- Bước khai báo tài khoản Organizer: họ tên, email, mật khẩu.
- Gửi thành công: hệ thống tạo đăng ký ở trạng thái Pending Payment và tài khoản Organizer chưa xác thực email; gửi email chứa liên kết mở lại đăng ký để thanh toán; chuyển sang UC02.1.
- Thanh toán thành công (UC02.1) → gửi email chứa liên kết xác thực tài khoản Organizer.
- Quá thời hạn hiệu lực → đăng ký và tài khoản Organizer chưa xác thực bị hủy (ảnh `UC02_GUEST_Registration_Expired`).
- Lỗi khi gửi form (ảnh `...__step-3_error`): hiển thị lỗi theo từng trường nếu server trả về, còn lại dùng Alert.

## UC02.1 — Thực hiện thanh toán

- Actor: Guest (và Organizer ở UC khác). Actor phụ: Mock Payment Service.
- Gửi yêu cầu thanh toán tới dịch vụ mô phỏng, nhận kết quả: thành công, thất bại, đang xử lý (ảnh `step-4_payment`, `payment-fail`, `payment-pending`, `step-5_payment-completed`).
- Thất bại: cho phép thử lại ngay trên màn hình.
- Đang xử lý: hiển thị trạng thái chờ, không cho gửi lặp.

## UC03 — Xác thực email Organizer

- Actor: Guest → sau khi xác thực thành Organizer.
- Mở liên kết xác thực trong email → kích hoạt tài khoản (ảnh `UC03-UC04_GUEST_Account-Activated`).
- Liên kết không hợp lệ hoặc hết hạn → ảnh `UC03_GUEST_Email_Verification_Error`; chỗ đặt nút "Gửi lại liên kết" (UC03.1, milestone 2) được chừa sẵn nhưng chưa render.

## UC04 — Kích hoạt tài khoản

- Actor: Instructor, Learner (được Organizer mời).
- Mở liên kết trong email mời → đặt mật khẩu (mật khẩu, nhập lại mật khẩu) → kích hoạt.
- Thành công: dùng chung màn hình kết quả với UC03.
- Liên kết không hợp lệ/hết hạn: dùng cùng kiểu màn hình lỗi với UC03.

## UC05 — Đăng nhập

- Actor: Admin, Organizer, Instructor, Learner.
- Nhập email và mật khẩu.
- Trước khi cấp quyền, hệ thống kiểm tra trạng thái tài khoản, trạng thái Subscription và Organization.
- Lỗi cần hiển thị (cùng một Alert trên form, khác nội dung): sai thông tin đăng nhập (ảnh `UC05_GUEST_Sign_In_Invalid_Credentials`); tài khoản bị vô hiệu hóa; email chưa xác thực; Subscription/Organization không còn hiệu lực. Backend hiện chỉ trả mã chung (UNAUTHORIZED) → hiển thị message server cho tới khi có mã chi tiết.
- Thành công: chuyển tới trang chủ theo role (getPostLoginPath).
- Ảnh `UC05.1_GUEST_Google_Account_Not_Found` thuộc UC05.1 (milestone 3): chưa làm.
