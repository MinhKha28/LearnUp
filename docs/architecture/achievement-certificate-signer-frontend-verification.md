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
Mất response PUT không tự gửi lại, chỉ hiện một thông báo trạng thái. Người dùng có thể tải lại cấu hình để đối chiếu hoặc chủ động Lưu lại với If-Match; nếu lần trước đã lưu thì xử lý 412 và giữ nháp. Trong trạng thái mất response, GET đối chiếu thất bại vẫn cho thử lưu/hủy nháp; không hiện trạng thái đang tải khi request đã kết thúc. useBlocker và beforeunload bảo vệ thay đổi
chưa lưu/yêu cầu đang xử lý.

Gateway chỉ đổi cấu hình production để expose ETag; thêm hai regression test CORS.
Nginx frontend giữ nguyên, không thêm proxy /api. API gọi Gateway khác origin.

## Kiểm chứng đã thực hiện

- `npm ci --no-audit --no-fund`: thành công; package.json và lockfile không đổi.
- Frontend: 32 file, **470/470 test đạt**, không skip, không unhandled error ở
  lượt xác nhận cuối. Trong đó UC34.3 có 8 test service, 21 test validation/draft
  và 24 browser test (53 test UC34.3).
- Browser dùng Chromium riêng, HTTP stub khác origin và data router chứa trang
  thật. Suite này dùng stub; CDP stack thật được ghi riêng bên dưới. Recovery và reading browser suite cũ
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
- Phiên triển khai frontend ban đầu chỉ dùng HTTP stub. Phần smoke AR3b bên dưới
  đã kiểm Gateway, Identity, Tenant đăng nhập, PostgreSQL và Cloudinary thật.
  Kiểm /access của achievement vẫn dùng HTTP stub; PDF chưa kiểm chứng.
- Browser stub harness dùng data router riêng. CDP smoke sau đó đã đăng nhập Organizer thật qua form, đi qua router/menu production và Gateway khác origin; xem kết quả B.
- Chưa xác minh bảng dịch 20/10 hoặc thiết kế Figma; dùng nội dung tiếng Việt đã chốt
  và component/tokens có sẵn.
- Giới hạn body ở reverse proxy/ingress đứng trước Gateway **chưa kiểm chứng**.

## Checklist gateway thật – kết quả đã thực hiện

- [x] Frontend khác origin, dev bypass tắt, JWT thật do Identity cấp; route runtime trực tiếp được mô tả trong phần A.
- [x] Preflight PUT/If-Match, ETag quoted/exposed; Chrome đọc được ETag; 428/412/200 qua Gateway thật.
- [x] PNG/JPEG, đúng 2 MiB và +1 byte, MIME/bytes/no-store/nosniff; lỗi 413 do achievement được Gateway chuyển tiếp.
- [x] Hai tab xung đột, giữ File/chữ nháp, keep theo ảnh mới; điều hướng, beforeunload, offline và chống double submit.
- [x] Instructor bị từ chối; Active/Grace/Suspended và Tenant lỗi/timeout qua achievement HTTP access client đối chiếu stub, chưa phải Tenant thật.
- [ ] Reverse proxy/ingress trước Gateway: kiểm tổng body limit ít nhất khoảng 3 MB khi triển khai.
- [ ] Tenant /access thật cho achievement; lỗi storage thật do hạ tầng (STORAGE_UNAVAILABLE đã kiểm bằng browser stub).
- [ ] Sinh và kiểm PDF Certificate.

## Điều chỉnh và lệch so với kế hoạch

- Chạy file test tuần tự vì harness recovery/reading cũ đều có thể dùng cổng 5173.
  Harness certificate dùng cổng riêng. Không sửa test hoặc assertions của hai suite cũ.
- Một lượt đầy đủ có 466 assertions đạt nhưng có 2 unhandled CDP rejection từ
  reading harness cũ, nên không coi lượt đó là thành công. Reading riêng đạt 3/3;
  các lượt đầy đủ xác nhận tiếp theo đạt không có unhandled error.
- Một lệnh npx tsc chạy nhầm ở root đã tự tải tsc@2.0.4 (khác typescript) vào npm _npx cache
  rồi thất bại. Kiểm tra gói chỉ có trong cache, không có trong node_modules của repo; không thêm dependency, không đổi manifest/lockfile hoặc file sản phẩm.
  Các lần sau dùng compiler đã cài bằng npm ci. Đây là lệch với ý định không tải
  package ngoài npm ci.
- Java 21/Maven portable được tải vào thư mục tạm sau phê duyệt để kiểm Gateway;
  không đổi Java mặc định hoặc cấu hình toàn cục.
- Phiên triển khai frontend ban đầu không dùng Docker hoặc prisma migrate.
  Smoke sau đó dùng Docker/migrate theo từng Allow once; xem bằng chứng bên dưới.


## Smoke AR3b qua Gateway thật — phần A

Ngày chạy: 2026-10-25 (Asia/Saigon). Mã sản phẩm giữ nguyên ở `9af1513`.
**23/23 kiểm HTTP/stub đạt.** Node xác nhận CORS/exposed header; người dùng xác nhận mục B1–B2 đạt trên Chrome thật, bao gồm JavaScript đọc quoted ETag.

### Topology và route runtime

- Vite `http://localhost:3000` → Gateway `http://localhost:8088`; dev identity
  proxy tắt, fake user ID rỗng. B1–B2 kiểm thủ công; B3–B8 dùng Chrome headless/CDP.
- Gateway và Identity chạy Java 21; Tenant/achievement chạy Node v22.23.3.
  PostgreSQL 16.15 tại loopback port 15439; Cloudinary thật.
- Windows 10.0.26200, 12th Gen Intel(R) Core(TM) i7-12700H, 20 logical CPU,
  15.6 GiB RAM. Các request đo tuần tự, không phải SLA/load test.
- Cấu hình ngoài repo chuyển Identity route từ `lb://IDENTITY-SERVICE` sang
  `http://127.0.0.1:8081`, Tenant sang `http://127.0.0.1:8084` và achievement
  sang `http://127.0.0.1:8087`. Giữ nguyên predicates/path của certificates,
  reports, governance và default CORS dedupe filter; không rewrite/strip path.
  Chỉ giữ ba nhóm route cần cho smoke trong cấu hình runtime, không đổi file repo.
- Không Eureka, Notification hoặc Kafka. Certificate consumer tắt.
  Identity recovery delivery tắt; Notification URL trỏ loopback không sử dụng.
- Tạo riêng `smoke_identity`, `smoke_tenant`, `smoke_achievement` cùng owner
  role mới. Flyway Identity áp 4 migration; Tenant áp 3; achievement áp 2.
  Không sửa database cũ. Database và role riêng chỉ được DROP trong cleanup cuối đã được người dùng duyệt.
- JWT/internal key/OTP secret/DB password sinh mới cho lượt chạy. Không nạp env
  L13. Cloudinary chỉ nạp đúng ba biến được chốt từ env gốc, không ghi giá trị
  hoặc signed URL vào log/báo cáo.

### Fixture và xác thực thật

Seed nền chỉ tạo platform settings và ba plan trong database disposable.
Organization và Organizer được tạo qua registration API → OTP verification →
mock payment. Tenant gọi Identity internal provisioning có xác thực; sau đó login
qua Gateway nhận JWT thật. Organizer mời Instructor qua API, nhận invitation và
kích hoạt qua API sản phẩm, rồi Instructor login thật qua Gateway.

Do không bật Notification, script chỉ đọc email outbox của chính fixture để lấy
OTP/invitation trong bộ nhớ. Không in OTP, link, password, JWT hoặc refresh token.
Không insert password hash, không tự ký JWT, không dùng header danh tính tự khai
và không dùng/reset tài khoản seed chung.

### Kết quả HTTP

| Ca | Mong đợi | Thực tế | Thời gian ms | Kết quả |
|---|---|---|---:|---|
| A1 preflight | 2xx; PUT and If-Match allowed | 200 | 3.59 | Đạt |
| A2 ETag/CORS | 200; quoted ETag; exposed ETag | 200 | 20.7 | Đạt |
| A3 missing If-Match | 428 PRECONDITION_REQUIRED | 428 PRECONDITION_REQUIRED | 12.95 | Đạt |
| A3 current If-Match | 200; fresh ETag | 200 | 50.48 | Đạt |
| A3 stale If-Match | 412 VERSION_CONFLICT | 412 VERSION_CONFLICT | 15.2 | Đạt |
| A4 replace signature.png | 200 | 200 | 2206.22 | Đạt |
| A4 preview signature.png | 200; exact SHA-256; no-store; nosniff | 200 | 1541.95 | Đạt |
| A4 replace signature.jpg | 200 | 200 | 973.94 | Đạt |
| A4 preview signature.jpg | 200; exact SHA-256; no-store; nosniff | 200 | 411.82 | Đạt |
| A5 exact-2m.png | 200 | 200 | 2498.79 | Đạt |
| A5 over-2m.png | 413 SIGNATURE_TOO_LARGE | 413 SIGNATURE_TOO_LARGE | 17.34 | Đạt |
| A6 disguised.png.webp | 415 SIGNATURE_UNSUPPORTED_TYPE | 415 SIGNATURE_UNSUPPORTED_TYPE | 6.09 | Đạt |
| A6 too-wide.png | 400 SIGNATURE_DIMENSIONS_TOO_LARGE | 400 SIGNATURE_DIMENSIONS_TOO_LARGE | 6.06 | Đạt |
| A7 remove | 200 | 200 | 14.46 | Đạt |
| A7 removed preview | 404 SIGNATURE_NOT_FOUND; signature null | 404 SIGNATURE_NOT_FOUND | 6.85 | Đạt |
| A8 Instructor JWT | 403 FORBIDDEN_ROLE | 403 FORBIDDEN_ROLE | 6.3 | Đạt |
| A8 no token | 401 at Gateway | 401 UNAUTHORIZED | 26.88 | Đạt |
| A9 Active (stub) | 200 | 200 | 19.79 | Đạt |
| A9 Grace (stub) | 200 | 200 | 12.98 | Đạt |
| A9 Suspended (stub) | 403 ORGANIZATION_READ_ONLY | 403 ORGANIZATION_READ_ONLY | 7.84 | Đạt |
| A9 ReadOnly GET (stub) | 200 | 200 | 8.33 | Đạt |
| A9 error (stub) | 503 TENANT_UNAVAILABLE | 503 TENANT_UNAVAILABLE | 6.98 | Đạt |
| A9 slow (stub) | 503 TENANT_UNAVAILABLE | 503 TENANT_UNAVAILABLE | 3025.98 | Đạt |

PNG/JPEG preview trả bytes khớp SHA-256 nguồn và đúng MIME, no-store, nosniff.
PNG exact-size và +1 đều được kiểm verify/decode bằng Pillow: có IHDR/IDAT/IEND,
chunk tEXt hợp lệ có CRC để đạt đúng số byte; không append byte rác sau IEND.
WebP được gửi dưới tên/MIME PNG để kiểm magic bytes, không phải cấm đuôi file
khi nội dung thực sự là PNG/JPEG.

Response 413 qua Gateway có dạng
`{statusCode:413,error:{code:"SIGNATURE_TOO_LARGE"},path:"/api/v1/certificates/signer-settings"}`.
Đối chiếu mã nguồn: đây là SignerUploadFilter/Multer của achievement; Gateway
chuyển tiếp response, không phải giới hạn body riêng của Gateway. Request đúng
2 MiB đã đi qua và upload Cloudinary thành công. Reverse proxy/ingress trước
Gateway không có trong topology này, vẫn cần kiểm body limit ≥ khoảng 3 MB khi triển khai.

**A.9 là “đối chiếu stub, chưa phải Tenant thật”.** Achievement chạy accessMode=http
tới stub loopback; Identity dùng Tenant thật cho sign-in-access. Stub trả đủ
organizationId, organizationStatus, subscriptionStatus, readOnlyEndsAt, timezone;
kiểm internal key và organization header. Hai probe thiếu/sai internal key trả 401,
probe sai organization header trả 403, log chỉ ghi mã từ chối.
Slow stub đợi 5000 ms; client timeout 3000 ms và trả TENANT_UNAVAILABLE.

### Timing 20 mẫu mỗi loại

| Request | n | Lỗi | p50 ms | p95 ms |
|---|---:|---:|---:|---:|
| GET settings | 20 | 0 | 6.1 | 7.81 |
| PUT không ảnh | 20 | 0 | 12.32 | 13.3 |

PUT lấy ETag mới trước từng mẫu; thời gian GET chuẩn bị không cộng vào PUT.
p50 là trung bình mẫu thứ 10/11 đã sắp xếp; p95 là nearest-rank mẫu thứ 19.
Các request khác có thời gian riêng ở bảng trên.

### Cleanup và trạng thái B/C

Cleanup delay=6000 ms, issuance lease=1000 ms, storage timeout=3000 ms:
6000 > 1000 + 3000. Poll=250 ms, cleanup lease=8000 ms.
Worker đã dọn cả 3 ảnh của phần A; kiểm tra lần nữa nhận not_found
cho cả ba, không cần fallback delete; cleanup task thuộc smoke hiện bằng 0.

**Checklist UI B:** người dùng xác nhận mục 1–2 đạt; mục 3–8 đã chạy CDP qua stack thật và đạt. Sau sửa UI đã chạy lại 3–8, chụp lại B3–B6. Người dùng đã duyệt ảnh B3–B6: đạt ngày 2026-10-25. Runner chỉ dừng service khi thoát; cleanup dữ liệu chỉ được chạy theo yêu cầu rõ ràng của người dùng, không có thời hạn tự cleanup.
Cleanup cuối đã được người dùng yêu cầu rõ ràng sau khi duyệt ảnh. Ảnh/settings, database/role, env/credentials và các tiến trình đã được dọn theo bảng xác nhận cuối; không còn chờ checklist B. Nhánh chưa push.

### Lệch và giới hạn của lượt smoke

- Tenant ở stack smoke từng gặp TS2305 do tái sử dụng node_modules trỏ ts-storage của checkout khác (thư viện cũ). Đối chiếu dependency đúng từng snapshot: Tenant tsc --noEmit đạt trên develop, S1 e3e8b0b và develop merge S1. IStorageDeleteResult được thêm ở S1, không bị xóa. Không sửa mã Tenant.
- Launcher cần NODE_PATH trỏ dist cho import generated Prisma của Tenant.
- Identity tạo username mặc định từ 8 ký tự đầu user UUID. Fixture dùng UUIDv7,
  nên script đợi sang cửa sổ timestamp khác trước khi tạo Instructor để tránh trùng
  username mặc định; không sửa hoặc reset tài khoản nào.
- Dependencies/generated client được tái sử dụng; không npm install/ci, không đổi
  package/lockfile. Tất cả script/config smoke nằm ngoài repo.
- Bảng dịch/Figma, PDF, /access Tenant thật và ingress body limit vẫn chưa kiểm chứng.

### Version trong hai vòng đời dòng smoke

Runner cũ hết hạn đã DELETE dòng settings lúc 13:47:29 ngày 25/10/2026 (Asia/Ho_Chi_Minh). Mục UI 1–2 chạy trên dòng cũ, đến v29; CDP 3–8 chạy trên dòng tạo lại, v1→18. Cùng smoke_achievement và Organization 01a1719f-143f-71a0-bfde-a5577dfff693; restart không tạo lại database, migration hay fixture. Kết quả kiểm thử không phụ thuộc tính liên tục version giữa hai nhóm. Không sửa signer.repository: version tăng đơn điệu trong vòng đời dòng là đủ khi sản phẩm không có xóa cấu hình.

Nếu sau này có xóa/reset cấu hình, ETag phải gồm định danh thế hệ (ví dụ created_at) hoặc dùng tombstone để tránh ABA. Runner hết hạn đã được thay; không cleanup khi service lỗi, stop hay hết giờ. Cleanup chỉ theo yêu cầu riêng của người dùng.

### Kiểm lại UI sau smoke

Mất response PUT dùng một thông báo trạng thái; tải lại thủ công giữ nháp và cho phép thử lưu với If-Match sau lỗi tải lại. Thẻ xung đột ghi rõ tên/chức danh trên hệ thống. Modal đặt focus/Enter vào Ở lại và Rời trang dùng danger.

Toàn bộ frontend: 470/470 đạt, không skip; LEARNUP_CERTIFICATE_BROWSER_TESTS=1 và LEARNUP_RECOVERY_BROWSER_TESTS=1, chạy tuần tự theo file để tránh harness tranh cổng 5173. Trong UC34.3 có 53 test, gồm 24 browser, 21 validation/draft và 8 service. Build đạt; lint 0 lỗi, 2 warning cũ. CDP thật mục 3–8 đạt, stub đã về Active. Ảnh B3–B6 đã được người dùng duyệt đạt. Kết quả cleanup cuối được ghi riêng bên dưới.

Hai ảnh signature.png/signature.jpg đều 450×150: signature.png là PNG RGBA (67.100 pixel alpha=0, 400 pixel alpha=220); ảnh B signature.jpg là JPEG RGB, không có alpha, góc ảnh RGB=(0,0,0), nền đen thật do fixture chuyển RGBA→RGB. GET signature trả PNG giống hệt bytes gốc (SHA-256 7102c482f4dc7235e943bdb00d83467db49436ee6cdc394ae98f9e8d1515faa5), alpha giữ nguyên. Không có bằng chứng storage làm mất vùng trong suốt; ảnh đen trong B4/B6 là JPEG của B.

## Kết quả UI B và phê duyệt ảnh

B1–B2 do người dùng kiểm thủ công trên Chrome thật: đăng nhập Organizer/mở trang và lưu ảnh đạt; tại 13:46 đã đọc ETag "29". B3–B8 chạy hai page trong cùng browser context, đăng nhập Organizer thật qua form và gọi stack Gateway thật. Không dùng token tự ký hay frontend bypass.

| Mục | Trước bản sửa UI | Sau bản sửa UI trong 8245e43 | Bằng chứng chính sau sửa |
|---|---|---|---|
| B3 xung đột có File | Đạt | Đạt | Hai vòng 200/412 và 200/412/200; giữ chữ/File, Dùng bản mới bỏ nháp, lưu lại giữ đúng SHA-256 ảnh A |
| B4 keep | Đạt | Đạt | 200/412/200; blob preview và server khớp SHA-256 ảnh B; hiển thị Sẽ giữ ảnh hiện tại trên hệ thống |
| B5 rời trang | Đạt | Đạt | 0 PUT khi điều hướng; modal, Ở lại/Rời trang, beforeunload reload/đóng và khi đang lưu; PUT bị làm chậm hoàn tất 200; danger và focus/Enter ở lại đã kiểm |
| B6 offline | Đạt về luồng, ảnh cho thấy thông báo trùng cần sửa | Đạt | Một trạng thái duy nhất, nháp còn, Lưu/Hủy vẫn dùng được; GET đối chiếu thất bại không còn Đang tải lại; 0 PUT tự gửi lại trong 10 giây; lưu thủ công 200 |
| B7 chỉ đọc | Đạt | Đạt | 1 PUT 403 ORGANIZATION_READ_ONLY, banner chỉ đọc, nháp còn, nút Lưu khóa; đối chiếu stub, chưa phải Tenant thật |
| B8 double submit | Đạt | Đạt | Đúng 1 PUT 200; cấu hình cuối hợp lệ |

Trước sửa, hai lượt CDP thành công kết thúc ở v9 rồi v18. Sau sửa, các lượt kiểm lại kết thúc ở v27 rồi v36 trên cùng dòng có created_at giữ nguyên. B3/B4 đổi nhãn thành Bản đang lưu trên hệ thống – Tên / Chức danh; B6 gộp thông báo mất response; B5 chọn mặc định an toàn. Người dùng đã duyệt các ảnh mới B3-conflict-1440.png, B4-keep-1440.png, B5-leave-modal-1440.png và B6-offline-1440.png: đạt. Ảnh được giữ ngoài repository.

Một lần đầu CDP dừng do runner đã xóa baseline, không tính là test sản phẩm đạt; runner và baseline đã được kiểm tra trước các lượt thành công. Một lượt test song song gặp tranh cổng 5173 và timeout browser harness; lượt xác nhận cuối chạy tuần tự theo file đạt 470/470, không skip, không giảm assertion. Không sửa signer.repository. Lỗi TS2305 Tenant do node_modules tái dùng trỏ checkout khác; không phải lỗi mã Tenant hoặc S1.

## Cleanup cuối đã xác nhận

Ngày 2026-10-25 (Asia/Saigon), sau khi người dùng duyệt ảnh và yêu cầu cleanup. Khi bắt đầu, stack và Docker daemon đã dừng; bật lại Docker Desktop/container và stack với env/database/fixture cũ, không migrate, seed, reset hay tạo lại database. Lần đầu Identity dừng vì PostgreSQL còn khởi động; kiểm tra ba database reachable rồi chạy lại thành công. Không cleanup tự động do lỗi khởi động.

| Bước | Bằng chứng | Kết quả |
|---|---|---|
| Remove ảnh còn gắn settings | Login Organizer thật qua Gateway; PUT multipart remove với If-Match trả 200 | Đạt |
| Chờ cleanup worker | Task cleanup của Organization smoke = 0; cleanup delay 6000 ms > lease 1000 ms + storage timeout 3000 ms | Đạt |
| Xác nhận Cloudinary | Cả 5 asset key đã ghi nhận trả not_found sau worker, không fallback delete; Admin API không còn image authenticated nào dưới prefix riêng của Organization smoke | Đạt |
| Xóa settings sau xác nhận storage | DELETE đúng Organization smoke: 1 dòng; truy vấn lại còn 0 dòng | Đạt |
| DROP database/role riêng | smoke_identity, smoke_tenant, smoke_achievement và role owner riêng đã xóa; truy vấn pg_database/pg_roles xác nhận không còn; không đụng database có sẵn | Đạt |
| Xóa secrets của lần chạy | File env và credentials.local.json đã xóa; kiểm tồn tại đều false | Đạt |
| Dừng stack | Runner/stub, Vite, Gateway, Identity, Tenant, achievement đã dừng; rà process không còn tiến trình smoke | Đạt |
| Khôi phục PostgreSQL | learnup-l13-postgres trở về exited như ban đầu | Đạt |
| Giữ bằng chứng | Ảnh B3–B6 đã duyệt và kết quả không chứa secret được giữ ngoài repo | Đạt |

Không còn settings/task/asset/fixture database của smoke. Tenant /access thật cho achievement, giới hạn body ingress/reverse proxy (cần ít nhất khoảng 3 MB) và PDF vẫn chưa kiểm chứng; kết quả stub không thay thế các kiểm tra này. Không sửa backend/signer.repository trong bước hoàn tất. Commit docs riêng, chỉ push nhánh sau khi người dùng phê duyệt.
