# Hợp đồng API — LearnUP web

Ghi lại mọi endpoint frontend gọi qua API Gateway: endpoint đã có ở backend và endpoint **giả định** mà frontend đang dùng mock (MSW) trong lúc chờ backend. Mục đích: khi backend làm xong, đối chiếu một chỗ là biết phải sửa gì.

## Quy tắc

- Mỗi endpoint một mục, nhóm theo feature (trùng tên file handler trong `src/mocks/handlers/<feature>.ts`).
- Mỗi mục có **Trạng thái**, một trong hai:
  - **Giả định — chờ backend xác nhận**: frontend tự đặt, đang chạy bằng mock MSW (bật với `VITE_USE_MOCKS=true`).
  - **Đã có ở backend**: ghi service và controller. Mock (nếu có) chỉ là nhóm tùy chọn trong `VITE_MOCKS_INCLUDE`.
- Response luôn theo envelope `ApiResponse<T>` của `@learnup/ts-common` (`{ success: true, data }` hoặc `{ success: false, error: { code, message, details? } }`). Danh sách phân trang dùng `PageResponse<T>` (`items, page, size, totalElements, totalPages, first, last`).
- Lỗi validate của backend: `VALIDATION_ERROR` với `details` dạng `"<field>: <message>"` (java-common `GlobalExceptionHandler`). Frontend đưa vào đúng field bằng `applyServerFieldErrors` (`src/lib/form`).
- Mã lỗi chuẩn (`STANDARD_ERROR_CODES`): `UNAUTHORIZED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `BAD_REQUEST`, `INTERNAL_ERROR`. Mã riêng của nghiệp vụ ghi rõ trong mục và thêm bản dịch vào `src/locales/*/errors.json`.
- Kiểu `T` khai báo trong `src/features/<feature>/types/`. Mock trả đúng kiểu đó (dựng bằng `createSuccessResponse`, `createPageResponse`, `createErrorResponse`).
- Khi backend xác nhận: sửa mục cho khớp, đổi trạng thái, chuyển handler từ `defaultHandlers` sang `optionalHandlers` (hoặc xóa), chạy lại test.

## Mẫu một mục

````markdown
### `METHOD /api/<path>` — <mô tả ngắn>

- **Trạng thái:** Giả định — chờ backend xác nhận | Đã có ở backend (<service>, <Controller>)
- **Use Case:** UC<nn>
- **Quyền:** Public | <role>
- **Mock:** `src/mocks/handlers/<feature>.ts` (mặc định | tùy chọn `<group>`) | không có

**Request**

- Path / query: `<tên>`: <kiểu> — <ý nghĩa>
- Body:

```ts
interface <Tên>Request {
  field: string; // TODO(spec): ràng buộc chưa chốt
}
```

**Response** — `ApiResponse<<Kiểu>>` hoặc `ApiResponse<PageResponse<<Kiểu>>>`

```ts
interface <Kiểu> {
  id: string;
}
```

**Lỗi**

| HTTP | `error.code`       | Khi nào                   | Frontend hiển thị             |
| ---- | ------------------ | ------------------------- | ----------------------------- |
| 400  | `VALIDATION_ERROR` | <field không hợp lệ>      | Lỗi dưới field, còn lại Alert |
| 409  | `CONFLICT`         | <ví dụ: email đã tồn tại> | Alert                         |
````

---

## Auth (`src/mocks/handlers/auth.ts`, nhóm tùy chọn `auth`)

### `POST /api/auth/login` — Đăng nhập

- **Trạng thái:** Đã có ở backend (identity-service, `AuthController`)
- **Use Case:** UC05
- **Quyền:** Public
- **Mock:** tùy chọn `auth`

**Request** — `{ username: string; password: string }` (`username` nhận username hoặc email).

**Response** — `ApiResponse<AuthTokens>`: `{ accessToken, refreshToken, tokenType, expiresIn }` (`src/types/auth.ts`).

**Lỗi**

| HTTP | `error.code`       | Khi nào                                                           | Frontend hiển thị               |
| ---- | ------------------ | ----------------------------------------------------------------- | ------------------------------- |
| 400  | `VALIDATION_ERROR` | Thiếu username/password (`details`: `username: …`, `password: …`) | Lỗi dưới field                  |
| 401  | `UNAUTHORIZED`     | Sai thông tin đăng nhập ("Invalid username or password")          | Alert với message server (UC05) |

> **Câu hỏi mở (UC05):** form hiện nhãn "Email" nhưng vẫn gửi `username` và không kiểm tra định dạng email, để tài khoản chỉ có username vẫn đăng nhập được. **Chờ backend xác nhận** có bỏ đăng nhập bằng username (chỉ nhận email) không; nếu bỏ thì thêm kiểm tra email trong `src/features/auth/loginSchema.ts`.

> UC05 cần phân biệt: tài khoản bị vô hiệu hóa, email chưa xác thực, Subscription/Organization hết hiệu lực. Backend chưa có mã riêng — **chờ backend bổ sung**.

### `POST /api/auth/refresh` — Làm mới token

- **Trạng thái:** Đã có ở backend (identity-service, `AuthController`)
- **Quyền:** Public (gửi refresh token)
- **Mock:** tùy chọn `auth`

**Request** — `{ refreshToken: string }`. **Response** — `ApiResponse<AuthTokens>`.

**Lỗi** — 401 `UNAUTHORIZED` ("Invalid, expired, or revoked refresh token") → `apiClient` xóa token, phát `learnup:auth-expired`, về `/login`.

### `GET /api/users/me` — Người dùng hiện tại

- **Trạng thái:** Đã có ở backend (identity-service, `UserController`)
- **Quyền:** Mọi role đã đăng nhập
- **Mock:** tùy chọn `auth`

**Response** — `ApiResponse<AuthUser>` (`src/types/auth.ts`). `organizationName` chưa có trong response thật.

**Lỗi** — 401 `UNAUTHORIZED` → `apiClient` thử refresh một lần.
