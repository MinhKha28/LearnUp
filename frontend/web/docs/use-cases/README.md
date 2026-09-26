# Đặc tả Use Case — LearnUP web

Thư mục này chứa đặc tả các Use Case (UC) mà frontend cần dựng. Mỗi đợt thiết kế (`.design-refs/Inter<n>/B<nn>_…`) đưa đặc tả của các UC liên quan vào đây trước khi bắt đầu dựng màn hình.

- **Bản gốc** là report trên Drive. File ở đây là bản chép để người và AI đọc được ngay trong repo. Khi UC thay đổi, **cập nhật cả hai**.
- Màn hình cần làm mà chưa có file đặc tả: **DỪNG và yêu cầu** bổ sung, không đoán từ ảnh.
- Ảnh và đặc tả mâu thuẫn: **đặc tả thắng** (xem `AGENTS.md` §12).
- Thuật ngữ theo `docs/glossary.md`.

## Đặt tên file

```text
docs/use-cases/UC<nn>-<tên>.md
```

`<nn>` là mã UC (giữ nguyên số phụ nếu có, ví dụ `UC02.1`), `<tên>` viết kebab-case tiếng Anh. Ví dụ: `UC05-sign-in.md`, `UC02.1-organization-registration-payment.md`.

## Mẫu file

```markdown
# UC<nn> — <Tên Use Case>

- **Actor:** <Guest | Admin | Organizer | Instructor | Learner>
- **Milestone:** <1 | 2 | 3>
- **Ảnh thiết kế:** `.design-refs/Inter<n>/B<nn>_<tên-đợt>/UC<nn>_…png`
- **Nguồn:** <đường dẫn report trên Drive, mục/trang>
- **Cập nhật lần cuối:** <YYYY-MM-DD>

## Tiền điều kiện

- <Điều kiện phải đúng trước khi bắt đầu, ví dụ: người dùng đã đăng nhập với vai trò Organizer>

## Luồng chính

1. <Actor làm gì>
2. <Hệ thống phản hồi gì>
3. …

## Luồng phụ / lỗi

| Mã  | Tại bước | Điều kiện                 | Hệ thống phản hồi                       |
| --- | -------- | ------------------------- | --------------------------------------- |
| A1  | 2        | <ví dụ: email đã tồn tại> | <thông báo / chuyển hướng / trạng thái> |
| E1  | 3        | <ví dụ: lỗi mạng>         | <thông báo lỗi, cho phép thử lại>       |

## Trường dữ liệu

| Trường  | Kiểu   | Bắt buộc | Ràng buộc / định dạng          | Ghi chú                  |
| ------- | ------ | -------- | ------------------------------ | ------------------------ |
| <email> | string | Có       | <định dạng email, ≤ 255 ký tự> | <duy nhất toàn hệ thống> |

## Quy tắc nghiệp vụ

- **BR1:** <quy tắc, ví dụ: khóa học Tự chọn không có hạn hoàn thành>
- **BR2:** …

## Hậu điều kiện

- <Trạng thái hệ thống sau khi UC thành công>

## Ghi chú cho frontend

- <Thao tác thuộc milestone sau cần chừa chỗ trong bố cục, API liên quan, câu hỏi còn mở…>
```

## Mục bắt buộc

Mỗi file phải có đủ bốn mục: **Luồng chính**, **Luồng phụ / lỗi**, **Trường dữ liệu**, **Quy tắc nghiệp vụ**. Mục nào không áp dụng thì ghi "Không có" thay vì bỏ trống. Các mục còn lại (tiền/hậu điều kiện, ghi chú cho frontend) nên có khi report gốc có thông tin.
