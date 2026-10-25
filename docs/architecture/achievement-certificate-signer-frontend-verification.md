# UC34.3 – AR3b certificate signer settings frontend

Ngày kiểm chứng: 2026-10-25 (Asia/Saigon). Nền backend: `a182a2c`.
Nhánh: `feat/frontend/certificate-signer-settings`.

## Kết quả

Trang `/organizer/certificate-settings` nằm dưới ProtectedRoute ORGANIZER.
Menu Cấu hình Certificate ở nhóm Quản lý, cạnh Tổ chức. Trang mới dùng tiếng Việt
có dấu, giữ thuật ngữ Certificate; các trang tiếng Anh hiện có không đổi.

Một PUT multipart lưu nguyên tử tên, chức danh và thao tác ảnh keep/replace/remove.
Tên và chức danh bắt buộc; không có nút xóa toàn bộ cấu hình. Không tự đặt
Content-Type cho FormData. ETag giữ dấu ngoặc kép và được gửi nguyên vẹn qua
If-Match; thiếu ETag thì không gửi PUT. Client giữ cơ chế refresh 401 hiện hữu,
bao gồm FormData và If-Match khi gửi lại một lần.

Validation dùng NFC/trim và Unicode code point, giới hạn tên 100/chức danh 200.
Ký tự điều khiển và surrogate không hợp lệ bị chặn. Ảnh được kiểm magic bytes
PNG/JPEG, tối đa 2.097.152 byte (bao gồm đúng biên), PNG IHDR/JPEG SOF trước decode,
mỗi cạnh tối đa 4096 px và tổng tối đa 16.000.000 pixel; sau đó browser decode để
chặn ảnh hỏng. Không thêm tỷ lệ hoặc kích thước tối thiểu. Server vẫn quyết định.
SIGNER_NAME_INVALID được kiểm lại trên cả hai field; không xác định được thì
hiện lỗi đầu form.

Ảnh đã lưu được lấy qua API có xác thực dưới dạng blob. Object URL được thu hồi
khi nguồn ảnh thay đổi hoặc unmount; URL nháp cũng được thu hồi khi hủy thay đổi.
Không tải ảnh khi signature null. SIGNATURE_NOT_FOUND khi metadata có ảnh là lỗi
ảnh riêng có Retry. Lỗi preview không biến thành trạng thái chưa có chữ ký.

412 giữ chữ và File nháp, tự GET bản mới để so sánh, cập nhật baseline/ETag,
cho Dùng bản mới hoặc sửa tiếp rồi Lưu. keep sử dụng ảnh hiện tại trên hệ thống.
Lỗi GET đối chiếu có Retry riêng và chặn lưu cho đến khi tải lại thành công.
Khi chưa tải được bản mới, thẻ đối chiếu không giới thiệu baseline cũ là bản mới.

Focus/visibilitychange chỉ GET khi chưa sửa, chưa lưu và không đang giải quyết
conflict. Blob chỉ tải lại khi version/ETag hoặc trạng thái có ảnh thay đổi,
hoặc người dùng Retry ảnh. Sau PUT thành công, GET settings trước khi tải ảnh;
nếu GET tiếp theo thất bại vẫn giữ kết quả PUT làm baseline và báo Retry.

Read-only hint chỉ dùng Suspended từ getCurrentSubscriptionAPI(); lỗi API hint
không chặn trang. Grace không khóa ghi. Ended và trạng thái Organization do PUT
quyết định. ORGANIZATION_READ_ONLY và FORBIDDEN_ROLE giữ nháp, ngăn gửi tiếp.
TENANT_UNAVAILABLE và STORAGE_UNAVAILABLE có câu báo khác nhau và cho thử lại.
Mất response PUT không tự gửi lại: GET để đối chiếu; version đổi đi vào luồng
conflict kèm thông báo có thể đã lưu. useBlocker và beforeunload bảo vệ thay đổi
chưa lưu/yêu cầu đang xử lý.

Gateway chỉ đổi cấu hình production để expose ETag; thêm hai regression test CORS.
Nginx frontend giữ nguyên, không thêm proxy /api. API gọi Gateway khác origin.

## Kiểm chứng đã thực hiện

- `npm ci --no-audit --no-fund`: thành công; package.json và lockfile không đổi.
- Frontend: 32 file, **467/467 test đạt**, không skip, không unhandled error ở
  lượt xác nhận cuối. Trong đó UC34.3 có 8 test service, 20 test validation/state
  và 22 browser test (50 test mới).
- Browser dùng Chromium riêng, HTTP stub khác origin và data router chứa trang
  thật. Chưa đi qua backend/Gateway thật. Recovery và reading browser suite cũ
  cũng được bật trong lượt đầy đủ.
- `npm run build`: đạt, bao gồm `tsc -b` và Vite production build.
- `npm run lint`: 0 lỗi, 2 warning Fast Refresh ở app.context.tsx và account.table.tsx
  hiện có; không có warning từ file mới.
- Vite báo chunk lớn hơn 500 kB; không thêm dependency hoặc thay đổi chia bundle.
  Test/render còn cảnh báo Sass legacy API hiện hữu.
- Gateway `mvn test` với Java 21: **24/24 đạt**, không skip, gồm 2 test CORS mới.
  java-common được build/install để giải quyết dependency của Gateway.
- Đã xem ảnh chụp trang ở 1440 px và 375 px; browser assertion không có tràn ngang.
  Đây là kiểm tra trang độc lập trong harness, chưa phải kiểm chứng toàn bộ shell
  Organizer hoặc đối chiếu Figma.
- Git diff/check, danh sách stage, secrets và generated artifacts được rà soát
  trước commit; dist, target và node_modules không đưa vào commit.

Lệnh chạy frontend từ thư mục frontend:

```powershell
$env:LEARNUP_RECOVERY_BROWSER_TESTS = '1'
$env:LEARNUP_CERTIFICATE_BROWSER_TESTS = '1'
npm test -- --no-file-parallelism
npm run build
npm run lint
```

## Chưa kiểm chứng và giới hạn còn lại

- **Không bảo đảm ảnh xem trước cùng version với settings khi có ghi đồng thời**:
  endpoint ảnh không trả ETag/version. GET settings rồi GET ảnh vẫn là hai request.
- Chưa chạy gateway thật, Tenant thật, storage thật, PostgreSQL hoặc PDF trong
  phiên frontend này. Không coi HTTP stub là deployed integration test.
- Browser harness kiểm trang với data router riêng; role/menu được nối vào router
  production và qua typecheck/build, chưa kiểm end-to-end đăng nhập thật.
- Chưa xác minh bảng dịch 20/10 hoặc thiết kế Figma; dùng nội dung tiếng Việt đã chốt
  và component/tokens có sẵn.
- Giới hạn body ở reverse proxy/ingress đứng trước Gateway **chưa kiểm chứng**.

## Checklist gateway thật – CHƯA CHẠY

- [ ] Frontend khác origin → Gateway local → achievement local; VITE_BACKEND_URL
      trỏ Gateway. Không đi qua nginx frontend.
- [ ] Nếu deployment có reverse proxy/ingress trước Gateway, kiểm tổng body limit
      **ít nhất khoảng 3 MB** để chứa ảnh 2 MiB cùng multipart overhead.
- [ ] Dùng JWT Organizer hợp lệ do Identity cấp; tắt frontend dev bypass.
      Không tự khai header danh tính hoặc internal key ở browser.
- [ ] Tenant fake chỉ bật dev/test; chuẩn bị PostgreSQL và private storage phù hợp,
      không coi fake Tenant là fake toàn bộ backend.
- [ ] OPTIONS cho PUT cho phép Authorization, If-Match và Content-Type; origin và
      credentials phù hợp. JavaScript đọc được ETag qua exposed headers.
- [ ] GET settings trả ETag quoted, gồm version 0; PUT thiếu If-Match trả 428,
      stale trả 412, thành công trả ETag mới.
- [ ] PNG/JPEG hợp lệ đúng 2.097.152 byte qua được; +1 byte bị chặn; xác minh cả
      response từ Gateway lẫn các proxy phía trước, không chỉ validator trực tiếp.
- [ ] GET ảnh có xác thực, bytes/MIME đúng, Cache-Control no-store; thử ảnh thiếu,
      storage lỗi và Retry riêng.
- [ ] Hai tab lưu tranh phiên bản: nháp chữ/File giữ lại, keep giữ ảnh mới của hệ thống,
      người dùng phải chủ động lưu lại.
- [ ] Role sai bị từ chối; Organization/Subscription không cho ghi trả
      ORGANIZATION_READ_ONLY; Grace vẫn ghi được.
- [ ] Tenant lỗi trả TENANT_UNAVAILABLE, storage lỗi trả STORAGE_UNAVAILABLE;
      mất mạng không tự gửi lại PUT.

## Điều chỉnh và lệch so với kế hoạch

- Chạy file test tuần tự vì harness recovery/reading cũ đều có thể dùng cổng 5173.
  Harness certificate dùng cổng riêng. Không sửa test hoặc assertions của hai suite cũ.
- Một lượt đầy đủ có 466 assertions đạt nhưng có 2 unhandled CDP rejection từ
  reading harness cũ, nên không coi lượt đó là thành công. Reading riêng đạt 3/3;
  các lượt đầy đủ xác nhận tiếp theo đạt không có unhandled error.
- Một lệnh npx tsc chạy nhầm ở root đã tự tải gói tsc ngoài dự kiến vào npm cache
  rồi thất bại. Không thêm dependency vào repository và không đổi lockfile.
  Các lần sau dùng compiler đã cài bằng npm ci. Đây là lệch với ý định không tải
  package ngoài npm ci.
- Java 21/Maven portable được tải vào thư mục tạm sau phê duyệt để kiểm Gateway;
  không đổi Java mặc định hoặc cấu hình toàn cục.
- Không dùng Docker, prisma migrate, không tạo PR/merge và chưa push.
