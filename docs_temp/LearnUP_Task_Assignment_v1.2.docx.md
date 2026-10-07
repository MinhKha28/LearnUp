**ĐỒ ÁN TỐT NGHIỆP**

**LearnUP**

*Hệ thống quản lý đào tạo nội bộ doanh nghiệp (B2B SaaS)*

**PHÂN CÔNG CÔNG VIỆC KỲ 8**

\---o0o---

| Thông tin | Nội dung |
| ----- | ----- |
| Tên tài liệu | LearnUP\_Task\_Assignment |
| Phiên bản | 1.2 |
| Ngày | 05/10/2026 |
| Người lập | Đinh Việt Hào (trưởng nhóm) |

**MỤC LỤC**

**1\. Tổng quan	3**

1.1. Mục tiêu kỳ 8	3

1.2. Phạm vi	3

1.3. Nhân sự và vai trò	3

1.4. Quy tắc tính điểm	3

1.5. Điều kiện qua môn	4

1.6. Quy ước frontend	4

**2\. Bảng tổng hợp	4**

**3\. Phân công theo service	5**

**4\. Chi tiết từng thành viên	6**

4.1. Đinh Việt Hào — 1680 điểm, 20 UC	6

4.2. Phạm Thanh Lượng — 1740 điểm, 22 UC	6

4.3. Lê Minh Kha — 1740 điểm, 21 UC	7

4.4. Ngô Thành Danh — 1740 điểm, 20 UC	7

4.5. Võ Chí Trọng — 1500 điểm, 20 UC	8

**5\. Lịch theo mốc	9**

**6\. Phụ thuộc giữa các thành viên	10**

**7\. Thứ tự hoàn thiện màn hình	11**

**8\. Use Case của Đạt và kế hoạch đổi lại ở kỳ 9	12**

8.1. Phân công hai phiên bản	12

8.2. Hợp đồng chung giữa hai phiên bản	12

8.3. api-gateway	13

**9\. Bàn giao kỳ 9	13**

**10\. Quy ước làm việc	13**

**11\. Ghi chú theo góp ý giảng viên	13**

11.1. UC25.3 – đăng ký đồng thời và spam	13

11.2. UC33 – phạm vi mức Hard	14

11.3. Điều kiện giữ mức cho Use Case "Có thể hạ"	14

11.4. Cơ hội nâng mức	15

11.5. Rủi ro gộp Use Case và phương án dự phòng	15

11.6. Tài liệu cần cập nhật theo phiên bản này	15

**Phụ lục. Danh sách 103 Use Case kỳ 8	16**

A. Use Case tính điểm kỳ 8 (103 UC, NestJS)	16

B. Thay đổi so với phiên bản 1.1	18

# **1\. Tổng quan**

## **1.1. Mục tiêu kỳ 8**

Hoàn thành trọn vẹn các Use Case giai đoạn 1 (GĐ1) của LearnUP qua ba mốc Inter, mỗi Use Case gồm cả backend và màn hình frontend, chạy được trên kiến trúc microservices của nhóm. Cuối Inter 3, luồng chính phải chạy thông bằng code của chính 5 thành viên kỳ 8: đăng ký Organization, đăng nhập, tạo Course, phê duyệt, phân công, học, làm bài, chấm, chốt điểm, cấp Certificate, gửi thông báo và ghi nhật ký.

## **1.2. Phạm vi**

Kỳ 8 tính điểm cho 103 Use Case, toàn bộ viết bằng NestJS, gồm: 94 Use Case GĐ1 của LearnUP\_UseCase.docx (đã bỏ UC02.2 theo góp ý giảng viên), UC33.1 chuyển từ GĐ2 sang ở phiên bản 1.1, và 8 Use Case GĐ2 kéo lên ở phiên bản 1.2 (UC10, UC10.1, UC10.2, UC18.5, UC19.4, UC24.5, UC24.6, UC25.4). 8 Use Case của identity-service, notification-service và audit-service trước đây do Đạt làm bằng Java nay được 5 thành viên kỳ 8 làm lại bằng NestJS, vì luồng đăng nhập và thông báo do người ngoài lớp viết thì hệ thống không được coi là hoàn chỉnh khi bảo vệ cuối môn. Đạt tiếp tục viết bản Java của các service này để thay vào ở kỳ 9 (mục 8).

## **1.3. Nhân sự và vai trò**

| Thành viên | Vai trò | Service chính |
| :---: | ----- | ----- |
| Hào | Trưởng nhóm, thành viên kỳ 8 | learning-service, achievement-reporting-service |
| Phạm Thanh Lượng | Thành viên kỳ 8 | tenant-service (lõi), identity-service (bản kỳ 8\) |
| Lê Minh Kha | Thành viên kỳ 8 | course-service, UC05.1 của identity-service |
| Ngô Thành Danh | Thành viên kỳ 8 | assessment-service (lõi), notification-service và audit-service (bản kỳ 8\) |
| Võ Chí Trọng | Thành viên kỳ 8, chỉ tham gia kỳ 8; phần việc bàn giao lại ở kỳ 9 (mục 9\) | tenant-service (quản lý tài khoản), assessment-service (soạn Quiz) |
| Đạt | Thành viên đồ án, không học lớp kỳ 8 | Bản Java của identity-service, notification-service, audit-service cho kỳ 9; api-gateway (mục 8\) |

## **1.4. Quy tắc tính điểm**

Mỗi Use Case được xếp một mức độ khó theo khối lượng và tính chất công việc:

| Độ khó | Điểm | Tiêu chí |
| :---: | :---: | ----- |
| Simple | 60 | Tính năng dễ thuộc nhóm CRUD; mỗi thao tác Create, Read, Update hoặc Delete tính là một task riêng. |
| Medium | 120 | Nghiệp vụ phức tạp hơn, có kiểm tra ràng buộc và xử lý lỗi (ví dụ thanh toán), hoặc research dễ như OTP, Socket.IO. |
| Hard | 240 | Research hoặc giải thuật cao hơn (ví dụ hệ gợi ý, AI). |

Cách áp dụng, rút ra từ góp ý của giảng viên sau Inter 1\. Ở Inter 1, giảng viên xem 13 Use Case Medium: hạ UC03, UC04, UC14.2, UC19.5; đặt câu hỏi về UC25.3; giữ nguyên UC02, UC02.1, UC12.2, UC13.2, UC18.3, UC19.2, UC20, UC21.3; đồng thời bỏ UC02.2 vì nằm trong luồng UC02. Từ đó nhóm thống nhất:

* Simple: form của một đối tượng có kiểm tra dữ liệu và một điều kiện chặn (UC19.5, UC14.2 khi chưa tải ảnh); bước nhập mã hoặc mở liên kết để xác minh (UC03, UC04); màn hình chỉ để xem.

* Không tính là Use Case riêng: bước nối tiếp hoặc lối vào lại của một Use Case khác (UC02.2).

* Đổi trạng thái một cột vẫn là Simple nếu phần việc ngoài câu lệnh cập nhật chỉ là kiểm điều kiện và phát event; hệ quả ở service nhận event thuộc Use Case của bên nhận.

* Medium khi phần việc ngoài CRUD có ít nhất một trong bốn thứ: (1) phối hợp từ hai service trở lên theo thứ tự, có xử lý khi bước sau thất bại; (2) tranh chấp đồng thời phải chặn được; (3) tính lại trạng thái dẫn xuất hoặc lan ra nhiều bản ghi, nhận event trùng không làm sai; (4) tích hợp bên ngoài như thanh toán, OAuth, email mời có vòng đời liên kết, tải tệp, realtime.

* Mọi Use Case Medium phải trả lời được câu hỏi về bấm đồng thời, spam và hiệu năng (như câu hỏi của giảng viên về UC25.3).

* Hard chỉ dành cho research hoặc giải thuật; hiện chỉ còn UC33.

Cột "Rủi ro" ở mục 4 dùng các giá trị: Chắc (đã được giảng viên giữ hoặc có cơ chế rõ theo tiêu chí trên); Có thể hạ (vẫn ghi mức hiện tại nhưng phải có đủ điều kiện ở mục 11.3 khi demo, nếu không sẽ bị hạ một bậc); Thầy hạ (giảng viên đã hạ ở Inter 1); Tự hạ (nhóm chủ động hạ trước theo tiêu chí trên).

## **1.5. Điều kiện qua môn**

Mỗi thành viên kỳ 8 phải đạt tối thiểu 1440 điểm. Phiên bản 1.2 tính hai con số cho mỗi người: điểm dự kiến (theo mức ghi trong bảng) và điểm thấp nhất (giả sử mọi Use Case "Có thể hạ" đều bị hạ một bậc). Mọi thành viên phải đạt từ 1440 ở cả hai con số, để không ai tụt dưới ngưỡng nếu giảng viên tiếp tục hạ cấp ở Inter 2 và Inter 3\.

8 Use Case của Đạt được giao cho ba thành viên bị hạ điểm ở Inter 1 là Lượng (UC03, UC04, UC02.2), Kha (UC14.2) và Danh (UC19.5), đồng thời làm phần dự phòng cho hai mốc còn lại. Hào bổ sung 3 Use Case GĐ2 vì sau khi tự hạ UC24.3 và UC28 thì điểm thấp nhất chỉ còn 1260\. Trọng không cần bổ sung vì mọi Use Case Medium còn lại đều ở mức Chắc. Danh sách thay đổi chi tiết ở Phụ lục B.

## **1.6. Quy ước frontend**

Frontend đi theo người nhận Use Case: ai nhận Use Case thì làm cả API và phần giao diện của Use Case đó. Một màn hình có Use Case của nhiều người thì người nhận Use Case gốc của màn hình (mã không có phần thập phân) dựng khung màn hình, người còn lại bổ sung thao tác của mình vào khung đó (danh sách ở mục 7).

# **2\. Bảng tổng hợp**

| Thành viên | Service phụ trách | Số UC | Inter 1 | Inter 2 | Inter 3 | Tổng dự kiến | Thấp nhất | Ngưỡng 1440 |
| :---: | ----- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Hào | learning, achievement-reporting, course, assessment | 20 | 420 | 600 | 660 | 1680 | 1560 | Đạt |
| Lượng | tenant, identity, assessment | 22 | 420 | 660 | 660 | 1740 | 1560 | Đạt |
| Kha | course, identity | 21 | 600 | 660 | 480 | 1740 | 1560 | Đạt |
| Danh | assessment, notification, audit | 20 | 360 | 720 | 660 | 1740 | 1560 | Đạt |
| Trọng | tenant, assessment, course | 20 | 600 | 540 | 360 | 1500 | 1500 | Đạt |
| Tổng |  | 103 | 2400 | 3180 | 2820 | 8400 | 7740 |  |

Điểm chia theo mốc không đều vì thứ tự làm bám theo chuỗi phụ thuộc (mục 6). Inter 1 đã demo ngày 02/10/2026; điểm Inter 1 trong bảng là điểm sau khi giảng viên hạ cấp. UC05 (Đăng nhập) của Lượng xếp đầu Inter 2 vì mọi Use Case khác đều cần đăng nhập.

# **3\. Phân công theo service**

| Service | UC kỳ 8 | Chủ chính | Cụm UC giao cho người khác | Lý do |
| ----- | :---: | :---: | ----- | ----- |
| tenant-service | 29 | Lượng | Trọng: UC12–UC12.6, UC13–UC13.6 | Cân điểm giữa các thành viên; kỳ 9 bàn giao lại (mục 9). |
| identity-service | 5 | Lượng | Kha: UC05.1 | Bản kỳ 8 viết bằng NestJS; tài khoản người dùng nằm ở tenant-service của Lượng. Kỳ 9 thay bằng bản Java của Đạt (mục 8). |
| course-service | 23 | Kha | Hào: UC25, UC25.1; Trọng: UC14.4 | UC25, UC25.1 cùng màn hình danh mục với UC25.3 của Hào; UC14.4 chỉ đọc, đứng riêng. |
| learning-service | 14 | Hào | — | — |
| assessment-service | 26 | Danh | Trọng: UC18–UC18.4; Lượng: UC32–UC32.2; Hào: UC32.3 | Soạn Quiz tách được khỏi luồng Assignment; UC32 là màn hình riêng của Instructor; UC32.3 nối thẳng vào learning-service. |
| achievement-reporting-service | 3 | Hào | — | — |
| notification-service | 1 | Danh | — | Bản kỳ 8 viết bằng NestJS; kỳ 9 thay bằng bản Java của Đạt. |
| audit-service | 2 | Danh | — | Như notification-service. |
| api-gateway | — | Đạt | — | Không có UC riêng; chờ giảng viên xác nhận được giữ như hạ tầng (mục 8.3). |
| Tổng | 103 |  |  |  |

# **4\. Chi tiết từng thành viên**

## **4.1. Đinh Việt Hào — 1680 điểm, 20 UC**

Phạm vi: learning-service trọn, achievement-reporting-service trọn, UC25 và UC25.1 của course-service, UC32.3 của assessment-service. Bổ sung từ GĐ2: UC25.4, UC24.5, UC24.6, khép kín vòng đời Enrollment. Điểm thấp nhất: 1560\.

| Mốc | Mã UC | Use Case | Service | Màn hình | Độ khó | Điểm | Rủi ro |
| ----- | :---: | ----- | :---: | :---: | :---: | :---: | :---: |
| Inter 1 | UC25 | Xem danh mục Course | course | UC25 | Simple | 60 | — |
| Inter 1 | UC25.1 | Xem giới thiệu Course | course | UC25 | Simple | 60 | — |
| Inter 1 | UC25.3 | Đăng ký Course tự chọn | learning | UC25 | Medium | 120 | Có thể hạ |
| Inter 1 | UC26 | Xem Course của tôi | learning | UC26 | Simple | 60 | — |
| Inter 1 | UC27 | Xem chương trình học | learning | UC27 | Simple | 60 | — |
| Inter 1 | UC27.1 | Xem chi tiết Lesson | learning | UC27 | Simple | 60 | — |
| **Tổng Inter 1** |  |  |  |  |  | **420** |  |
| Inter 2 | UC24 | Xem danh sách phân công | learning | UC24 | Simple | 60 | — |
| Inter 2 | UC24.1 | Xem chi tiết phân công | learning | UC24 | Simple | 60 | — |
| Inter 2 | UC24.2 | Phân công Course | learning | UC24 | Medium | 120 | Chắc |
| Inter 2 | UC24.3 | Điều chỉnh hạn hoàn thành | learning | UC24 | Simple | 60 | Tự hạ |
| Inter 2 | UC27.2 | Xem học liệu Video | learning | UC27 | Medium | 120 | Chắc |
| Inter 2 | UC25.4 | Rút khỏi Course tự chọn | learning | UC27 | Medium | 120 | Chắc; Từ GĐ2 |
| Inter 2 | UC24.5 | Đánh dấu Miễn | learning | UC24 | Simple | 60 | Từ GĐ2 |
| **Tổng Inter 2** |  |  |  |  |  | **600** |  |
| Inter 3 | UC27.3 | Hoàn thành học liệu Reading | learning | UC27 | Medium | 120 | Có thể hạ |
| Inter 3 | UC28 | Xem tiến độ học tập | learning | UC28 | Simple | 60 | Tự hạ |
| Inter 3 | UC32.3 | Chốt điểm cuối cùng | assessment | UC32 | Medium | 120 | Chắc |
| Inter 3 | UC34 | Xem danh sách Certificate | achievement-reporting | UC34 | Simple | 60 | — |
| Inter 3 | UC34.1 | Xem chi tiết Certificate | achievement-reporting | UC34 | Simple | 60 | — |
| Inter 3 | UC34.2 | Tải Certificate PDF | achievement-reporting | UC34 | Medium | 120 | Chắc |
| Inter 3 | UC24.6 | Gỡ đánh dấu Miễn | learning | UC24 | Medium | 120 | Chắc; Từ GĐ2 |
| **Tổng Inter 3** |  |  |  |  |  | **660** |  |
| **Tổng cả kỳ (20 UC)** |  |  |  |  |  | **1680** | **Thấp nhất 1560** |

## **4.2. Phạm Thanh Lượng — 1740 điểm, 22 UC**

Phạm vi: tenant-service lõi (đăng ký, kích hoạt, hồ sơ, Subscription, Plan, mời lại), cụm chấm bài UC32–UC32.2 và bản NestJS của identity-service (UC05, UC06, UC07, UC08). Bổ sung từ GĐ2: UC10, UC10.1, UC10.2. Điểm thấp nhất: 1560\.

| Mốc | Mã UC | Use Case | Service | Màn hình | Độ khó | Điểm | Rủi ro |
| ----- | :---: | ----- | :---: | :---: | :---: | :---: | :---: |
| Inter 1 | UC01 | Xem Subscription Plan | tenant | UC01 | Simple | 60 | — |
| Inter 1 | UC02 | Đăng ký Organization | tenant | UC02 | Medium | 120 | Chắc |
| Inter 1 | UC02.1 | Thực hiện thanh toán | tenant | UC02 | Medium | 120 | Chắc |
| Inter 1 | UC03 | Xác thực email Organizer | tenant | UC03 | Simple | 60 | Thầy hạ |
| Inter 1 | UC04 | Kích hoạt tài khoản | tenant | UC04 | Simple | 60 | Thầy hạ |
| **Tổng Inter 1** |  |  |  |  |  | **420** |  |
| Inter 2 | UC05 | Đăng nhập | identity | UC05 | Medium | 120 | Có thể hạ; UC của Đạt |
| Inter 2 | UC06 | Đăng xuất | identity | UC06 | Simple | 60 | UC của Đạt |
| Inter 2 | UC08 | Đổi mật khẩu | identity | UC08 | Simple | 60 | UC của Đạt |
| Inter 2 | UC09 | Xem hồ sơ cá nhân | tenant | UC09 | Simple | 60 | — |
| Inter 2 | UC09.1 | Cập nhật hồ sơ cá nhân | tenant | UC09 | Simple | 60 | — |
| Inter 2 | UC10 | Xem thông tin Subscription | tenant | UC10 | Simple | 60 | Từ GĐ2 |
| Inter 2 | UC32 | Xem danh sách bài nộp | assessment | UC32 | Simple | 60 | — |
| Inter 2 | UC32.1 | Xem bài nộp | assessment | UC32 | Simple | 60 | — |
| Inter 2 | UC32.2 | Chấm bài nộp | assessment | UC32 | Medium | 120 | Có thể hạ |
| **Tổng Inter 2** |  |  |  |  |  | **660** |  |
| Inter 3 | UC03.1 | Gửi lại liên kết đăng ký | tenant | UC03 | Simple | 60 | Tự hạ |
| Inter 3 | UC07 | Khôi phục mật khẩu | identity | UC07 | Medium | 120 | Có thể hạ; UC của Đạt |
| Inter 3 | UC10.1 | Gia hạn Subscription | tenant | UC10 | Medium | 120 | Chắc; Từ GĐ2 |
| Inter 3 | UC10.2 | Nâng cấp Subscription | tenant | UC10 | Medium | 120 | Chắc; Từ GĐ2 |
| Inter 3 | UC12.7 | Mời lại Instructor | tenant | UC12 | Simple | 60 | Tự hạ |
| Inter 3 | UC13.7 | Mời lại Learner | tenant | UC13 | Simple | 60 | Tự hạ |
| Inter 3 | UC43 | Xem danh sách Plan | tenant | UC43 | Simple | 60 | — |
| Inter 3 | UC43.1 | Tạo Subscription Plan | tenant | UC43 | Simple | 60 | — |
| **Tổng Inter 3** |  |  |  |  |  | **660** |  |
| **Tổng cả kỳ (22 UC)** |  |  |  |  |  | **1740** | **Thấp nhất 1560** |

## **4.3. Lê Minh Kha — 1740 điểm, 21 UC**

Phạm vi: course-service trừ UC25, UC25.1, UC14.4; thêm UC05.1 (đăng nhập bằng Google) của identity-service. Điểm thấp nhất: 1560\.

| Mốc | Mã UC | Use Case | Service | Màn hình | Độ khó | Điểm | Rủi ro |
| ----- | :---: | ----- | :---: | :---: | :---: | :---: | :---: |
| Inter 1 | UC14 | Xem Course phụ trách | course | UC14 | Simple | 60 | — |
| Inter 1 | UC14.2 | Tạo Course | course | UC14 | Simple | 60 | Thầy hạ |
| Inter 1 | UC15 | Xem cấu trúc chương trình | course | UC15 | Simple | 60 | — |
| Inter 1 | UC15.1 | Thêm Module | course | UC15 | Simple | 60 | — |
| Inter 1 | UC15.2 | Thêm Lesson | course | UC15 | Simple | 60 | — |
| Inter 1 | UC20 | Gửi Course phê duyệt | course | UC20 | Medium | 120 | Chắc |
| Inter 1 | UC21.1 | Xem Course chờ duyệt | course | UC21 | Simple | 60 | — |
| Inter 1 | UC21.3 | Phê duyệt Course | course | UC21 | Medium | 120 | Chắc |
| **Tổng Inter 1** |  |  |  |  |  | **600** |  |
| Inter 2 | UC14.1 | Xem chi tiết Course | course | UC14 | Simple | 60 | — |
| Inter 2 | UC14.3 | Cập nhật thông tin Course | course | UC14 | Medium | 120 | Có thể hạ |
| Inter 2 | UC15.3 | Cập nhật cấu trúc chương trình | course | UC15 | Simple | 60 | — |
| Inter 2 | UC16 | Xem chi tiết Lesson | course | UC16 | Simple | 60 | — |
| Inter 2 | UC16.1 | Cập nhật nội dung Lesson | course | UC16 | Simple | 60 | Tự hạ |
| Inter 2 | UC17 | Xem danh sách học liệu | course | UC17 | Simple | 60 | — |
| Inter 2 | UC17.1 | Thêm học liệu Video | course | UC17 | Medium | 120 | Chắc |
| Inter 2 | UC17.2 | Thêm học liệu Reading | course | UC17 | Medium | 120 | Chắc |
| **Tổng Inter 2** |  |  |  |  |  | **660** |  |
| Inter 3 | UC05.1 | Đăng nhập bằng Google | identity | UC05 | Medium | 120 | Chắc; UC của Đạt |
| Inter 3 | UC17.3 | Cập nhật học liệu | course | UC17 | Medium | 120 | Có thể hạ |
| Inter 3 | UC21 | Xem Course tổ chức | course | UC21 | Simple | 60 | — |
| Inter 3 | UC21.2 | Xem nội dung Course | course | UC21 | Simple | 60 | — |
| Inter 3 | UC23 | Chuyển quyền phụ trách | course | UC21 | Medium | 120 | Có thể hạ |
| **Tổng Inter 3** |  |  |  |  |  | **480** |  |
| **Tổng cả kỳ (21 UC)** |  |  |  |  |  | **1740** | **Thấp nhất 1560** |

## **4.4. Ngô Thành Danh — 1740 điểm, 20 UC**

Phạm vi: assessment-service lõi (Assignment, làm bài, nộp bài, chấm chéo, chu kỳ chấm chéo), bản NestJS của notification-service (UC49) và audit-service (UC50, UC51). Bổ sung từ GĐ2: UC18.5, UC19.4. Điểm thấp nhất: 1560\.

| Mốc | Mã UC | Use Case | Service | Màn hình | Độ khó | Điểm | Rủi ro |
| ----- | :---: | ----- | :---: | :---: | :---: | :---: | :---: |
| Inter 1 | UC19 | Xem danh sách Assignment | assessment | UC19 | Simple | 60 | — |
| Inter 1 | UC19.1 | Xem chi tiết Assignment | assessment | UC19 | Simple | 60 | — |
| Inter 1 | UC19.2 | Tạo Assignment | assessment | UC19 | Medium | 120 | Chắc |
| Inter 1 | UC19.3 | Cập nhật Assignment | assessment | UC19 | Simple | 60 | — |
| Inter 1 | UC19.5 | Cấu hình Peer Review | assessment | UC19 | Simple | 60 | Thầy hạ |
| **Tổng Inter 1** |  |  |  |  |  | **360** |  |
| Inter 2 | UC18.5 | Xóa Quiz | assessment | UC18 | Simple | 60 | Từ GĐ2 |
| Inter 2 | UC19.4 | Xóa Assignment | assessment | UC19 | Simple | 60 | Từ GĐ2 |
| Inter 2 | UC29 | Xem Assessment cần làm | assessment | UC29 | Simple | 60 | — |
| Inter 2 | UC30 | Nộp bài Assignment | assessment | UC30 | Medium | 120 | Chắc |
| Inter 2 | UC30.2 | Xem kết quả chấm | assessment | UC30 | Simple | 60 | — |
| Inter 2 | UC33 | Xem chu kỳ chấm chéo | assessment | UC33 | Hard | 240 | Có thể hạ |
| Inter 2 | UC49 | Xem thông báo hệ thống | notification | UC49 | Medium | 120 | Chắc; UC của Đạt |
| **Tổng Inter 2** |  |  |  |  |  | **720** |  |
| Inter 3 | UC29.1 | Thực hiện Quiz | assessment | UC29 | Medium | 120 | Chắc |
| Inter 3 | UC30.1 | Nộp lại bài Assignment | assessment | UC30 | Medium | 120 | Có thể hạ |
| Inter 3 | UC31 | Xem bài cần chấm | assessment | UC31 | Simple | 60 | — |
| Inter 3 | UC31.1 | Chấm bài chéo | assessment | UC31 | Medium | 120 | Chắc |
| Inter 3 | UC33.1 | Xem chi tiết chu kỳ | assessment | UC33 | Simple | 60 | Tự hạ |
| Inter 3 | UC33.2 | Miễn nghĩa vụ chấm chéo | assessment | UC33 | Simple | 60 | — |
| Inter 3 | UC50 | Xem nhật ký tổ chức | audit | UC50 | Simple | 60 | UC của Đạt |
| Inter 3 | UC51 | Xem nhật ký nền tảng | audit | UC51 | Simple | 60 | UC của Đạt |
| **Tổng Inter 3** |  |  |  |  |  | **660** |  |
| **Tổng cả kỳ (20 UC)** |  |  |  |  |  | **1740** | **Thấp nhất 1560** |

## **4.5. Võ Chí Trọng — 1500 điểm, 20 UC**

Phạm vi: Quản lý tài khoản Instructor và Learner của tenant-service, soạn Quiz của assessment-service, UC14.4 của course-service. Điểm thấp nhất: 1500\.

| Mốc | Mã UC | Use Case | Service | Màn hình | Độ khó | Điểm | Rủi ro |
| ----- | :---: | ----- | :---: | :---: | :---: | :---: | :---: |
| Inter 1 | UC12 | Xem danh sách Instructor | tenant | UC12 | Simple | 60 | — |
| Inter 1 | UC12.2 | Thêm Instructor | tenant | UC12 | Medium | 120 | Chắc |
| Inter 1 | UC13 | Xem danh sách Learner | tenant | UC13 | Simple | 60 | — |
| Inter 1 | UC13.2 | Thêm Learner | tenant | UC13 | Medium | 120 | Chắc |
| Inter 1 | UC18 | Xem danh sách Quiz | assessment | UC18 | Simple | 60 | — |
| Inter 1 | UC18.2 | Tạo Quiz | assessment | UC18 | Simple | 60 | — |
| Inter 1 | UC18.3 | Quản lý câu hỏi Quiz | assessment | UC18 | Medium | 120 | Chắc |
| **Tổng Inter 1** |  |  |  |  |  | **600** |  |
| Inter 2 | UC12.1 | Xem chi tiết Instructor | tenant | UC12 | Simple | 60 | — |
| Inter 2 | UC13.1 | Xem chi tiết Learner | tenant | UC13 | Simple | 60 | — |
| Inter 2 | UC12.3 | Cập nhật thông tin Instructor | tenant | UC12 | Simple | 60 | Tự hạ |
| Inter 2 | UC13.3 | Cập nhật thông tin Learner | tenant | UC13 | Simple | 60 | Tự hạ |
| Inter 2 | UC12.4 | Tìm kiếm Instructor | tenant | UC12 | Simple | 60 | — |
| Inter 2 | UC13.4 | Tìm kiếm Learner | tenant | UC13 | Simple | 60 | — |
| Inter 2 | UC18.1 | Xem chi tiết Quiz | assessment | UC18 | Simple | 60 | — |
| Inter 2 | UC18.4 | Cập nhật cấu hình Quiz | assessment | UC18 | Simple | 60 | — |
| Inter 2 | UC14.4 | Tìm kiếm Course | course | UC14 | Simple | 60 | — |
| **Tổng Inter 2** |  |  |  |  |  | **540** |  |
| Inter 3 | UC12.5 | Đổi trạng thái Instructor | tenant | UC12 | Medium | 120 | Chắc |
| Inter 3 | UC12.6 | Xóa tài khoản Instructor | tenant | UC12 | Medium | 120 | Chắc |
| Inter 3 | UC13.5 | Đổi trạng thái Learner | tenant | UC13 | Simple | 60 | Tự hạ |
| Inter 3 | UC13.6 | Xóa tài khoản Learner | tenant | UC13 | Simple | 60 | Tự hạ |
| **Tổng Inter 3** |  |  |  |  |  | **360** |  |
| **Tổng cả kỳ (20 UC)** |  |  |  |  |  | **1500** | **Thấp nhất 1500** |

# **5\. Lịch theo mốc**

| Thành viên | Inter 1 | Inter 2 | Inter 3 |
| :---: | ----- | ----- | ----- |
| Hào | UC25, UC25.1, UC25.3, UC26, UC27, UC27.1 (420 đ) | UC24, UC24.1, UC24.2, UC24.3, UC27.2, UC25.4, UC24.5 (600 đ) | UC27.3, UC28, UC32.3, UC34, UC34.1, UC34.2, UC24.6 (660 đ) |
| Lượng | UC01, UC02, UC02.1, UC03, UC04 (420 đ) | UC05, UC06, UC08, UC09, UC09.1, UC10, UC32, UC32.1, UC32.2 (660 đ) | UC03.1, UC07, UC10.1, UC10.2, UC12.7, UC13.7, UC43, UC43.1 (660 đ) |
| Kha | UC14, UC14.2, UC15, UC15.1, UC15.2, UC20, UC21.1, UC21.3 (600 đ) | UC14.1, UC14.3, UC15.3, UC16, UC16.1, UC17, UC17.1, UC17.2 (660 đ) | UC05.1, UC17.3, UC21, UC21.2, UC23 (480 đ) |
| Danh | UC19, UC19.1, UC19.2, UC19.3, UC19.5 (360 đ) | UC18.5, UC19.4, UC29, UC30, UC30.2, UC33, UC49 (720 đ) | UC29.1, UC30.1, UC31, UC31.1, UC33.1, UC33.2, UC50, UC51 (660 đ) |
| Trọng | UC12, UC12.2, UC13, UC13.2, UC18, UC18.2, UC18.3 (600 đ) | UC12.1, UC13.1, UC12.3, UC13.3, UC12.4, UC13.4, UC18.1, UC18.4, UC14.4 (540 đ) | UC12.5, UC12.6, UC13.5, UC13.6 (360 đ) |
| Đạt | UC05 (bản Java), api-gateway | Bản Java UC05.1, UC06, UC08 | Bản Java UC07, UC49, UC50, UC51 (dùng ở kỳ 9\) |

Điểm trong ngoặc là tổng điểm của thành viên ở mốc đó. Phần của Đạt không tính điểm kỳ 8\.

# **6\. Phụ thuộc giữa các thành viên**

Cột "Mốc cần xong" là mốc mà UC phía trước phải hoàn thành. Dòng ghi "cùng mốc" nghĩa là hai bên làm trong cùng một mốc: người được phụ thuộc làm UC đó ở đầu mốc, người phụ thuộc dùng dữ liệu mẫu (seed) để làm song song cho tới khi ghép. Subscription Plan được seed sẵn cho tới khi UC43.1 của Lượng xong ở Inter 3\.

| UC của ai | Cần UC nào của ai xong trước | Mốc cần xong |
| ----- | ----- | :---: |
| Mọi UC của cả nhóm | Lượng: UC05 (bản NestJS); trước khi xong dùng proxy dev (D37) | Inter 2 (đầu mốc) |
| Kha: UC05.1 | Lượng: UC05 (phát hành token, hợp đồng mục 8.2) | Inter 2 |
| Lượng: UC07; mọi UC gửi email (UC02, UC12.2, UC13.2, UC24.2, UC32.3…) | Danh: phần gửi email của UC49. Trước khi xong dùng tạm bản Java của Đạt ở môi trường dev | Inter 2 (đầu mốc) |
| Trọng: UC12.2, UC13.2 | Lượng: UC04 (người được mời kích hoạt tài khoản) | Inter 1 (đã xong) |
| Kha: UC14.2 | Trọng: UC12.2; Lượng: UC04 | Inter 1 (đã xong) |
| Danh: UC19.2; Trọng: UC18.2 | Kha: UC14.2, UC15.1 | Inter 1 (đã xong) |
| Kha: UC20 | Trọng: UC18.3 (BR-323) | Inter 1 (đã xong) |
| Hào: UC25, UC25.1, UC25.3, UC27, UC27.1 | Kha: UC15.1, UC15.2, UC20, UC21.3; Trọng: UC13.2 | Inter 1 (đã xong) |
| Lượng: UC12.7, UC13.7 | Trọng: UC12.2, UC13.2 | Inter 1 (đã xong) |
| Hào: UC24.2; Danh: UC29, UC30 | Kha: UC21.3; Trọng: UC13.2; Hào: UC25.3 | Inter 1 (đã xong) |
| Hào: UC25.4 | Danh: endpoint nội bộ "Learner đã có kết quả đánh giá trong Course chưa" (BR-131) | Inter 2 (cùng mốc) |
| Hào: UC27.2 | Kha: UC17.1 | Inter 2 (cùng mốc) |
| Lượng: UC32, UC32.1, UC32.2 | Danh: UC30 | Inter 2 (cùng mốc) |
| Danh: UC18.5 | Trọng: UC18 (khung màn hình) | Inter 1 (đã xong) |
| Hào: UC27.3 | Kha: UC17.2 | Inter 2 |
| Hào: UC32.3 | Lượng: UC32.2; Danh: UC31.1 | Inter 2; Inter 3 (cùng mốc) |
| Hào: UC24.6 | Hào: UC24.5, UC27.3 (xét hoàn thành Course) | Inter 3 (cùng mốc) |
| Hào: UC28, UC34 | Danh: UC29.1, UC30 (trạng thái Assessment) | Inter 3 (cùng mốc) |
| Trọng: UC12.5, UC12.6 | Kha: UC23 (BR-41) | Inter 3 (cùng mốc) |
| Danh: UC49 (phần trong ứng dụng) | Các service phát event thông báo qua outbox | Inter 2 |
| Danh: UC50, UC51 | Các service ghi nhật ký theo BR-270 qua outbox | Inter 3 |

Rủi ro lớn nhất: mọi UC đều cần đăng nhập nên UC05 của Lượng phải xong ở đầu Inter 2, và hợp đồng identity ở mục 8.2 phải chốt trước khi Lượng và Kha bắt đầu code. Phần gửi email của UC49 cũng phải xong ở đầu Inter 2 vì nhiều UC đã gửi email từ Inter 1\.

# **7\. Thứ tự hoàn thiện màn hình**

GĐ1 kỳ 8 có 35 màn hình, xếp theo mốc dùng lần đầu. Màn hình phải xong thiết kế trước khi mốc đó bắt đầu code. Màn hình dùng ở nhiều mốc được bổ sung thao tác ở mốc sau, nên dựng trọn bố cục ngay từ mốc đầu.

| Mốc | Mã | Màn hình | Service | Dựng khung | Người bổ sung | Dùng ở Inter |
| :---: | :---: | ----- | :---: | :---: | :---: | :---: |
| 1 | UC01 | Xem Subscription Plan | tenant | Lượng | — | 1 |
| 1 | UC02 | Đăng ký Organization | tenant | Lượng | — | 1 |
| 1 | UC03 | Xác thực email Organizer | tenant | Lượng | — | 1, 3 |
| 1 | UC04 | Kích hoạt tài khoản | tenant | Lượng | — | 1 |
| 1 | UC05 | Đăng nhập | identity | Lượng | Kha | 1, 2, 3 |
| 1 | UC12 | Xem danh sách Instructor | tenant | Trọng | Lượng | 1, 2, 3 |
| 1 | UC13 | Xem danh sách Learner | tenant | Trọng | Lượng | 1, 2, 3 |
| 1 | UC14 | Xem Course phụ trách | course | Kha | Trọng | 1, 2 |
| 1 | UC15 | Xem cấu trúc chương trình | course | Kha | — | 1, 2 |
| 1 | UC18 | Xem danh sách Quiz | assessment | Trọng | Danh | 1, 2 |
| 1 | UC19 | Xem danh sách Assignment | assessment | Danh | — | 1, 2 |
| 1 | UC20 | Gửi Course phê duyệt | course | Kha | — | 1 |
| 1 | UC21 | Xem Course tổ chức | course | Kha | — | 1, 3 |
| 1 | UC25 | Xem danh mục Course | course | Hào | — | 1 |
| 1 | UC26 | Xem Course của tôi | learning | Hào | — | 1 |
| 1 | UC27 | Xem chương trình học | learning | Hào | — | 1, 2, 3 |
| 2 | UC06 | Đăng xuất | identity | Lượng | — | 2 |
| 2 | UC08 | Đổi mật khẩu | identity | Lượng | — | 2 |
| 2 | UC09 | Xem hồ sơ cá nhân | tenant | Lượng | — | 2 |
| 2 | UC10 | Xem thông tin Subscription | tenant | Lượng | — | 2, 3 |
| 2 | UC16 | Xem chi tiết Lesson | course | Kha | — | 2 |
| 2 | UC17 | Xem danh sách học liệu | course | Kha | — | 2, 3 |
| 2 | UC24 | Xem danh sách phân công | learning | Hào | — | 2, 3 |
| 2 | UC29 | Xem Assessment cần làm | assessment | Danh | — | 2, 3 |
| 2 | UC30 | Nộp bài Assignment | assessment | Danh | — | 2, 3 |
| 2 | UC32 | Xem danh sách bài nộp | assessment | Lượng | Hào | 2, 3 |
| 2 | UC33 | Xem chu kỳ chấm chéo | assessment | Danh | — | 2, 3 |
| 2 | UC49 | Xem thông báo hệ thống | notification | Danh | — | 2 |
| 3 | UC07 | Khôi phục mật khẩu | identity | Lượng | — | 3 |
| 3 | UC28 | Xem tiến độ học tập | learning | Hào | — | 3 |
| 3 | UC31 | Xem bài cần chấm | assessment | Danh | — | 3 |
| 3 | UC34 | Xem danh sách Certificate | achievement-reporting | Hào | — | 3 |
| 3 | UC43 | Xem danh sách Plan | tenant | Lượng | — | 3 |
| 3 | UC50 | Xem nhật ký tổ chức | audit | Danh | — | 3 |
| 3 | UC51 | Xem nhật ký nền tảng | audit | Danh | — | 3 |

UC23 dùng màn hình UC21; UC25.4 dùng màn hình UC27; UC24.5, UC24.6 dùng màn hình UC24; UC10.1, UC10.2 dùng màn hình UC10; UC05.1 là nút trên màn hình UC05; UC30.1 và UC30.2 dùng màn hình UC30; UC33.1 dùng màn hình UC33. Màn hình UC05 đã có ở Inter 1 (bản Java của Đạt); ở kỳ 8 Lượng dựng lại khung theo API NestJS. Màn hình UC10 là màn hình mới so với phiên bản 1.1. Nếu nhóm thiết kế khác thì cập nhật bảng này.

# **8\. Use Case của Đạt và kế hoạch đổi lại ở kỳ 9**

## **8.1. Phân công hai phiên bản**

| Mã UC | Use Case | Service | Bản kỳ 8 (NestJS, tính điểm) | Bản kỳ 9 (Java) |
| :---: | ----- | :---: | :---: | :---: |
| UC05 | Đăng nhập | identity | Lượng, Inter 2 | Đạt |
| UC05.1 | Đăng nhập bằng Google | identity | Kha, Inter 3 | Đạt |
| UC06 | Đăng xuất | identity | Lượng, Inter 2 | Đạt |
| UC07 | Khôi phục mật khẩu | identity | Lượng, Inter 3 | Đạt |
| UC08 | Đổi mật khẩu | identity | Lượng, Inter 2 | Đạt |
| UC49 | Xem thông báo hệ thống (kèm gửi email) | notification | Danh, Inter 2 | Đạt |
| UC50 | Xem nhật ký tổ chức | audit | Danh, Inter 3 | Đạt |
| UC51 | Xem nhật ký nền tảng | audit | Danh, Inter 3 | Đạt |

## **8.2. Hợp đồng chung giữa hai phiên bản**

Để kỳ 9 thay bản Java vào mà không phải sửa service nào khác, hai phiên bản phải tuân theo cùng một hợp đồng, chốt trong thư mục contracts trước khi Lượng và Kha bắt đầu code UC05 và UC05.1:

* Đường dẫn và DTO của /api/auth/\*\* và các API của notification-service, audit-service mà frontend gọi.

* Định dạng JWT: ký RS256, có endpoint JWKS công khai khóa; sub là user\_id; claim role và organizationId; thời hạn access token và refresh token; cách giữ refresh token phía trình duyệt.

* Tên topic Kafka và schema event của thông báo và nhật ký, theo cơ chế outbox ở mục 2.3 của LearnUP\_Service\_Architecture.

* Mỗi service NestJS tự kiểm JWT bằng khóa công khai qua một guard dùng chung trong ts-common, không tin header danh tính do client gửi. Nhờ vậy gateway chỉ còn làm định tuyến.

* Một bộ test HTTP theo hợp đồng chạy được cho cả hai phiên bản; kỳ 9 chạy bộ test này trên bản Java trước khi đổi.

Hai phiên bản cùng nằm trên nhánh develop ở hai thư mục riêng (bản Java đặt hậu tố \-java). docker compose chọn phiên bản bằng profile ky8 hoặc ky9. Cách này tách bạch rõ hai phiên bản như một nhánh riêng, nhưng không để hai bên lệch nhau suốt hai tháng rồi phải gộp lại ở kỳ 9\.

## **8.3. api-gateway**

api-gateway không có Use Case riêng. Nhóm hỏi giảng viên có chấp nhận để Đạt giữ api-gateway như hạ tầng có sẵn hay không. Nếu không, vì mọi service đã tự kiểm JWT (mục 8.2), gateway thay được bằng một reverse proxy tối giản do Lượng dựng cùng UC05.

# **9\. Bàn giao kỳ 9**

Trọng chỉ tham gia kỳ 8\. Sang kỳ 9, phần của Trọng được bàn giao như sau:

| UC của Trọng | Người nhận | Lý do |
| :---: | :---: | ----- |
| UC13–UC13.6 | Lượng | Lượng chủ chính tenant-service, đã làm luồng mời UC04 và UC13.7. |
| UC12–UC12.6 | Kha | Xóa Instructor cần chuyển quyền phụ trách UC23 của Kha (BR-41). |
| UC18–UC18.4 | Danh | Danh chủ chính assessment-service; Quiz nối với UC29.1 và UC18.5 của Danh. |
| UC14.4 | Kha | Kha chủ chính course-service. |

Bản NestJS của identity-service, notification-service và audit-service (8 Use Case ở mục 8.1) không bàn giao: kỳ 9 chuyển docker compose sang profile ky9 để chạy bản Java của Đạt sau khi bộ test hợp đồng chạy qua.

# **10\. Quy ước làm việc**

* Tham chiếu Use Case bằng mã UC (ví dụ UC24.2), không dùng số STT.

* Nguồn sự thật về nghiệp vụ là LearnUP\_UseCase.docx, LearnUP\_QuyTacNghiepVu.docx và các tài liệu thiết kế database của từng service. Chỗ nào tài liệu này mâu thuẫn với các tài liệu đó thì theo các tài liệu đó và báo trưởng nhóm.

* Mọi thay đổi phân công (đổi UC, đổi mốc, đổi độ khó) phải báo trưởng nhóm trước và cập nhật lại file này, tăng số phiên bản. Không đổi UC giữa hai người nếu làm một người tụt dưới 1440 điểm ở cột điểm thấp nhất.

* Ai trễ một UC nằm trong mục 6 phải báo ngay cho người phụ thuộc vào UC đó.

* Mọi thay đổi hợp đồng ở mục 8.2 phải báo cả Đạt, vì bản Java phải đổi theo.

# **11\. Ghi chú theo góp ý giảng viên**

## **11.1. UC25.3 – đăng ký đồng thời và spam**

Câu hỏi của giảng viên: một Learner mở hai tab bấm đăng ký cùng lúc; một Course có 1000 lượt đăng ký; kẻ xấu dùng công cụ spam. Cách xử lý bằng bảng tạm rồi lấy từng sự kiện ra xử lý bị loại, vì nó bắt mọi lượt đăng ký của cả hệ thống xếp một hàng trong khi người dùng đang đứng chờ kết quả, bảng phình dần theo thời gian, và bước xử lý vẫn phải tự lọc trùng. Đăng ký tự chọn không giới hạn chỗ (BR-128), nên 1000 người đăng ký một Course không tranh nhau tài nguyên chung nào; thứ duy nhất cần chặn là một người đăng ký trùng. Cách xử lý gồm ba lớp:

* Đúng khi mở hai tab: database phân xử bằng ràng buộc UNIQUE (learner\_id, course\_id) cùng INSERT … ON CONFLICT DO NOTHING. Lượt đến sau đọc lại Enrollment đã có và trả 409 kèm enrollmentId (D21), nên cả hai tab đều chuyển sang nút "Vào học" (BR-298).

* Nhanh khi 1000 người cùng đăng ký: chỉ lượt đầu cần khóa ghi dòng Course để gắn Locked, từ lượt thứ hai course-service chỉ đọc trạng thái; khi nhiều lượt đầu đến cùng lúc, chỉ một lượt lấy cây chương trình nhờ pg\_advisory\_xact\_lock theo phiên bản, các lượt khác dùng lại; trạng thái Subscription được cache 60 giây cho mỗi tổ chức (chậm tối đa 60 giây mới chặn khi tổ chức vào ân hạn, không mất tiền, không sai kết quả học tập); kiểm trùng cục bộ chạy trước mọi lời gọi sang service khác.

* Chặn spam: endpoint bắt buộc đăng nhập nên kẻ spam phải là Learner thật của tổ chức; giới hạn tần suất theo user\_id, vượt ngưỡng trả 429\. Ngưỡng khởi điểm 10 lần mỗi phút cho mỗi Learner, vì mỗi lượt thật phải mở trang giới thiệu rồi bấm xác nhận; ngưỡng là cấu hình, chỉnh lại theo log thật. Request trùng không tạo dữ liệu và không gửi email (D19), nên thiệt hại tối đa là CPU, đã bị ngưỡng chặn.

Bằng chứng nộp ở Inter 2 là kết quả chạy script k6 cho ba kịch bản: 1000 Learner cùng đăng ký một Course mới (phải ra đúng 1000 Enrollment, chỉ một lần lấy cây chương trình, kèm thời gian phản hồi p95); một Learner gửi 50 request song song (phải ra đúng 1 Enrollment); một Learner gửi 100 request mỗi giây (nhận 429 sau ngưỡng, database không đổi).

## **11.2. UC33 – phạm vi mức Hard**

Tên Use Case là "Xem chu kỳ chấm chéo" nên dễ bị đánh giá là màn hình xem. Phần Hard của UC33 là bộ máy chu kỳ chấm chéo chạy theo lịch: tạo chu kỳ theo lưới lịch và múi giờ Organization (BR-312), chốt chu kỳ, sinh hoán vị ngẫu nhiên và gán vòng để không ai chấm bài của chính mình và mỗi bài nhận đúng N lượt (BR-202, BR-203), quyết định chấm chéo hay chuyển Instructor khi thiếu bài (BR-197), nhắc trước hạn và kết thúc hạn đánh giá (BR-189, BR-194). Khi demo, Danh kích hoạt việc chốt chu kỳ ngay trên màn hình UC33 và trình bày test chứng minh tính đúng của phép gán với nhiều kích thước tập người nộp, và chốt lại nhiều lần vẫn cho cùng kết quả.

## **11.3. Điều kiện giữ mức cho Use Case "Có thể hạ"**

| UC | Người | Phải có khi demo, nếu thiếu thì hạ một bậc |
| :---: | :---: | ----- |
| UC25.3 | Hào | Ba lớp xử lý và số đo k6 ở mục 11.1. |
| UC27.3 | Hào | Gánh việc xét hoàn thành Course (BR-211, BR-212) mỗi khi học liệu hoàn thành; demo trọn chuỗi: đánh dấu học liệu bắt buộc cuối cùng, Enrollment chuyển Completed, event EnrollmentCompleted, Certificate xuất hiện ở UC34. |
| UC05 | Lượng | Băm mật khẩu, access token và refresh token xoay vòng, phát hiện refresh token bị dùng lại, kiểm trạng thái tài khoản, Subscription và Organization qua tenant-service (BR-27), chặn dò mật khẩu. |
| UC07 | Lượng | Phản hồi trung tính không lộ email có tồn tại hay không, giới hạn số lần gửi, liên kết dùng một lần và hết hạn, thu hồi mọi refresh token sau khi đặt lại mật khẩu. |
| UC32.2 | Lượng | Chấm theo từng tiêu chí Rubric (BR-324) và xử lý đủ năm tình huống Instructor chấm trực tiếp (BR-206), gồm chấm bù vị trí thiếu của chu kỳ. |
| UC14.3 | Kha | Thay ảnh bìa qua MinIO có giữ chỗ dung lượng; đổi courseType thì thông báo Organizer và ghi nhật ký (BR-60); cảnh báo vượt sức chứa (BR-55). |
| UC17.3 | Kha | Thay tệp lỗi kỹ thuật tác động lên tệp dùng chung (BR-87, BR-104); đổi cờ bắt buộc bị chặn khi Locked (BR-90). |
| UC23 | Kha | Chuyển quyền cả chuỗi phiên bản (BR-287), có hiệu lực ngay với quyền chấm điểm ở assessment-service; demo cùng UC12.5, UC12.6 của Trọng. |
| UC30.1 | Danh | Thay bài trong chu kỳ chưa chốt, đưa thẳng cho Instructor khi chu kỳ đã chốt (BR-171), ngoại lệ Learner đang nợ nghĩa vụ (BR-313), khóa n lượt/m giờ. |
| UC33 | Danh | Như mục 11.2. Nếu thiếu thì hạ xuống Medium. |

## **11.4. Cơ hội nâng mức**

UC14.2 bị hạ vì chưa có tải ảnh bìa. Hạ tầng tải tệp qua MinIO bắt buộc phải có cho UC17.1, nên Kha bổ sung tải ảnh bìa cho UC14.2 rồi đề nghị giảng viên xét lại mức Medium. Tương tự, UC09.1 của Lượng có tải ảnh đại diện thật thì có căn cứ đề nghị Medium. Hai khoản này không tính vào điểm kế hoạch.

## **11.5. Rủi ro gộp Use Case và phương án dự phòng**

UC03.1, UC12.7 và UC13.7 là thao tác gửi lại, có thể bị giảng viên gộp vào UC03, UC12.2 và UC13.2 như trường hợp UC02.2. Nếu cả ba bị gộp, Lượng còn 1560 điểm dự kiến và 1380 điểm thấp nhất; khi đó Lượng nhận thêm UC11 (Xem thông tin Organization, Simple) và UC11.1 (Cập nhật thông tin Organization, có tải logo, Medium) từ GĐ2 để đưa điểm thấp nhất về 1560\.

## **11.6. Tài liệu cần cập nhật theo phiên bản này**

* LearnUP\_UseCase.docx: bỏ UC02.2 và đưa luồng mở lại đăng ký, thanh toán lại vào Ghi chú của UC02; bỏ UC02.2 khỏi Ghi chú của UC02.1; đổi cột GĐ thành 1 cho UC33.1 và 8 Use Case kéo lên; thống kê còn 166 Use Case; Ghi chú UC25.3 thêm việc đăng ký lặp lại chỉ tạo một Enrollment; Ghi chú UC33 nêu rõ phần việc chạy theo lịch.

* LearnUP\_QuyTacNghiepVu.docx: thêm BR-338 ở mục 7.3: Learner gửi yêu cầu tự đăng ký nhiều lần cho cùng một phiên bản Course chỉ tạo một Enrollment, các lần sau nhận kết quả đã đăng ký. Ngưỡng tần suất không phải quy tắc nghiệp vụ mà là cấu hình.

* LearnUP\_Service\_Architecture.docx: mục 2.2 mở rộng chống lạm dụng sang endpoint cần đăng nhập (giới hạn theo user\_id); mục 3.2, 3.7, 3.8 ghi rõ hai phiên bản NestJS và Java cùng hợp đồng; mục 8 sửa số Use Case của Organization & Commercial thành 44\.

* LearningService\_Database\_Design.md mục 4.1 và CourseService\_Database\_Design.md phần gắn Locked: ghi ba biện pháp hiệu năng ở mục 11.1.

* inter1-uc-spec.md, UC25.3: thêm ngoại lệ E5 (quá nhiều yêu cầu, 429).

# **Phụ lục. Danh sách 103 Use Case kỳ 8**

## **A. Use Case tính điểm kỳ 8 (103 UC, NestJS)**

| Mã UC | Use Case | Service | Người phụ trách | Mốc | Độ khó | Điểm | Rủi ro |
| ----- | ----- | :---: | :---: | :---: | :---: | :---: | :---: |
| UC01 | Xem Subscription Plan | tenant | Lượng | 1 | Simple | 60 | — |
| UC02 | Đăng ký Organization | tenant | Lượng | 1 | Medium | 120 | Chắc |
| UC02.1 | Thực hiện thanh toán | tenant | Lượng | 1 | Medium | 120 | Chắc |
| UC03 | Xác thực email Organizer | tenant | Lượng | 1 | Simple | 60 | Thầy hạ |
| UC03.1 | Gửi lại liên kết đăng ký | tenant | Lượng | 3 | Simple | 60 | Tự hạ |
| UC04 | Kích hoạt tài khoản | tenant | Lượng | 1 | Simple | 60 | Thầy hạ |
| UC05 | Đăng nhập | identity | Lượng | 2 | Medium | 120 | Có thể hạ |
| UC05.1 | Đăng nhập bằng Google | identity | Kha | 3 | Medium | 120 | Chắc |
| UC06 | Đăng xuất | identity | Lượng | 2 | Simple | 60 | — |
| UC07 | Khôi phục mật khẩu | identity | Lượng | 3 | Medium | 120 | Có thể hạ |
| UC08 | Đổi mật khẩu | identity | Lượng | 2 | Simple | 60 | — |
| UC09 | Xem hồ sơ cá nhân | tenant | Lượng | 2 | Simple | 60 | — |
| UC09.1 | Cập nhật hồ sơ cá nhân | tenant | Lượng | 2 | Simple | 60 | — |
| UC10 | Xem thông tin Subscription | tenant | Lượng | 2 | Simple | 60 | — |
| UC10.1 | Gia hạn Subscription | tenant | Lượng | 3 | Medium | 120 | Chắc |
| UC10.2 | Nâng cấp Subscription | tenant | Lượng | 3 | Medium | 120 | Chắc |
| UC12 | Xem danh sách Instructor | tenant | Trọng | 1 | Simple | 60 | — |
| UC12.1 | Xem chi tiết Instructor | tenant | Trọng | 2 | Simple | 60 | — |
| UC12.2 | Thêm Instructor | tenant | Trọng | 1 | Medium | 120 | Chắc |
| UC12.3 | Cập nhật thông tin Instructor | tenant | Trọng | 2 | Simple | 60 | Tự hạ |
| UC12.4 | Tìm kiếm Instructor | tenant | Trọng | 2 | Simple | 60 | — |
| UC12.5 | Đổi trạng thái Instructor | tenant | Trọng | 3 | Medium | 120 | Chắc |
| UC12.6 | Xóa tài khoản Instructor | tenant | Trọng | 3 | Medium | 120 | Chắc |
| UC12.7 | Mời lại Instructor | tenant | Lượng | 3 | Simple | 60 | Tự hạ |
| UC13 | Xem danh sách Learner | tenant | Trọng | 1 | Simple | 60 | — |
| UC13.1 | Xem chi tiết Learner | tenant | Trọng | 2 | Simple | 60 | — |
| UC13.2 | Thêm Learner | tenant | Trọng | 1 | Medium | 120 | Chắc |
| UC13.3 | Cập nhật thông tin Learner | tenant | Trọng | 2 | Simple | 60 | Tự hạ |
| UC13.4 | Tìm kiếm Learner | tenant | Trọng | 2 | Simple | 60 | — |
| UC13.5 | Đổi trạng thái Learner | tenant | Trọng | 3 | Simple | 60 | Tự hạ |
| UC13.6 | Xóa tài khoản Learner | tenant | Trọng | 3 | Simple | 60 | Tự hạ |
| UC13.7 | Mời lại Learner | tenant | Lượng | 3 | Simple | 60 | Tự hạ |
| UC14 | Xem Course phụ trách | course | Kha | 1 | Simple | 60 | — |
| UC14.1 | Xem chi tiết Course | course | Kha | 2 | Simple | 60 | — |
| UC14.2 | Tạo Course | course | Kha | 1 | Simple | 60 | Thầy hạ |
| UC14.3 | Cập nhật thông tin Course | course | Kha | 2 | Medium | 120 | Có thể hạ |
| UC14.4 | Tìm kiếm Course | course | Trọng | 2 | Simple | 60 | — |
| UC15 | Xem cấu trúc chương trình | course | Kha | 1 | Simple | 60 | — |
| UC15.1 | Thêm Module | course | Kha | 1 | Simple | 60 | — |
| UC15.2 | Thêm Lesson | course | Kha | 1 | Simple | 60 | — |
| UC15.3 | Cập nhật cấu trúc chương trình | course | Kha | 2 | Simple | 60 | — |
| UC16 | Xem chi tiết Lesson | course | Kha | 2 | Simple | 60 | — |
| UC16.1 | Cập nhật nội dung Lesson | course | Kha | 2 | Simple | 60 | Tự hạ |
| UC17 | Xem danh sách học liệu | course | Kha | 2 | Simple | 60 | — |
| UC17.1 | Thêm học liệu Video | course | Kha | 2 | Medium | 120 | Chắc |
| UC17.2 | Thêm học liệu Reading | course | Kha | 2 | Medium | 120 | Chắc |
| UC17.3 | Cập nhật học liệu | course | Kha | 3 | Medium | 120 | Có thể hạ |
| UC18 | Xem danh sách Quiz | assessment | Trọng | 1 | Simple | 60 | — |
| UC18.1 | Xem chi tiết Quiz | assessment | Trọng | 2 | Simple | 60 | — |
| UC18.2 | Tạo Quiz | assessment | Trọng | 1 | Simple | 60 | — |
| UC18.3 | Quản lý câu hỏi Quiz | assessment | Trọng | 1 | Medium | 120 | Chắc |
| UC18.4 | Cập nhật cấu hình Quiz | assessment | Trọng | 2 | Simple | 60 | — |
| UC18.5 | Xóa Quiz | assessment | Danh | 2 | Simple | 60 | — |
| UC19 | Xem danh sách Assignment | assessment | Danh | 1 | Simple | 60 | — |
| UC19.1 | Xem chi tiết Assignment | assessment | Danh | 1 | Simple | 60 | — |
| UC19.2 | Tạo Assignment | assessment | Danh | 1 | Medium | 120 | Chắc |
| UC19.3 | Cập nhật Assignment | assessment | Danh | 1 | Simple | 60 | — |
| UC19.4 | Xóa Assignment | assessment | Danh | 2 | Simple | 60 | — |
| UC19.5 | Cấu hình Peer Review | assessment | Danh | 1 | Simple | 60 | Thầy hạ |
| UC20 | Gửi Course phê duyệt | course | Kha | 1 | Medium | 120 | Chắc |
| UC21 | Xem Course tổ chức | course | Kha | 3 | Simple | 60 | — |
| UC21.1 | Xem Course chờ duyệt | course | Kha | 1 | Simple | 60 | — |
| UC21.2 | Xem nội dung Course | course | Kha | 3 | Simple | 60 | — |
| UC21.3 | Phê duyệt Course | course | Kha | 1 | Medium | 120 | Chắc |
| UC23 | Chuyển quyền phụ trách | course | Kha | 3 | Medium | 120 | Có thể hạ |
| UC24 | Xem danh sách phân công | learning | Hào | 2 | Simple | 60 | — |
| UC24.1 | Xem chi tiết phân công | learning | Hào | 2 | Simple | 60 | — |
| UC24.2 | Phân công Course | learning | Hào | 2 | Medium | 120 | Chắc |
| UC24.3 | Điều chỉnh hạn hoàn thành | learning | Hào | 2 | Simple | 60 | Tự hạ |
| UC24.5 | Đánh dấu Miễn | learning | Hào | 2 | Simple | 60 | — |
| UC24.6 | Gỡ đánh dấu Miễn | learning | Hào | 3 | Medium | 120 | Chắc |
| UC25 | Xem danh mục Course | course | Hào | 1 | Simple | 60 | — |
| UC25.1 | Xem giới thiệu Course | course | Hào | 1 | Simple | 60 | — |
| UC25.3 | Đăng ký Course tự chọn | learning | Hào | 1 | Medium | 120 | Có thể hạ |
| UC25.4 | Rút khỏi Course tự chọn | learning | Hào | 2 | Medium | 120 | Chắc |
| UC26 | Xem Course của tôi | learning | Hào | 1 | Simple | 60 | — |
| UC27 | Xem chương trình học | learning | Hào | 1 | Simple | 60 | — |
| UC27.1 | Xem chi tiết Lesson | learning | Hào | 1 | Simple | 60 | — |
| UC27.2 | Xem học liệu Video | learning | Hào | 2 | Medium | 120 | Chắc |
| UC27.3 | Hoàn thành học liệu Reading | learning | Hào | 3 | Medium | 120 | Có thể hạ |
| UC28 | Xem tiến độ học tập | learning | Hào | 3 | Simple | 60 | Tự hạ |
| UC29 | Xem Assessment cần làm | assessment | Danh | 2 | Simple | 60 | — |
| UC29.1 | Thực hiện Quiz | assessment | Danh | 3 | Medium | 120 | Chắc |
| UC30 | Nộp bài Assignment | assessment | Danh | 2 | Medium | 120 | Chắc |
| UC30.1 | Nộp lại bài Assignment | assessment | Danh | 3 | Medium | 120 | Có thể hạ |
| UC30.2 | Xem kết quả chấm | assessment | Danh | 2 | Simple | 60 | — |
| UC31 | Xem bài cần chấm | assessment | Danh | 3 | Simple | 60 | — |
| UC31.1 | Chấm bài chéo | assessment | Danh | 3 | Medium | 120 | Chắc |
| UC32 | Xem danh sách bài nộp | assessment | Lượng | 2 | Simple | 60 | — |
| UC32.1 | Xem bài nộp | assessment | Lượng | 2 | Simple | 60 | — |
| UC32.2 | Chấm bài nộp | assessment | Lượng | 2 | Medium | 120 | Có thể hạ |
| UC32.3 | Chốt điểm cuối cùng | assessment | Hào | 3 | Medium | 120 | Chắc |
| UC33 | Xem chu kỳ chấm chéo | assessment | Danh | 2 | Hard | 240 | Có thể hạ |
| UC33.1 | Xem chi tiết chu kỳ | assessment | Danh | 3 | Simple | 60 | Tự hạ |
| UC33.2 | Miễn nghĩa vụ chấm chéo | assessment | Danh | 3 | Simple | 60 | — |
| UC34 | Xem danh sách Certificate | achievement-reporting | Hào | 3 | Simple | 60 | — |
| UC34.1 | Xem chi tiết Certificate | achievement-reporting | Hào | 3 | Simple | 60 | — |
| UC34.2 | Tải Certificate PDF | achievement-reporting | Hào | 3 | Medium | 120 | Chắc |
| UC43 | Xem danh sách Plan | tenant | Lượng | 3 | Simple | 60 | — |
| UC43.1 | Tạo Subscription Plan | tenant | Lượng | 3 | Simple | 60 | — |
| UC49 | Xem thông báo hệ thống | notification | Danh | 2 | Medium | 120 | Chắc |
| UC50 | Xem nhật ký tổ chức | audit | Danh | 3 | Simple | 60 | — |
| UC51 | Xem nhật ký nền tảng | audit | Danh | 3 | Simple | 60 | — |
| **Tổng** |  |  |  |  |  | **8400** |  |

## **B. Thay đổi so với phiên bản 1.1**

| UC | Người | v1.1 | v1.2 | Lý do |
| :---: | :---: | :---: | :---: | ----- |
| UC02.2 | Lượng | Medium | Bỏ | Giảng viên: nằm trong luồng UC02. |
| UC03, UC04 | Lượng | Medium | Simple | Giảng viên hạ: bước xác minh mã và liên kết. |
| UC14.2 | Kha | Medium | Simple | Giảng viên hạ: chưa có tải ảnh bìa (mục 11.4). |
| UC19.5 | Danh | Medium | Simple | Giảng viên hạ: form cấu hình. |
| UC24.3, UC28 | Hào | Medium | Simple | Tự hạ: sửa một trường; màn hình xem. |
| UC03.1, UC12.7, UC13.7 | Lượng | Medium | Simple | Tự hạ: gửi lại mã hoặc lời mời (mục 11.5). |
| UC16.1 | Kha | Medium | Simple | Tự hạ: sửa văn bản kèm một điều kiện chặn. |
| UC33.1 | Danh | Medium | Simple | Tự hạ: màn hình xem. |
| UC12.3, UC13.3, UC13.5, UC13.6 | Trọng | Medium | Simple | Tự hạ: sửa thông tin; đổi trạng thái hoặc xóa chỉ cập nhật rồi phát event. |
| UC05, UC06, UC07, UC08 | Lượng | Đạt (Java) | Lượng (NestJS) | Bù điểm bị hạ ở Inter 1; identity gắn với tài khoản ở tenant-service. |
| UC05.1 | Kha | Đạt (Java) | Kha (NestJS) | Bù điểm bị hạ ở Inter 1\. |
| UC49, UC50, UC51 | Danh | Đạt (Java) | Danh (NestJS) | Bù điểm bị hạ ở Inter 1; nhắc hạn chấm chéo của Danh đi qua notification-service. |
| UC10, UC10.1, UC10.2 | Lượng | GĐ2 | GĐ1 | Dự phòng: thanh toán gia hạn và nâng cấp dùng lại UC02.1. |
| UC25.4, UC24.5, UC24.6 | Hào | GĐ2 | GĐ1 | Dự phòng: khép kín vòng đời Enrollment; UC25.4 xử lý luôn rủi ro UNIQUE ghi từ Inter 1\. |
| UC18.5, UC19.4 | Danh | GĐ2 | GĐ1 | Dự phòng. |

