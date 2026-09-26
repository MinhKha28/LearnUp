# AGENTS.md — LearnUP web (`frontend/web`)

Nguồn quy tắc duy nhất cho mọi AI (Claude, Codex…) và người làm việc trong thư mục này. File này chỉ ghi quy tắc và đường dẫn; chi tiết nằm trong `docs/`. Nếu code và file này lệch nhau, báo lại thay vì tự chọn một bên.

## 1. Stack và lệnh

React 18 + TypeScript 5 (strict) + Vite 5 · React Router 6 (bật future flags v7) · Axios · i18next/react-i18next · CSS Modules · Radix UI (Dialog, DropdownMenu, Tooltip) · lucide-react · Vitest + Testing Library + happy-dom · ESLint 9 (flat) · Stylelint · Prettier. Kiểu dùng chung lấy từ `@learnup/ts-common` (`libraries/ts-common`).

Setup lần đầu — `ts-common` được cài qua `file:` và dùng bản build `dist/`, nên phải build trước:

```bash
cd libraries/ts-common && npm install && npm run build
cd ../../frontend/web && npm install && cp .env.example .env
```

| Việc                      | Lệnh                                                           |
| ------------------------- | -------------------------------------------------------------- |
| Dev server (:5173)        | `npm run dev`                                                  |
| Lint (ESLint + Stylelint) | `npm run lint` (`lint:js`, `lint:css` chạy riêng được)         |
| Test                      | `npm test`                                                     |
| Typecheck                 | `npm run typecheck`                                            |
| Build                     | `npm run build`                                                |
| Format                    | `npm run format` (sửa) · `npm run format:check` (chỉ kiểm tra) |

Biến môi trường (`.env.example`): `VITE_API_BASE_URL` (Gateway, mặc định `http://localhost:8080`), `VITE_MILESTONE` (1 | 2 | 3). Muốn làm milestone sau thì đặt trong `.env.local`, không commit.

Frontend chỉ gọi API Gateway, không bao giờ tự gửi header `X-User-ID`, `X-Organization-ID`, `X-User-Role`. Tenant luôn là `organizationId`. Kiểm tra role ở frontend chỉ để ẩn/hiện giao diện; phân quyền thật do backend.

## 2. Cấu trúc thư mục — code mới đặt ở đâu

```text
src/
├── app/            routes.tsx, navigation.ts (menu + milestone), App, router
├── auth/           AuthProvider, useAuth, ProtectedRoute, RoleRoute, authApi, authStorage
├── components/ui/  component nền dùng chung (Button, TextField, Modal…) — export qua index.ts
├── components/layout/  AppLayout, AuthLayout, PublicLayout, Sidebar, UserMenu…
├── config/         env.ts, milestone.ts, routes.ts (path dùng chung)
├── features/<tên>/ (chưa có — tạo khi làm màn đầu tiên của tính năng)
│   ├── api/        hàm gọi API + dữ liệu giả của tính năng
│   ├── types/      kiểu dữ liệu của tính năng
│   ├── components/ component chỉ dùng trong tính năng
│   └── pages/      trang gắn vào route
├── i18n/           khởi tạo i18next, resources.ts (đăng ký namespace)
├── locales/{vi,en}/<namespace>.json
├── lib/            tiện ích thuần (cx, format)
├── pages/          trang hệ thống: Login, NotFound, Unauthorized, Placeholder
├── services/       apiClient.ts (axios, unwrap, getApiErrorMessage)
├── styles/         tokens.css, base.css, index.css
└── dev/            trang /dev/ui (chỉ có khi DEV, không vào bản build)
tests/              mọi test; thư mục con ui/, layout/…; helper authMock.ts, routerFuture.ts
docs/               design-tokens.md, glossary.md, use-cases/
.design-refs/       ảnh thiết kế (không commit — xem §12)
```

## 3. Quy ước code

- Chỉ **named export**. Không `export default`.
- Component viết dạng `export const Foo: React.FC<FooProps> = (…) => …`; props khai báo `export interface FooProps`.
- Import nội bộ dùng alias `@/…` (trỏ tới `src/`). Không viết đuôi `.js`/`.ts` trong import.
- Component điều khiển (input, button, select, checkbox…) bọc `forwardRef` và nhận toàn bộ thuộc tính HTML gốc (xem `components/ui/TextField.tsx`).
- TypeScript strict, không `any`; chạy `npm run format` trước khi commit (Prettier: nháy đơn, 100 cột, LF).

## 4. Style

- Chỉ dùng **CSS Modules** (`Foo.module.css` cạnh `Foo.tsx`), class camelCase. Không Tailwind, không inline style cho giá trị thiết kế.
- Chỉ dùng **token semantic** (`var(--color-text)`, `var(--space-…)`…). Không dùng primitive (`--color-slate-500`) hay giá trị cứng.
- Stylelint chặn giá trị cứng cho màu, cỡ chữ, weight, line-height, radius, shadow, z-index, gap, margin, padding trong `*.module.css`. Không tắt rule để lách.
- Toàn bộ token, quyết định Q1–Q13 và mâu thuẫn M1–M19: `docs/design-tokens.md`. Thêm/sửa token thì sửa cả `src/styles/tokens.css` và doc trong cùng commit.

## 5. Component

- Bắt buộc dùng component trong `src/components/ui` (và `components/layout` cho khung trang). Không tự dựng lại nút, input, modal… bằng thẻ HTML thô.
- Cần **component mới** hoặc **variant mới** (ví dụ thêm màu nút, cỡ mới): **DỪNG và đề xuất** (tên, props, lý do, ảnh tham chiếu), chờ duyệt. Không tự tạo.
- Component dùng chung mới (khi đã duyệt) phải được export trong `index.ts`, có mục trên `/dev/ui` và có test trong `tests/ui/`.

## 6. i18n

- Không có chữ hiển thị literal trong JSX (ESLint `i18next/no-literal-string` chặn). Mọi chữ qua `t()`, kể cả `aria-label`, `alt`, `title`, placeholder.
- Namespace hiện có: `common`, `auth`, `errors`, `nav`. Tính năng mới tạo namespace riêng, đăng ký trong `src/i18n/resources.ts`.
- Key đặt theo màn hình: `<màn>.<khối>.<phần>` (ví dụ `instructors.list.emptyTitle`). Không đặt key theo câu chữ.
- Luôn thêm **cả `vi` và `en`** cùng lúc; `tests/i18n.test.ts` fail nếu hai bên lệch key. Mặc định là `vi`.
- Thuật ngữ theo `docs/glossary.md`. Thuật ngữ chưa có trong bảng: đề xuất thêm vào bảng trước.
- Ngày giờ, số: dùng `src/lib/format.ts`, không tự format.

## 7. Trạng thái trang và accessibility

- Mỗi trang có đủ **loading** (`Spinner`/`LoadingScreen`), **empty** (`EmptyState`), **error** (`Alert` + thông điệp từ `getApiErrorMessage`, kèm cách thử lại khi hợp lý).
- Mỗi trang có đúng một `h1`; thứ bậc heading không nhảy cấp.
- Mọi control có label (`label` của TextField/Select/Checkbox, `aria-label` cho IconButton). Lỗi field gắn qua prop `error` (tự đặt `aria-invalid`, `aria-describedby`).
- Focus luôn thấy được (không bỏ outline); modal giữ focus bên trong và trả focus khi đóng; thao tác được bằng bàn phím.
- Không truyền đạt thông tin **chỉ bằng màu**: trạng thái có chữ hoặc icon đi kèm.

## 8. API và dữ liệu

- Chỉ gọi qua `apiClient` (`src/services/apiClient.ts`); đã tự gắn token và refresh khi 401.
- Lấy payload bằng `unwrap(response)`; hiển thị lỗi bằng `getApiErrorMessage(err, fallback?)` (dịch `errors:<CODE>` nếu có). Mã lỗi mới → thêm vào `locales/*/errors.json`.
- Kiểu response lấy từ `@learnup/ts-common`: `ApiResponse<T>`, `PageResponse<T>`, `ApiError`, `UserRole`. Không tự khai báo lại.
- Dữ liệu giả (khi backend chưa có) đặt trong `features/<tên>/api/`, **đúng kiểu** `ApiResponse<T>` / `PageResponse<T>` — dựng bằng `createSuccessResponse`, `createPageResponse`, `createErrorResponse` của ts-common — để thay bằng API thật không phải sửa trang.

## 9. Routing

- Menu và route theo role khai báo **một chỗ**: `NAVIGATION` trong `src/app/navigation.ts` (`labelKey` thuộc namespace `nav`, `path`, `icon`, `useCase`, `availableFrom`). Mục đầu tiên của mỗi role là trang chủ của role.
- `availableFrom` > `VITE_MILESTONE` thì mục bị ẩn và route trả 404. Không xóa mục của milestone sau để "ẩn".
- Mỗi khu vực role được bọc `RoleRoute` (403 nếu sai role) bên trong `ProtectedRoute`. Path dùng chung (login, profile…) ở `src/config/routes.ts`.
- Khi làm xong một màn, thay `PlaceholderPage` của mục đó trong `src/app/routes.tsx` bằng trang thật.

## 10. Test

- Mọi test đặt trong `tests/` (không đặt cạnh source). Mock auth bằng `tests/authMock.ts`; router test dùng `tests/routerFuture.ts`.
- Test **hành vi** người dùng thấy (role, label, text qua Testing Library), không test class CSS hay chi tiết cài đặt.
- **Số test không được giảm.** Sửa hành vi thì sửa test; xóa test chỉ khi xóa tính năng và phải nói rõ.

## 11. Git

- Làm trên nhánh `fe/<việc>` (ví dụ `fe/instructor-list`). **Không commit thẳng** vào `fe/develop` hay `main`.
- Commit theo Conventional Commits, **tiếng Anh**, scope `web`: `feat(web): …`, `fix(web): …`, `chore(web): …`, `docs(web): …`.
- Trước khi commit: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build` đều pass.
- AI chỉ commit/push khi được yêu cầu.

### CI và duyệt PR

- PR vào `fe/develop`/`main` phải **xanh CI** (`.github/workflows/frontend-web.yml`: build ts-common → lint, format:check, typecheck, test, build) mới được merge. Node theo `.nvmrc`.
- Thay đổi ở các đường dẫn trong `.github/CODEOWNERS` (styles, `components/ui`, `components/layout`, `AGENTS.md`, `docs/design-tokens.md`, `docs/glossary.md`, config ESLint/Stylelint) cần **leader duyệt**.

## 12. Dựng màn hình từ ảnh `.design-refs/`

Cấu trúc ảnh:

```text
.design-refs/Inter<n>/B<nn>_<tên-đợt>/<UC>_<tên-màn>[__<trạng thái>].png
                                     notes.txt   (ghi chú của đợt, nếu có)
.design-refs/B00_app-shell/shell_<role>__<UC>.png   (khung app — ngoại lệ, nằm ở gốc)
```

- Tên file bắt đầu bằng mã UC (hoặc `shell_` cho ảnh khung app); trạng thái nếu có đặt sau `__`. Ví dụ: `Inter1/B01_onboarding-auth/UC02.1_GUEST_Registration__step-4_payment.png`, `B00_app-shell/shell_admin__UC43.png`.
- `B00_app-shell/` nằm ở gốc `.design-refs/` (ngoại lệ, không thuộc `Inter<n>`).
- Nếu cùng một màn hình có nhiều file (ví dụ hậu tố `" 1"`), **DỪNG và hỏi** dùng bản nào.
- Thư mục này bị gitignore, không commit ảnh.

Đặc tả Use Case:

- Mỗi đợt đưa đặc tả UC liên quan vào `docs/use-cases/UC<nn>-<tên>.md` (luồng chính, luồng phụ/lỗi, trường dữ liệu, quy tắc nghiệp vụ) theo mẫu trong `docs/use-cases/README.md`.
- Report trên Drive là bản gốc; khi UC đổi phải cập nhật cả hai.
- Nếu màn hình cần làm chưa có file đặc tả, **DỪNG và yêu cầu**.

Quy trình — **bắt buộc theo thứ tự:**

1. **Đọc**: mọi ảnh của màn (kể cả các trạng thái `__…`), `notes.txt`, và file đặc tả `docs/use-cases/UC<nn>-….md` tương ứng.
2. **Phân tích — rồi DỪNG chờ duyệt**, chưa viết code. Báo cáo gồm:
   - Bố cục: vùng, lưới, thứ tự khối, hành vi ở màn hẹp.
   - Component dùng lại từ `components/ui` / `components/layout`.
   - Component hoặc variant cần thêm (kèm lý do) — theo §5.
   - Bảng điều chỉnh: **Trong ảnh → Trong code → Lý do**.
   - Mâu thuẫn giữa ảnh và Use Case.
   - Câu hỏi cần người duyệt trả lời.
3. **Code** sau khi được duyệt.
4. **Kiểm tra**: `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`.

Nguyên tắc quy đổi ảnh → code:

- Ảnh là **tham khảo bố cục**, không phải thông số pixel.
- Mọi giá trị làm tròn về **token gần nhất**.
- Giữ **thứ bậc**: cái lớn/đậm/nổi hơn trong ảnh vẫn lớn/đậm/nổi hơn trong code, không đảo.
- Cùng vai trò thì cùng style, kể cả khi ảnh vẽ lệch nhau.
- Được tự sửa lỗi căn lề, tương phản, chính tả — nhưng phải liệt kê trong bảng điều chỉnh.
- **Không** tự thêm/bớt field, cột, nút, bước — phải hỏi.
- Ảnh và Use Case mâu thuẫn: **Use Case thắng**, ghi lại trong báo cáo.
- Chỉ làm thao tác thuộc milestone hiện tại, nhưng bố cục phải chừa chỗ cho thao tác của milestone sau.

## 13. Tài liệu liên quan

- `docs/design-tokens.md` — token, typography, spacing, layout, quyết định thiết kế.
- `docs/glossary.md` — thuật ngữ vi/en.
- `docs/use-cases/` — đặc tả Use Case theo đợt (mẫu trong `README.md` của thư mục).
- `README.md` — tổng quan, xác thực, cấu trúc.
- `../../docs/` — kiến trúc hệ thống, ADR, quy ước API (`docs/api/conventions.md`).
