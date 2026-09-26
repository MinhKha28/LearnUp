# Design tokens — LearnUP web

> **File này là nguồn chuẩn cho mọi màn hình.** Mã nguồn tương ứng: `src/styles/tokens.css` (token) và `src/styles/base.css` (font, reset, focus, reduced motion). Khi thay đổi token, sửa cả hai nơi trong cùng một commit.
>
> **Quy tắc bắt buộc:**
>
> - Component **chỉ dùng token semantic** (`--color-text`, `--color-primary`, …). Không dùng primitive (`--color-slate-500`…) hay mã hex trực tiếp.
> - Chỉ có theme sáng, khai báo trên `:root`. Chưa làm dark mode.
> - Cỡ chữ nhỏ nhất là 12px (`--text-caption`).
>
> Nguồn thiết kế: 19 ảnh 1440×1024 trong `.design-refs/B00_app-shell/` và `.design-refs/Inter1/B01_onboarding-auth/`. Phụ lục A ghi cách đo và các giá trị đo được.

---

## 0. Quyết định (chốt ngày 2026-09-26)

| #   | Chủ đề           | Quyết định                                                                                                                                                                                                                                     |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | App-shell        | **Hướng lai.** Lấy khung kiểu A (sidebar có section label), thêm icon cho nav item. Item active: nền amber-50, chữ slate-900 đậm, **vạch amber 3px bên trái**. Menu người dùng đặt trong header. **Header 1 dòng**, không có eyebrow tên role. |
| Q2  | Nút              | **Amber là primary duy nhất.** Chưa tạo biến thể slate-900. Bộ nút gồm: `primary`, `secondary` (outline), `ghost`, `danger`.                                                                                                                   |
| Q3  | Viền input       | Thêm primitive `--color-slate-450: #7f8ea3`. `--color-border-input` = slate-450, dùng cho input và nút outline. Card và divider vẫn dùng `--color-border` = slate-200.                                                                         |
| Q4  | Focus ring       | `--color-focus-ring` = amber-700 `#b45309`, dày 2px, offset 2px.                                                                                                                                                                               |
| Q5  | Cỡ chữ body      | `body` 14px/22. Thêm bậc `body-lg` 16px/26 cho nội dung đọc dài (lesson, reading, mô tả course). Input dùng 16px khi màn hình dưới 768px.                                                                                                      |
| Q6  | Weight           | Chỉ dùng 400, 600, 700.                                                                                                                                                                                                                        |
| Q7  | Header           | `--layout-header-height: 64px`. Tiêu đề trang (h1) đặt trong vùng nội dung.                                                                                                                                                                    |
| Q8  | Độ rộng          | `--layout-content-max-width: 1600px`; `--layout-form-max-width: 960px`.                                                                                                                                                                        |
| Q9  | Form auth        | `--layout-auth-form-width: 440px`.                                                                                                                                                                                                             |
| Q10 | Orange           | Bỏ. "Invitation expired" dùng màu warning.                                                                                                                                                                                                     |
| Q11 | Ngôn ngữ         | UI song ngữ vi/en, mặc định **vi**. Phần i18n làm ở commit riêng.                                                                                                                                                                              |
| Q12 | Navy             | Bỏ thang navy. Panel trang Sign in dùng slate-900/800/700 qua các token `--color-inverse-*`.                                                                                                                                                   |
| Q13 | Dark mode        | Chưa làm. Chỉ khai báo trên `:root`; component chỉ dùng token semantic để sau này thêm theme được.                                                                                                                                             |
| M   | Mâu thuẫn M1–M19 | Đồng ý toàn bộ đề xuất (xem mục 8). M17: bỏ nút "View plans" ở header public.                                                                                                                                                                  |

---

## 1. Màu

### 1.1 Primitive

Giá trị khớp bảng màu Tailwind v3, riêng `slate-450` là màu tự thêm (Q3). Bảng chỉ liệt kê các bậc có dùng. Khi cần thêm bậc mới, lấy đúng giá trị Tailwind và cập nhật file này.

| Bậc | `--color-slate-*` | `--color-amber-*` |
| --- | ----------------- | ----------------- |
| 50  | `#f8fafc`         | `#fffbeb`         |
| 100 | `#f1f5f9`         | `#fef3c7`         |
| 200 | `#e2e8f0`         | `#fde68a`         |
| 300 | `#cbd5e1`         | `#fcd34d`         |
| 400 | `#94a3b8`         | `#fbbf24`         |
| 450 | `#7f8ea3` (Q3)    | —                 |
| 500 | `#64748b`         | `#f59e0b`         |
| 600 | `#475569`         | `#d97706`         |
| 700 | `#334155`         | `#b45309`         |
| 800 | `#1e293b`         | `#92400e`         |
| 900 | `#0f172a`         | `#78350f`         |

| Nhóm    | Token                              | Giá trị                                 |
| ------- | ---------------------------------- | --------------------------------------- |
| Trắng   | `--color-white`                    | `#fff`                                  |
| Red     | `--color-red-50 / 100 / 600 / 700` | `#fef2f2 / #fee2e2 / #dc2626 / #b91c1c` |
| Emerald | `--color-emerald-50 / 700`         | `#ecfdf5 / #047857`                     |
| Blue    | `--color-blue-50 / 600`            | `#eff6ff / #2563eb`                     |

Các màu **đã bỏ:**

- Orange (Q10) và navy (Q12).
- emerald-600: không đạt tương phản, M8.
- red-600 dùng làm chữ trên nền red-50: không đạt, M9. red-600 vẫn giữ cho viền lỗi và nút danger.

### 1.2 Semantic

| Token                                | Primitive                                     | Dùng cho                                                                           |
| ------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `--color-background`                 | slate-50                                      | Nền trang                                                                          |
| `--color-surface`                    | white                                         | Card, sidebar, header, input, menu                                                 |
| `--color-surface-muted`              | slate-100                                     | Header bảng, badge trung tính, avatar (kèm viền `--color-border`)                  |
| `--color-border`                     | slate-200                                     | Viền card, divider, viền sidebar và header (chỉ để trang trí)                      |
| `--color-border-input`               | slate-450                                     | Viền input, select, textarea, **nút secondary (outline)**                          |
| `--color-text`                       | slate-900                                     | Chữ chính, tiêu đề, nav active                                                     |
| `--color-text-muted`                 | slate-600                                     | Subtitle, mô tả, nav thường, chữ trong badge trung tính                            |
| `--color-text-subtle`                | slate-500                                     | Placeholder, meta, section label sidebar. **Chỉ đặt trên surface hoặc background** |
| `--color-primary`                    | amber-500                                     | Nền nút primary, stepper, progress, vạch nav active, gạch chân nav public          |
| `--color-primary-hover`              | amber-600                                     | Hover của nút primary                                                              |
| `--color-primary-foreground`         | slate-900                                     | Chữ trên nút primary. **Không bao giờ dùng chữ trắng** (chỉ đạt 2.15:1)            |
| `--color-primary-subtle`             | amber-50                                      | Nền nav item active                                                                |
| `--color-link`                       | blue-600                                      | Link, hành động dạng link trong bảng (M13)                                         |
| `--color-focus-ring`                 | amber-700                                     | `:focus-visible` (Q4)                                                              |
| `--color-danger`                     | red-600                                       | Nền nút danger                                                                     |
| `--color-danger-hover`               | red-700                                       | Hover của nút danger                                                               |
| `--color-danger-foreground`          | white                                         | Chữ trên nút danger                                                                |
| `--color-danger-bg / -fg`            | red-50 / red-700                              | Alert lỗi, badge lỗi                                                               |
| `--color-danger-border`              | red-600                                       | Viền input lỗi, chữ lỗi dưới field (trên nền surface), icon ✕                      |
| `--color-success-bg / -fg`           | emerald-50 / emerald-700                      | Badge Active/Available/Completed, callout thành công                               |
| `--color-warning-bg / -fg`           | amber-50 / amber-800                          | Callout và badge warning, "Invitation expired", badge đếm (M10, Q10)               |
| `--color-info-bg / -fg`              | blue-50 / blue-600                            | Callout thông tin, badge "Optional"                                                |
| `--color-inverse-surface`            | slate-900                                     | Nền panel trái trang Sign in (Q12)                                                 |
| `--color-inverse-surface-raised`     | slate-800                                     | Card ngoài trong panel                                                             |
| `--color-inverse-surface-strong`     | slate-700                                     | Card con, vòng số thứ tự trong panel                                               |
| `--color-inverse-text / -text-muted` | white / slate-300                             | Chữ trên nền inverse                                                               |
| `--color-overlay`                    | slate-900 ở độ mờ 50% (`rgb(15 23 42 / 50%)`) | Nền mờ phía sau modal                                                              |

### 1.3 Bảng tương phản của các cặp semantic cuối cùng

Tính theo công thức WCAG 2.x.

- **Chữ** cần ≥ 4.5:1 (AA).
- **Thành phần không phải chữ** cần ≥ 3:1 (WCAG 1.4.11), gồm viền control và focus ring.

⚠️ đánh dấu cặp đạt nhưng có điều kiện đi kèm.

**Chữ / nền**

| Cặp                                            | Tỉ lệ | Kết quả                                         |
| ---------------------------------------------- | ----- | ----------------------------------------------- |
| text / background                              | 17.06 | ✅                                              |
| text / surface                                 | 17.85 | ✅                                              |
| text / surface-muted                           | 16.30 | ✅                                              |
| text / primary-subtle (nav active)             | 17.22 | ✅                                              |
| text-muted / surface                           | 7.58  | ✅                                              |
| text-muted / background                        | 7.24  | ✅                                              |
| text-muted / surface-muted                     | 6.92  | ✅                                              |
| text-muted / primary-subtle                    | 7.31  | ✅                                              |
| text-subtle / surface                          | 4.76  | ✅                                              |
| text-subtle / background                       | 4.55  | ✅ vừa đủ                                       |
| text-subtle / surface-muted                    | 4.34  | ⚠️ **Không dùng cặp này**, thay bằng text-muted |
| primary-foreground / primary                   | 8.31  | ✅                                              |
| primary-foreground / primary-hover             | 5.60  | ✅                                              |
| danger-foreground / danger                     | 4.83  | ✅                                              |
| danger-foreground / danger-hover               | 6.47  | ✅                                              |
| link / surface                                 | 5.17  | ✅                                              |
| link / background                              | 4.94  | ✅                                              |
| danger-fg / danger-bg                          | 5.91  | ✅                                              |
| danger-border dùng làm chữ lỗi field / surface | 4.83  | ✅                                              |
| success-fg / success-bg                        | 5.21  | ✅                                              |
| warning-fg / warning-bg                        | 6.84  | ✅                                              |
| info-fg / info-bg                              | 4.75  | ✅                                              |
| inverse-text / inverse-surface                 | 17.85 | ✅                                              |
| inverse-text-muted / inverse-surface           | 12.02 | ✅                                              |
| inverse-text / inverse-surface-raised          | 14.63 | ✅                                              |
| inverse-text-muted / inverse-surface-raised    | 9.85  | ✅                                              |
| inverse-text / inverse-surface-strong          | 10.35 | ✅                                              |
| inverse-text-muted / inverse-surface-strong    | 6.97  | ✅                                              |

**Thành phần không phải chữ** (cần ≥ 3:1)

| Cặp                                          | Tỉ lệ | Kết quả                                                                                                                                                   |
| -------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| border-input / surface                       | 3.33  | ✅                                                                                                                                                        |
| border-input / background                    | 3.19  | ✅                                                                                                                                                        |
| border-input / surface-muted                 | 3.04  | ✅ vừa đủ                                                                                                                                                 |
| focus-ring / surface                         | 5.02  | ✅                                                                                                                                                        |
| focus-ring / background                      | 4.80  | ✅                                                                                                                                                        |
| focus-ring / surface-muted                   | 4.58  | ✅                                                                                                                                                        |
| focus-ring / primary-subtle                  | 4.84  | ✅                                                                                                                                                        |
| focus-ring / inverse-surface (panel Sign in) | 3.56  | ✅                                                                                                                                                        |
| danger-border / surface                      | 4.83  | ✅                                                                                                                                                        |
| border / surface                             | 1.23  | Chỉ để trang trí (card, divider), không bắt buộc 3:1. **Không dùng cho viền control**                                                                     |
| primary (vạch nav active 3px) / surface      | 2.15  | ⚠️ Dưới 3:1. Chấp nhận được vì trạng thái active còn được thể hiện bằng nền amber-50, chữ đậm và `aria-current="page"`. Vạch không phải dấu hiệu duy nhất |
| primary (progress) / surface-muted           | 1.96  | ⚠️ Thanh progress luôn phải kèm chữ phần trăm                                                                                                             |

---

## 2. Typography

**Font:** Inter, self-host qua `@fontsource/inter`, không gọi Google Fonts lúc chạy.

- Weight: 400 / 600 / 700.
- Subset: `latin` và `vietnamese`, khai báo bằng `unicode-range` trong `base.css`.
- Chữ tiếng Việt cần cả hai subset: `â ê ô à á …` nằm trong latin, còn `ă đ ơ ư ạ ệ ữ …` nằm trong vietnamese.

`--font-sans`: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
`--font-mono`: `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` (mã, ID)

| Vai trò   | `--text-*` | `--leading-*` | Weight                        | Tracking                              | Dùng cho                                              |
| --------- | ---------- | ------------- | ----------------------------- | ------------------------------------- | ----------------------------------------------------- |
| `display` | 36px       | 44px          | bold 700                      | `--tracking-tight` −0.02em            | H1 trang auth, public, đăng ký                        |
| `h1`      | 30px       | 38px          | bold 700                      | `--tracking-tight`                    | Tiêu đề trang trong app (nằm trong vùng nội dung, Q7) |
| `h2`      | 24px       | 32px          | bold 700                      | —                                     | Tiêu đề empty/result state, tiêu đề card lớn          |
| `h3`      | 18px       | 28px          | semibold 600                  | —                                     | Tiêu đề section, card, aside                          |
| `body-lg` | 16px       | 26px          | regular 400                   | —                                     | Nội dung đọc dài; input dưới 768px (Q5)               |
| `body`    | 14px       | 22px          | regular 400 (label, nút: 600) | —                                     | Nội dung mặc định, label, nav, bảng, nút              |
| `body-sm` | 13px       | 20px          | regular 400                   | —                                     | Helper text, meta, nhãn stepper                       |
| `caption` | 12px       | 16px          | semibold 600                  | `--tracking-wide` 0.04em khi viết hoa | Badge, eyebrow, header bảng (viết hoa, M15)           |

Weight token: `--weight-regular` 400, `--weight-semibold` 600, `--weight-bold` 700.

**Line-height:** chữ thân đặt ≥ 1.5 để dấu chồng của tiếng Việt (Ặ, Ẩ, ệ) không chạm dòng bên cạnh.

---

## 3. Spacing

Thang theo bội số 4px:

`--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-8` 32 · `--space-10` 40 · `--space-12` 48 · `--space-16` 64

| Ngữ cảnh                               | Token                                         |
| -------------------------------------- | --------------------------------------------- |
| Label → input                          | space-2                                       |
| Khoảng cách giữa các field             | space-4 – space-6                             |
| Padding card                           | space-5 (app), space-8 (form lớn)             |
| Khe giữa các card                      | space-5 / space-6                             |
| Padding ngang vùng nội dung            | space-8                                       |
| Padding ngang sidebar                  | space-4 (item), space-6 (logo, section label) |
| Khe giữa form và aside ở trang đăng ký | space-16                                      |

---

## 4. Radius, shadow, z-index

| Token           | Giá trị | Dùng cho                    |
| --------------- | ------- | --------------------------- |
| `--radius-sm`   | 6px     | Nav item, chip nhỏ          |
| `--radius-md`   | 8px     | Nút, input, select          |
| `--radius-lg`   | 12px    | Card, callout, alert, modal |
| `--radius-full` | 9999px  | Badge, avatar, vòng stepper |

**Shadow:** card dùng viền, **không dùng shadow**. Shadow chỉ dành cho lớp nổi.

| Token         | Giá trị                                                                   | Dùng cho                      |
| ------------- | ------------------------------------------------------------------------- | ----------------------------- |
| `--shadow-sm` | `0 1px 2px 0 rgb(15 23 42 / 5%)`                                          | Header dính (sticky) khi cuộn |
| `--shadow-md` | `0 4px 8px -2px rgb(15 23 42 / 10%), 0 2px 4px -2px rgb(15 23 42 / 6%)`   | Dropdown, menu người dùng     |
| `--shadow-lg` | `0 12px 24px -4px rgb(15 23 42 / 12%), 0 4px 8px -4px rgb(15 23 42 / 8%)` | Modal, toast                  |

**z-index:** `--z-dropdown` 1000 · `--z-sticky` 1100 · `--z-overlay` 1200 · `--z-modal` 1300 · `--z-toast` 1400

---

## 5. Kích thước layout

| Token                              | Giá trị           | Ghi chú                                              |
| ---------------------------------- | ----------------- | ---------------------------------------------------- |
| `--layout-sidebar-width`           | 256px             |                                                      |
| `--layout-sidebar-collapsed-width` | 72px              | Sidebar thu gọn, chỉ hiện icon (§7)                  |
| `--layout-header-height`           | 64px              | Header 1 dòng (Q1, Q7)                               |
| `--layout-content-max-width`       | 1600px            | Q8                                                   |
| `--layout-form-max-width`          | 960px             | Form nhiều bước, trang cài đặt (Q8)                  |
| `--layout-auth-form-width`         | 440px             | Q9                                                   |
| `--layout-modal-sm / md / lg`      | 400 / 560 / 720px | `max-width` của Modal theo `size`                    |
| `--layout-dropdown-min-width`      | 200px             | Độ rộng tối thiểu của DropdownMenu                   |
| `--layout-tooltip-max-width`       | 280px             | Tooltip xuống dòng khi vượt độ rộng này              |
| `--layout-card-min-width`          | 280px             | Độ rộng cột tối thiểu của lưới card/form `auto-fill` |
| `--layout-focus-ring-width`        | 2px               | Q4                                                   |
| `--layout-focus-ring-offset`       | 2px               | Q4                                                   |

### 5.1 Kích thước thành phần (`--size-*`)

| Token                        | Giá trị        | Dùng cho                                                     |
| ---------------------------- | -------------- | ------------------------------------------------------------ |
| `--size-icon-sm`             | 16px           | Icon trong menu item, spinner nhỏ                            |
| `--size-icon-md`             | 20px           | Icon trong nút, input (chevron của Select), Alert            |
| `--size-icon-lg`             | 24px           | Icon đứng riêng, icon của EmptyState, spinner vừa            |
| `--size-checkbox`            | 16px           | Ô checkbox                                                   |
| `--size-target-min`          | 24px           | Chiều cao tối thiểu vùng bấm của control nhỏ (hàng checkbox) |
| `--size-avatar-sm / md / lg` | 32 / 40 / 48px | Avatar                                                       |
| `--size-control-md`          | 44px           | Nút, input, nav item, menu item trong app (M2, M3)           |
| `--size-control-lg`          | 48px           | Nút, input ở trang auth và public (M2, M3)                   |

**Quy tắc cho `*.module.css`:** mọi kích thước lấy từ token. Chỉ được viết số trực tiếp cho độ dày viền và đường kẻ (1px, 2px, 3px), media query, `%`, `auto` và `0`. Kích thước ghép thì dùng `calc()` trên token, ví dụ `calc(var(--size-icon-lg) + 2 * var(--space-4))`.

---

## 6. Breakpoint

CSS variable không dùng được trong `@media`, nên breakpoint chỉ ghi ở đây và viết số trực tiếp. Viết theo kiểu mobile-first: `@media (min-width: …)`.

| Tên  | Min-width | Hành vi                                                                                                                   |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| `sm` | 640px     | —                                                                                                                         |
| `md` | 768px     | Từ mốc này trở lên input dùng `body` 14px; dưới mốc là 16px (Q5, có sẵn trong base.css). Trang Sign in hiện panel inverse |
| `lg` | 1024px    | Sidebar cố định; dưới mốc này sidebar thành drawer                                                                        |
| `xl` | 1280px    | —                                                                                                                         |

---

## 7. App-shell (đã chốt, Q1)

**Sidebar** (`--layout-sidebar-width`, nền surface, viền phải `--color-border`):

- Trên cùng là logo có icon.
- Nav được nhóm theo section. Section label dùng `caption`, viết hoa, màu `--color-text-subtle`.
- Mỗi nav item có icon, cao `--size-control-md`, bo `--radius-sm`, chữ `--color-text-muted`.
- **Item active:**
  - Nền `--color-primary-subtle`, chữ `--color-text` semibold.
  - **Vạch 3px `--color-primary` bên trái.**
  - Có `aria-current="page"`.
- Badge đếm dùng warning hoặc danger (bg/fg).
- **Thu gọn** (`--layout-sidebar-collapsed-width` 72px): chỉ hiện icon, section label ẩn khỏi mắt nhưng vẫn là tên nhóm cho trình đọc màn hình. Tên mục hiện qua Tooltip bên phải; link giữ `aria-label` và `aria-current`. Nút thu gọn/mở rộng ở cuối sidebar. Lựa chọn lưu trong `localStorage` (`learnup.sidebar-collapsed`). Trang con có thể ép thu gọn tạm thời bằng `useForceSidebarCollapsed()`; khi trang đó unmount, lựa chọn của người dùng được trả lại.
- **Dưới `lg`:** sidebar thành drawer bên trái (Radix Dialog, nền `--color-overlay`, `--shadow-lg`), luôn ở dạng mở rộng. Đóng bằng Esc, nút ✕, bấm ra ngoài, hoặc khi chọn một mục.

**Header** (`--layout-header-height` 64px, nền surface, viền dưới `--color-border`, **1 dòng**):

- Bên trái: tên tổ chức, hoặc nút mở drawer khi màn hình dưới `lg`.
- Bên phải: thông báo và **menu người dùng** dạng dropdown với `--shadow-md` và `--z-dropdown`. Thứ tự trong menu: tên và role, Hồ sơ, Đổi mật khẩu, chọn ngôn ngữ, Đăng xuất (tone danger).
- Header không chứa eyebrow tên role và không chứa tiêu đề trang.

**Vùng nội dung:**

- Nền background, padding space-8, max-width `--layout-content-max-width`.
- Tiêu đề trang dùng `h1`, đặt trong vùng nội dung. Nút hành động chính nằm bên phải tiêu đề.

**Trang public / đăng ký:**

- Header public: logo, link "Subscription plans" và "Sign in". Không có nút "View plans" (M17). Link active có gạch chân 2px `--color-primary`.
- Có footer.
- Form nhiều bước tối đa `--layout-form-max-width`.

**Trang Sign in:**

- Chia đôi màn hình. Panel trái dùng `--color-inverse-*`. Form rộng `--layout-auth-form-width`.
- Dưới `md` ẩn panel trái.

**Còn phải thiết kế thêm** (ảnh chưa có): panel thông báo, trạng thái hover và disabled của mọi thành phần. Drawer và menu người dùng đã làm theo mô tả ở trên, cần đối chiếu khi có ảnh thiết kế.

---

## 8. Mâu thuẫn trong ảnh và quyết định

Mọi đề xuất đã được đồng ý, trừ M4 và M17 có điều chỉnh theo Q1 và yêu cầu bỏ nút.

| #   | Mâu thuẫn                                             | Quyết định                                                                    |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| M1  | Nút chính có 2 kiểu: amber và slate-900               | Amber là primary duy nhất (Q2)                                                |
| M2  | Chiều cao nút có 5 mức: 40 / 42 / 44 / 48 / 52        | 44 trong app, 48 ở auth và public                                             |
| M3  | Chiều cao input: 48–50 và 56                          | 44 trong app, 48 ở auth                                                       |
| M4  | Shell A và B khác nhau                                | Hướng lai (Q1)                                                                |
| M5  | Section label slate-400                               | `--color-text-subtle` (slate-500)                                             |
| M6  | Tiêu đề trang: 30 / 34 / 36                           | `display` 36 cho auth/public, `h1` 30 cho app                                 |
| M7  | Bo góc lệch nhau                                      | card 12, nút và input 8                                                       |
| M8  | Success lúc emerald-600, lúc emerald-700              | emerald-700                                                                   |
| M9  | Chữ danger red-600 trên red-50 (4.41)                 | red-700                                                                       |
| M10 | Chữ warning có 3 màu                                  | amber-800 trên amber-50. Badge "Required" là nhãn loại: dùng badge trung tính |
| M11 | Có thêm màu orange                                    | Gộp vào warning (Q10)                                                         |
| M12 | Badge trung tính dùng chữ slate-500 (4.34)            | `--color-text-muted`                                                          |
| M13 | Hành động trong bảng lúc là link, lúc là chữ thường   | `--color-link`                                                                |
| M14 | Bộ lọc lúc là chip, lúc là select                     | Select có nhãn                                                                |
| M15 | Header bảng lúc viết hoa, lúc viết thường             | `caption` viết hoa, nền surface-muted                                         |
| M16 | Logo có/không có icon                                 | Một logo có icon, kèm biến thể màu trắng cho nền inverse                      |
| M17 | "View plans" trùng chức năng với "Subscription plans" | **Bỏ nút "View plans"**                                                       |
| M18 | Dữ liệu demo trong ảnh ("Demo data", "[Limit]", …)    | Không đưa vào UI                                                              |
| M19 | Viền input quá nhạt                                   | `--color-border-input` = slate-450 (Q3)                                       |

---

## 9. Quy tắc giao diện

- Label chỉ chứa tên trường; ràng buộc, trạng thái, gợi ý đặt ở helperText.

---

## Phụ lục A — Kiểm kê từ ảnh (tham khảo)

**Cách đo:**

- Màu lấy bằng cách đọc giá trị pixel (Pillow).
- Cỡ chữ suy ra từ cap-height của Inter (≈ 0.727em), sai số ±1px.
- Bo góc ước lượng từ độ lệch ở hàng pixel đầu của góc, sai số ±2px.
- Mọi viền trong ảnh hiện thành 2px ở độ đậm ~50% (viền 1px bị lấy mẫu lại khi export). Vì vậy các giá trị dưới đây là **màu gốc** của viền.

**Màu quan sát được:**

- Slate 50/100/200/300/400/500/600/800/900.
- Amber 50/100/500/700/800.
- Blue 50/600; red 50/100/600/700; emerald 50/600/700; orange 50/700.
- Navy `#142238 #26364b #34465c #465873` (panel Sign in).

**Cỡ chữ đo được (px):** 36 (H1 auth/public) · 34–35 (H1 đăng ký) · 30 (tiêu đề trang app) · 24 (empty state) · 22 (tiêu đề card) · 20 (section) · 18 (aside) · 16 (tiêu đề header) · 15 (subtitle, nút) · 14 (label, nav, bảng) · 12–13 (helper, meta) · 11 (badge).

**Kích thước:**

- Sidebar 256 (admin, organizer) và 252 (instructor, learner).
- Header 76 và 72; header public 76.
- Nav item cao 44.
- Nút cao 40 / 42 / 44 / 48 / 52; input cao 48–50 / 56.
- Cột form Sign in 600; panel trái 684.
- Form đăng ký 856 + aside 380; card giữa trang 976; container public rộng 1296 (lề 72).
- Avatar 32–34; vòng stepper 30.
- Ảnh **không có shadow**.

**Shell trong ảnh:**

- **A** (admin, organizer): nav có section label, không icon; active là nền slate-100 kèm chấm tròn; header 2 dòng; user ở header; nút chính slate-900.
- **B** (instructor, learner): một section label, nav có icon; active là nền amber-50; user ở cuối sidebar; header 1 dòng; nút chính amber.
- **C** (public/đăng ký): header có nav gạch chân amber, footer.
- **D** (Sign in): chia đôi màn hình với panel navy.
