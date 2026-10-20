# Báo cáo giao diện Inter 2

Ngày kiểm: 20/10/2026. Nhánh: `fix/frontend/inter2-ui-vietnamese-labels`.

## Bước 0

- `develop`, working tree sạch; HEAD và origin/develop cùng `da54406550520c7984463898bb7648634b57527f` (ref local).
- Không có tiến trình nghe cổng 3000, 8083–8086, 15433. Kiểm bằng Get-NetTCPConnection ngoài sandbox.
- Đã lần route trong `frontend/src/router.tsx`; không sửa route, API, backend hoặc cấu hình service.

## File sửa

### (a) File của Hào và kiểm chứng demo

- `frontend/dev/uc24.demo.md`
- `frontend/dev/uc25.4.demo.md`
- `frontend/dev/uc27.2.demo.md`
- `frontend/dev/inter2.ui.report.md`
- `frontend/dev/inter2.ui.pr.md`
- `frontend/src/components/learner/course.cover.test.tsx`
- `frontend/src/components/learner/course.cover.tsx`
- `frontend/src/components/learner/learning.error.tsx`
- `frontend/src/components/learner/url.pagination.tsx`
- `frontend/src/components/organizer/assignment.change.tsx`
- `frontend/src/pages/learner/catalog.tsx`
- `frontend/src/pages/learner/course.curriculum.tsx`
- `frontend/src/pages/learner/course.overview.tsx`
- `frontend/src/pages/learner/lesson.detail.tsx`
- `frontend/src/pages/learner/lesson.resource.scss`
- `frontend/src/pages/learner/lesson.resource.tsx`
- `frontend/src/pages/learner/my.courses.scss`
- `frontend/src/pages/learner/my.courses.tsx`
- `frontend/src/pages/organizer/assignment.create.tsx`
- `frontend/src/pages/organizer/assignment.detail.scss`
- `frontend/src/pages/organizer/assignment.detail.tsx`
- `frontend/src/pages/organizer/assignments.scss`
- `frontend/src/pages/organizer/assignments.tsx`
- `frontend/src/utils/assignments.view.ts`
- `frontend/src/utils/curriculum.view.test.ts`
- `frontend/src/utils/curriculum.view.ts`
- `frontend/src/utils/enroll.outcome.test.ts`
- `frontend/src/utils/enroll.outcome.ts`
- `frontend/src/utils/enrollment.summary.ts`
- `frontend/src/utils/my.courses.view.test.ts`
- `frontend/src/utils/my.courses.view.ts`
- `frontend/src/utils/video.outcome.ts`
- `frontend/src/utils/withdrawal.outcome.test.ts`
- `frontend/src/utils/withdrawal.outcome.ts`

### (b) File dùng chung; người sửa gần nhất trước đợt này

| File | Người sửa gần nhất |
| --- | --- |
| `frontend/dev/identity.proxy.test.ts` | DinhVietHao (658de25) |
| `frontend/dev/identity.proxy.ts` | DinhVietHao (658de25) |
| `frontend/src/components/layout/layout.learner.course.tsx` | DinhVietHao (d0be7f1) |
| `frontend/src/components/layout/layout.learner.tsx` | Danh (987a26d) |
| `frontend/src/components/layout/layout.organizer.tsx` | Danh (987a26d) |
| `frontend/src/styles/global.scss` | DinhVietHao (4cf9cd2) |
| `scripts/inter1-demo.mjs` | DinhVietHao (72cbf97) |
| `scripts/uc27.2-demo-check.mjs` | DinhVietHao (658de25) |

Hai file `organizer.ui.scss`/`learner.ui.scss` đã khảo sát ở Bước 0 nhưng không cần sửa: token mới được áp dụng riêng tại ba màn hình yêu cầu. `due.format.ts` đã dùng tiếng Việt nên giữ nguyên; suite due.format vẫn được chạy.

## Nhãn cũ → mới cho checklist ngoài repo

Bảng dưới liệt kê các nhãn và thông báo thay đổi trong mã giao diện. Key persona, userId, route, enum và mã lỗi API giữ nguyên.

| Cũ | Mới |
| --- | --- |
| Organizer ABC | Quản lý đào tạo ABC |
| Course của tôi | Khóa học của tôi |
| Overview | Tổng quan |
| Danh mục Course | Danh mục Khóa học |
| Peer Review | Chấm chéo |
| Certificates | Chứng chỉ |
| My Reports | Báo cáo của tôi |
| LearnUP Learner home | Trang chủ học viên LearnUP |
| Learner | Học viên |
| Sign out | Đăng xuất |
| Account settings | Cài đặt tài khoản |
| Open navigation | Mở điều hướng |
| Sign out of LearnUP? | Đăng xuất khỏi LearnUP? |
| Your current session will end on this device. | Phiên hiện tại của bạn trên thiết bị này sẽ kết thúc. |
| OVERVIEW | Tổng quan |
| Dashboard | Tổng quan |
| MANAGEMENT | Quản lý |
| Subscription | Gói dịch vụ |
| Organization | Tổ chức |
| Instructors | Giảng viên |
| Learners | Học viên |
| TRAINING | Đào tạo |
| Courses | Khóa học |
| Assignments | Phân công đào tạo |
| INSIGHTS | Thống kê |
| Reports | Báo cáo |
| Evaluations | Đánh giá |
| MODERATION | Kiểm duyệt |
| Content Reports | Báo cáo nội dung |
| Violation History | Lịch sử vi phạm |
| ACCOUNT | Tài khoản |
| Profile | Hồ sơ |
| ORGANIZER (nhãn header) | Quản lý đào tạo |
| Renew subscription | Gia hạn gói dịch vụ |
| Upgrade subscription | Nâng cấp gói dịch vụ |
| Edit organization | Chỉnh sửa tổ chức |
| Add instructor | Thêm giảng viên |
| Import instructors | Nhập danh sách giảng viên |
| Instructor detail | Chi tiết giảng viên |
| Add learner | Thêm học viên |
| Import learners | Nhập danh sách học viên |
| Learner Report | Báo cáo học viên |
| Learner detail | Chi tiết học viên |
| Courses awaiting approval | Khóa học chờ duyệt |
| Review course | Duyệt khóa học |
| Version Report | Báo cáo phiên bản |
| Course detail | Chi tiết khóa học |
| Assign required course | Phân công khóa học bắt buộc |
| Assignment detail | Chi tiết phân công |
| Report detail | Chi tiết báo cáo |
| Content report detail | Chi tiết báo cáo nội dung |
| Content reports | Báo cáo nội dung |
| Violation history | Lịch sử vi phạm |
| Change password | Đổi mật khẩu |
| Mai Nguyen | Quản lý đào tạo |
| LearnUP Organizer home | Trang chủ quản lý đào tạo LearnUP |
| Organizer | Quản lý đào tạo |
| Organization Management | Quản lý tổ chức |
| Về Course của tôi | Về Khóa học của tôi |
| Learner không còn bị tính quá hạn và vẫn có thể học tiếp. Course vẫn là bắt buộc, không chuyển về tự chọn. | Học viên không còn bị tính quá hạn và vẫn có thể học tiếp. Khóa học vẫn là bắt buộc, không chuyển về tự chọn. |
| Giới hạn ngày tính theo giờ trên máy bạn vì chưa lấy được múi giờ tổ chức. Backend sẽ kiểm tra hạn khi gửi. | Giới hạn ngày tính theo giờ trên máy bạn vì chưa lấy được múi giờ tổ chức. Hạn sẽ được kiểm tra khi gửi. |
| Bạn không có quyền xem danh mục Course. | Bạn không có quyền xem danh mục Khóa học. |
| Không tải được danh mục Course | Không tải được danh mục Khóa học |
| Đã có lỗi xảy ra khi tải danh mục Course. | Đã có lỗi xảy ra khi tải danh mục Khóa học. |
| Hiện chưa có Course nào để tự đăng ký | Hiện chưa có Khóa học nào để tự đăng ký |
| Các Course tổ chức của bạn mở cho Học viên tự đăng ký. | Các Khóa học tổ chức của bạn mở cho Học viên tự đăng ký. |
| Quiz và Assignment của Course → | Bài trắc nghiệm và Bài tập của Khóa học → |
| Bạn không có quyền xem giới thiệu Course. | Bạn không có quyền xem giới thiệu Khóa học. |
| Course chưa có Module nào. | Khóa học chưa có Chương nào. |
| Điều kiện cấp Certificate | Điều kiện cấp Chứng chỉ |
| Đăng ký Course này? | Đăng ký Khóa học này? |
| Course đã thay đổi trong lúc bạn đang xem. | Khóa học đã thay đổi trong lúc bạn đang xem. |
| Về danh mục Course | Về danh mục Khóa học |
| Tự đăng ký, không cần duyệt. Course tự chọn không có hạn hoàn thành. | Tự đăng ký, không cần duyệt. Khóa học tự chọn không có hạn hoàn thành. |
| Course không tồn tại hoặc không còn trong danh mục | Khóa học không tồn tại hoặc không còn trong danh mục |
| Không tải được giới thiệu Course | Không tải được giới thiệu Khóa học |
| Đã có lỗi xảy ra khi tải giới thiệu Course. | Đã có lỗi xảy ra khi tải giới thiệu Khóa học. |
| Học liệu Reading sẽ có ở phiên bản sau | Học liệu Bài đọc sẽ có ở phiên bản sau |
| Nội dung Lesson | Nội dung Bài học |
| Lesson trước và sau | Bài học trước và sau |
| Về Lesson | Về Bài học |
| Bạn không có quyền xem danh sách Course này. | Bạn không có quyền xem danh sách Khóa học này. |
| Rút khỏi Course | Rút khỏi Khóa học |
| Rút khỏi Course? | Rút khỏi Khóa học? |
| Không tải được danh sách Course | Không tải được danh sách Khóa học |
| Đã có lỗi xảy ra khi tải danh sách Course. | Đã có lỗi xảy ra khi tải danh sách Khóa học. |
| Bạn chưa có Course nào | Bạn chưa có Khóa học nào |
| Các Course bạn được phân công và đã tự đăng ký. | Các Khóa học bạn được phân công và đã tự đăng ký. |
| Hãy chọn ít nhất một Learner. | Hãy chọn ít nhất một Học viên. |
| Phân công Course | Phân công Khóa học |
| Chọn một Course Published và tối đa 500 Learner. | Chọn một Khóa học đã xuất bản và tối đa 500 Học viên. |
| Learner có lỗi | Học viên có lỗi |
| Bỏ chọn các Learner lỗi | Bỏ chọn các Học viên lỗi |
| Course Published | Khóa học đã xuất bản |
| Course | Khóa học |
| Hãy chọn một Course Published. | Hãy chọn một Khóa học đã xuất bản. |
| Tìm Course theo tên | Tìm Khóa học theo tên |
| Không có Course Published phù hợp | Không có Khóa học đã xuất bản phù hợp |
| Chưa hỗ trợ tìm Learner theo tên hoặc email. Chuyển trang để chọn | Chưa hỗ trợ tìm Học viên theo tên hoặc email. Chuyển trang để chọn |
| Không có Learner trong tổ chức | Không có Học viên trong tổ chức |
| Chỉ được chọn tối đa 500 Learner. | Chỉ được chọn tối đa 500 Học viên. |
| Hạn hoàn thành được backend tính cho từng Learner. Tiến độ và kết quả | Hạn hoàn thành được tính cho từng Học viên. Tiến độ và kết quả |
| Chưa chọn Learner | Chưa chọn Học viên |
| Course bắt buộc | Khóa học bắt buộc |
| Learner tự rút | Học viên tự rút |
| Phân công Course | Phân công đào tạo |
| Theo dõi các Course bắt buộc trong tổ chức. | Theo dõi các Khóa học bắt buộc trong tổ chức. |
| Chưa có phân công Course nào | Chưa có phân công Khóa học nào |
| Course không còn ở trạng thái có thể phân công. Vui lòng chọn lại. | Khóa học không còn ở trạng thái có thể phân công. Vui lòng chọn lại. |
| Không ai được phân công vì danh sách Learner có lỗi. Hãy kiểm tra bên dưới. | Không ai được phân công vì danh sách Học viên có lỗi. Hãy kiểm tra bên dưới. |
| Learner không thuộc tổ chức. | Học viên không thuộc tổ chức. |
| Tài khoản không có vai trò Learner. | Tài khoản không có vai trò Học viên. |
| Learner đã được phân công Course này. | Học viên đã được phân công Khóa học này. |
| Không tải được Lesson | Không tải được Bài học |
| Không tìm thấy Course | Không tìm thấy Khóa học |
| Course không tồn tại hoặc không thuộc danh sách Course của bạn. | Khóa học không tồn tại hoặc không thuộc danh sách Khóa học của bạn. |
| Course đang tạm dừng, bạn chưa thể truy cập nội dung | Khóa học đang tạm dừng, bạn chưa thể truy cập nội dung |
| Không tìm thấy Lesson | Không tìm thấy Bài học |
| Lesson không thuộc chương trình học của Course này. | Bài học không thuộc chương trình học của Khóa học này. |
| Lesson này đang tạm ngưng | Bài học này đang tạm ngưng |
| Không thể đăng ký lại Course này | Không thể đăng ký lại Khóa học này |
| Bạn đã đăng ký Course này | Bạn đã đăng ký Khóa học này |
| Tổ chức của bạn đang trong thời gian ân hạn, chưa thể đăng ký Course mới | Tổ chức của bạn đang trong thời gian ân hạn, chưa thể đăng ký Khóa học mới |
| Tổ chức của bạn hiện chưa thể đăng ký Course mới. Vui lòng liên hệ quản trị viên tổ chức. | Tổ chức của bạn hiện chưa thể đăng ký Khóa học mới. Vui lòng liên hệ quản trị viên tổ chức. |
| Course không còn trong danh mục | Khóa học không còn trong danh mục |
| Không tải được thông tin Course | Không tải được thông tin Khóa học |
| Không tìm thấy học liệu hoặc Course của bạn. | Không tìm thấy học liệu hoặc Khóa học của bạn. |
| Nếu bạn chưa làm Quiz, chưa nộp bài và chưa chấm chéo, toàn bộ tiến độ của Course này sẽ bị xóa. Nếu đã có, tiến độ được giữ lại để bạn đăng ký lại sau. | Nếu bạn chưa làm Bài trắc nghiệm, chưa nộp bài và chưa chấm chéo, toàn bộ tiến độ của Khóa học này sẽ bị xóa. Nếu đã có, tiến độ được giữ lại để bạn đăng ký lại sau. |
| Đã rút khỏi Course | Đã rút khỏi Khóa học |
| Đã rút khỏi Course. Tiến độ được giữ lại nếu bạn đăng ký lại | Đã rút khỏi Khóa học. Tiến độ được giữ lại nếu bạn đăng ký lại |
| Course này không còn trong danh sách của bạn | Khóa học này không còn trong danh sách của bạn |
| Course được phân công không thể tự rút | Khóa học được phân công không thể tự rút |
| Course đã hoàn thành không thể rút | Khóa học đã hoàn thành không thể rút |
| Chưa rút được khỏi Course, vui lòng thử lại | Chưa rút được khỏi Khóa học, vui lòng thử lại |
| Learning Outcomes | Kết quả học tập |
| Stay signed in | Tiếp tục đăng nhập |
| Northstar Learning | Demo Organization (giống header Learner) |
| Course chưa có Lesson nào. | Khóa học chưa có Bài học nào. |
| Lesson này chưa có học liệu | Bài học này chưa có học liệu |
| Xem danh mục Course | Xem danh mục Khóa học |
| Learner đã chọn (N / 500) | Học viên đã chọn (N / 500) |
| Trang Course trước / sau | Trang Khóa học trước / sau |
| Trang Learner trước / sau | Trang Học viên trước / sau |
| Learner (cột chi tiết) | Học viên (hàng riêng toàn chiều ngang) |
| Kích hoạt | Ngày kích hoạt |
| Xóa tài khoản | Ngày xóa tài khoản (chỉ khi có giá trị) |
| Không có nhãn khi chưa đủ thời lượng | Chưa đủ thời lượng |
| Không đổi Học viên trong proxy khi Video đang phát | Bỏ khỏi giao diện; giữ trong uc27.2.demo.md |
| Đã xem N / M giây cần thiết (Video D giây) | Đã xem N / M giây cần thiết; Thời lượng video: D giây. Mốc cần đạt: M giây (100%). |

| Vào học | Vào học (giữ nguyên) |
| Xem giới thiệu | Xem giới thiệu (giữ nguyên) |
| Đăng ký học | Đăng ký học (giữ nguyên) |
| Đăng ký | Đăng ký (giữ nguyên) |
| Hủy | Hủy (giữ nguyên) |
| Thử lại | Thử lại (giữ nguyên) |
| Phân công | Phân công (giữ nguyên) |
| Xem lại / bỏ chọn | Xem lại / bỏ chọn (giữ nguyên) |
| Đóng | Đóng (giữ nguyên) |
| Xem chi tiết | Xem chi tiết (giữ nguyên) |
| Về danh sách | Về danh sách (giữ nguyên) |
| Kéo dài hạn | Kéo dài hạn (giữ nguyên) |
| Đánh dấu Miễn | Đánh dấu Miễn (giữ nguyên) |
| Chọn ngày | Chọn ngày (giữ nguyên) |
| Đã kéo dài hạn. | Đã kéo dài hạn. (giữ nguyên) |
| Đã đánh dấu Miễn. | Đã đánh dấu Miễn. (giữ nguyên) |
| Lý do | Lý do (giữ nguyên) |
| Ngày hết hạn mới | Ngày hết hạn mới (giữ nguyên) |
| Tốc độ phát | Tốc độ phát (giữ nguyên) |
| Chưa bắt đầu | Chưa bắt đầu (giữ nguyên) |
| Đang học | Đang học (giữ nguyên) |
| Đã hoàn thành | Đã hoàn thành (giữ nguyên) |
| Miễn | Miễn (giữ nguyên) |
| Quá hạn | Quá hạn (giữ nguyên) |
| Bắt buộc | Bắt buộc (giữ nguyên) |
| Tự chọn | Tự chọn (giữ nguyên) |
| Đăng ký thành công | Đăng ký thành công (giữ nguyên) |
| Đăng ký thành công, tiến độ cũ đã được khôi phục | Đăng ký thành công, tiến độ cũ đã được khôi phục (giữ nguyên) |
| Học viên 1 (Tổ chức A) | Học viên 1 (Tổ chức A) (giữ nguyên) |
| Học viên 2 (Tổ chức A) | Học viên 2 (Tổ chức A) (giữ nguyên) |
| Học viên 3 (Tổ chức B) | Học viên 3 (Tổ chức B) (giữ nguyên) |
| Học viên 4 (Tổ chức A) | Học viên 4 (Tổ chức A) (giữ nguyên) |
| Học viên 5 (Video chưa học) | Học viên 5 (Video chưa học) (giữ nguyên) |
| Học viên 6 (Video đã xem 511 giây) | Học viên 6 (Video đã xem 511 giây) (giữ nguyên) |

Các nhãn demo giữ nguyên: `Vào học`, `Xem giới thiệu`, `Đăng ký học`, `Đăng ký`, `Hủy`, `Thử lại`, `Phân công`, `Xem lại / bỏ chọn`, `Đóng`, `Xem chi tiết`, `Về danh sách`, `Kéo dài hạn`, `Đánh dấu Miễn`, `Chưa bắt đầu`, `Đang học`, `Đã hoàn thành`, `Miễn`, `Quá hạn`, `Bắt buộc`, `Tự chọn`. Persona LEARNER_1…6 giữ nguyên nhãn Học viên tương ứng; ORGANIZER đổi như bảng. Thông báo thành công phân công/gia hạn/Miễn/khôi phục không đổi.

Locale mặc định tiếng Anh của lịch, chọn tất cả và phân trang được thay bằng locale tiếng Việt có sẵn trong Ant Design 5.21.6, chỉ tại các thành phần trong phạm vi. Không đổi provider toàn cục.

## Thay đổi trình bày và phát hiện thêm

- UI-1: học viên thành hàng riêng; tên đậm, email không ngắt giữa chữ, trạng thái dạng thẻ, ngày kích hoạt, ngày xóa có điều kiện. Thông tin phân công ba cột; hoàn thành/rút/lý do rút chỉ khi có dữ liệu.
- UI-2: ba màn yêu cầu dùng token cỡ chữ 14px, line-height 1.5 và padding 4px/12px; không đổi màu trạng thái.
- UI-3: nhãn trạng thái, số giây dễ đọc, vạch đích tại 100% số giây yêu cầu. Công thức tiến độ giữ nguyên watchedSeconds/requiredSeconds. Lưu ý proxy đã tồn tại trong tài liệu demo nên không thêm trùng.
- UI-4: bỏ tiền tố ngoặc vuông ở đầu và lấy chữ/số Unicode đầu tiên; không có thì dùng icon. Thêm tám ca test.
- UI-5: dùng lại DevIdentitySwitcher của Learner để hiển thị persona từ proxy; user thật vẫn từ useCurrentApp như Learner. Bỏ Mai Nguyen; tổ chức hiển thị Demo Organization giống Learner. Không thêm endpoint hay logic danh tính mới.
- Thêm: dịch Learning Outcomes thành Kết quả học tập; dịch Reading/Module/Published trong nội dung hiển thị, hộp đăng xuất, cảnh báo và thông báo lỗi; bỏ từ backend khỏi lời giải thích gửi người dùng.

## Kiểm chứng a–d

| Kiểm | Kết quả thực tế |
| --- | --- |
| a — npm run test | 19 file test pass; 298 test pass; 21 browser recovery test skip theo cấu hình hiện có; test in cảnh báo Sass legacy API. |
| a — npm run build | Thành công (TypeScript + Vite); còn cảnh báo bundle lớn hơn 500 kB có sẵn. |
| a — npm run lint | 0 lỗi, 2 warning react-refresh cũ ở app.context.tsx và account.table.tsx; không thêm warning mới. |
| b — powershell -ExecutionPolicy Bypass -File scripts\inter2-demo.ps1 -AnyBranch | Đạt 10/10 bước tới Sẵn sàng demo trên PostgreSQL 16 sạch, Assessment http thật. Không sửa launcher. |
| b — node scripts/uc27.2-demo-check.mjs | Lượt DB sạch cuối đạt 10/10 nhóm. Nhóm ảnh chỉ đọc chạy lại sau nhãn Kết quả học tập cũng pass. |
| c — Chromium | Đủ 12 ảnh PNG, từng ảnh rộng đúng 1440 px; đã rà ảnh các màn yêu cầu, gồm trước/sau Miễn. |
| d — Ctrl+C và kiểm ngoài sandbox | Hai container do lượt kiểm tạo đã xóa; không còn tiến trình nghe cổng 3000, 8083–8086, 15433. Container cũ được giữ theo quyết định riêng bên dưới. |

Sandbox ban đầu chặn Vitest đọc node_modules (EPERM); chạy lại ngoài sandbox thành công. Lượt Chromium đầu gặp Vite tối ưu dependency và hai selector cần cập nhật sau khi có persona/account tag. Đã sửa selector, giữ nguyên assertion HTTP/phát video, rồi chạy lại đầy đủ trên DB sạch. Ảnh sau Miễn được thu lại sau hiệu ứng đóng modal.

Kiểm b dùng PostgreSQL và các service demo thật, không phải H2 hoặc mock Tenant. Ca chọn học viên hai trang vẫn là unit test assignment.selection.test.ts; không tuyên bố đã chạy với 51 tài khoản thật. Không chạy thêm ca dừng Assessment trả 503 ngoài harness có sẵn.

Container các lượt kiểm: `learnup-inter2-20261020-133645-667` và `learnup-inter2-20261020-135725-884`, đều đã bị launcher xóa sau Ctrl+C. PowerShell trả mã 1 do ngắt Ctrl+C; thông báo Removed và kiểm cổng/container sau đó xác nhận dọn xong.

Lệnh harness dùng `CHROME_PATH` trỏ Chromium cài sẵn và `DEMO_ARTIFACTS_DIR=D:\Temp\learnup-inter2-ui`. Kết quả máy đọc: `D:\Temp\learnup-inter2-ui\checks.json`.

| Nhóm Chromium | Kết quả |
| --- | --- |
| Inter 1: UC25/25.1/26/27/27.1 | PASS |
| Inter 1: empty learner and organization isolation | PASS |
| UC25.3 enrollment and 429 | PASS |
| UC25.4 deleted / withdrawn / restored | PASS |
| UC24/24.1/24.2/24.3/24.5 one-page demo | PASS |
| UC27.2 (1): actual 20s playback activates Enrollment | PASS |
| UC27.2 (2): seek forward and replay do not add coverage | PASS |
| UC27.2 (3): remaining segment at 2x completes material and refreshes D25 | PASS |
| UC27.2 (4): completion remains after backward replay | PASS |
| UI: localized learner screenshots | PASS |

Ảnh chụp nằm ngoài repo tại `D:\Temp\learnup-inter2-ui\`:

| Ảnh | Kích thước |
| --- | --- |
| `assignment-after-exemption.png` | 1440 × 1024 |
| `assignment-before-exemption.png` | 1440 × 1024 |
| `assignment-create.png` | 1440 × 2082 |
| `assignment-detail.png` | 1440 × 1024 |
| `assignments-list.png` | 1440 × 1024 |
| `catalog-course.png` | 1440 × 1514 |
| `catalog.png` | 1440 × 1096 |
| `my-courses.png` | 1440 × 1096 |
| `sidebar-learner.png` | 1440 × 1096 |
| `sidebar-organizer.png` | 1440 × 2082 |
| `video-completed.png` | 1440 × 1087 |
| `video-incomplete.png` | 1440 × 1087 |


## Tiếng Anh ngoài phạm vi để báo nhóm

- `frontend/src/pages/organizer/dashboard.tsx`: Training overview, Required training compliance, Action queue.
- `frontend/src/pages/organizer/courses.tsx`: Organization Courses, View and filter all Courses managed by your Organization.
- `frontend/src/pages/organizer/subscription.tsx`: Subscription, Plan usage, Lifecycle rules.
- `frontend/src/pages/learner/peer.review.queue.tsx`: Peer Review Tasks, Review deadline.
- `frontend/src/pages/learner/certificates.tsx`: My Certificates, No Certificates yet.
- `frontend/src/components/notification/notification.bell.tsx`: Notifications, Loading..., View all notifications và thông báo rỗng/lỗi. Thành phần UC49 dùng chung mọi vai trò, không chỉnh đợt này.
- Nội dung khóa học/bài học và tên tổ chức do dữ liệu trả về, gồm tiền tố [SEED], không bị sửa/ghi đè.

## Ghi chú môi trường có sẵn

Theo quyết định của Hào, giữ nguyên container cũ `learnup-inter2-regression` (tạo 18/10/2026, đã dừng) và volume của nó. Kiểm d chỉ áp dụng container do các lượt kiểm này tạo. Không xóa hoặc thay đổi container cũ.

## Commit

- `7316309` — fix(frontend): localize Inter 2 demo labels and improve readability
- `48f892c` — fix(frontend): localize scoped calendar and pagination controls
- `45859da` — test(frontend): target assignment controls and capture full demo screens
- `5e7b612` — fix(frontend): translate learning outcomes and stabilize demo screenshots

Các commit đầu được tạo sau test/build/lint và trước demo theo quyết định rõ ràng của Hào để đáp ứng yêu cầu working tree sạch của launcher. Chỉ push sau khi toàn bộ kiểm a–d đạt; không tạo PR.
