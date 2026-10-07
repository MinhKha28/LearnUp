

**Hướng Dẫn Đọc Database**

**LearnUP**

Đồng bộ với tài liệu thiết kế database và quy tắc nghiệp vụ đến BR-336, 167 Use Case

Tháng 9/2026

**MỤC LỤC**

[Phần 0\. Đọc trước	5](#phần-0.-đọc-trước)

[0.1 Tài liệu này dùng thế nào	  5](#0.1-tài-liệu-này-dùng-thế-nào)

[0.2 Mỗi service một database	5](#0.2-mỗi-service-một-database)

[0.3 Kiểu dữ liệu	5](#0.3-kiểu-dữ-liệu)

[0.4 Ràng buộc: database tự chặn dữ liệu sai	6](#0.4-ràng-buộc:-database-tự-chặn-dữ-liệu-sai)

[0.5 Các cột gặp ở mọi bảng	7](#0.5-các-cột-gặp-ở-mọi-bảng)

[0.6 Năm ý hay gặp	8](#0.6-năm-ý-hay-gặp)

[0.7 Câu chuyện mẫu	9](#0.7-câu-chuyện-mẫu)

[Phần 1\. tenant\_db: tổ chức, tài khoản, gói dịch vụ	10](#phần-1.-tenant_db:-tổ-chức,-tài-khoản,-gói-dịch-vụ)

[1.1 Service này lo việc gì	10](#1.1-service-này-lo-việc-gì)

[1.2 Toàn cảnh	10](#1.2-toàn-cảnh)

[1.3 Từng bảng	11](#1.3-từng-bảng)

[organizations	11](#organizations)

[users	11](#users)

[account\_tokens	12](#account_tokens)

[subscription\_plans	13](#subscription_plans)

[registrations	13](#registrations)

[subscriptions	14](#subscriptions)

[payments	15](#payments)

[organization\_suspensions	15](#organization_suspensions)

[platform\_settings	15](#platform_settings)

[outbox\_events	16](#outbox_events)

[1.4 Ví dụ dữ liệu	16](#1.4-ví-dụ-dữ-liệu)

[1.5 Trao đổi với service khác	17](#1.5-trao-đổi-với-service-khác)

[1.6 Không có ở đây	17](#1.6-không-có-ở-đây)

[Phần 2\. course\_db: Course, phiên bản, học liệu	18](#phần-2.-course_db:-course,-phiên-bản,-học-liệu)

[2.1 Service này lo việc gì	18](#2.1-service-này-lo-việc-gì)

[2.2 Toàn cảnh	18](#2.2-toàn-cảnh)

[2.3 Từng bảng	19](#2.3-từng-bảng)

[organization\_quota\_locks	19](#organization_quota_locks)

[course\_chains	19](#course_chains)

[courses	19](#courses)

[modules	21](#modules)

[lessons	21](#lessons)

[materials	21](#materials)

[media\_files	22](#media_files)

[content\_reports (GĐ2)	22](#content_reports-\(gđ2\))

[platform\_settings	23](#platform_settings-1)

[outbox\_events	23](#outbox_events-1)

[2.4 Ví dụ dữ liệu	23](#2.4-ví-dụ-dữ-liệu)

[2.5 Trao đổi với service khác	24](#2.5-trao-đổi-với-service-khác)

[2.6 Không có ở đây	24](#2.6-không-có-ở-đây)

[Phần 3\. learning\_db: phân công, tiến độ, hoàn thành	25](#phần-3.-learning_db:-phân-công,-tiến-độ,-hoàn-thành)

[3.1 Service này lo việc gì	25](#3.1-service-này-lo-việc-gì)

[3.2 Toàn cảnh	25](#3.2-toàn-cảnh)

[3.3 Từng bảng	26](#3.3-từng-bảng)

[enrollments	26](#enrollments)

[enrollment\_status\_intervals (GĐ2)	27](#enrollment_status_intervals-\(gđ2\))

[material\_progress	27](#material_progress)

[course\_version\_snapshots	28](#course_version_snapshots)

[material\_snapshots	28](#material_snapshots)

[lesson\_snapshots (GĐ2)	28](#lesson_snapshots-\(gđ2\))

[organization\_suspensions (GĐ2)	28](#organization_suspensions-\(gđ2\))

[learner\_accounts	29](#learner_accounts)

[platform\_settings, outbox\_events	29](#platform_settings,-outbox_events)

[3.4 Ví dụ dữ liệu	29](#3.4-ví-dụ-dữ-liệu)

[3.5 Trao đổi với service khác	30](#3.5-trao-đổi-với-service-khác)

[3.6 Không có ở đây	30](#3.6-không-có-ở-đây)

[Phần 4\. assessment\_db: Quiz, Assignment, chấm chéo	31](#phần-4.-assessment_db:-quiz,-assignment,-chấm-chéo)

[4.1 Service này lo việc gì	31](#4.1-service-này-lo-việc-gì)

[4.2 Toàn cảnh	31](#4.2-toàn-cảnh)

[4.3 Từng bảng	32](#4.3-từng-bảng)

[assessments	32](#assessments)

[quiz\_questions, quiz\_question\_options	33](#quiz_questions,-quiz_question_options)

[rubric\_criteria	34](#rubric_criteria)

[learner\_assessment\_states	34](#learner_assessment_states)

[quiz\_attempts, quiz\_attempt\_answers	35](#quiz_attempts,-quiz_attempt_answers)

[submissions	35](#submissions)

[peer\_review\_cycles	36](#peer_review_cycles)

[submission\_reviews, submission\_review\_scores	36](#submission_reviews,-submission_review_scores)

[completed\_enrollments, learner\_accounts	37](#completed_enrollments,-learner_accounts)

[platform\_settings, outbox\_events	37](#platform_settings,-outbox_events-1)

[4.4 Ví dụ dữ liệu	37](#4.4-ví-dụ-dữ-liệu)

[4.5 Trao đổi với service khác	38](#4.5-trao-đổi-với-service-khác)

[4.6 Không có ở đây	38](#4.6-không-có-ở-đây)

[Phần 5\. achievement\_reporting\_db: Certificate, phiếu đánh giá, báo cáo	39](#phần-5.-achievement_reporting_db:-certificate,-phiếu-đánh-giá,-báo-cáo)

[5.1 Service này lo việc gì	39](#5.1-service-này-lo-việc-gì)

[5.2 Toàn cảnh	39](#5.2-toàn-cảnh)

[5.3 Từng bảng	39](#5.3-từng-bảng)

[certificates	39](#certificates)

[evaluation\_forms (GĐ2)	41](#evaluation_forms-\(gđ2\))

[evaluation\_responses (GĐ2)	41](#evaluation_responses-\(gđ2\))

[report\_exports (GĐ2)	42](#report_exports-\(gđ2\))

[5.4 Báo cáo lấy dữ liệu ở đâu	43](#5.4-báo-cáo-lấy-dữ-liệu-ở-đâu)

[5.5 Ví dụ dữ liệu	43](#5.5-ví-dụ-dữ-liệu)

[5.6 Trao đổi với service khác	44](#5.6-trao-đổi-với-service-khác)

[5.7 Không có ở đây	44](#5.7-không-có-ở-đây)

# **Phần 0\. Đọc trước** {#phần-0.-đọc-trước}

## **0.1 Tài liệu này dùng thế nào** {#0.1-tài-liệu-này-dùng-thế-nào}

Tài liệu giải thích 5 database của LearnUP, mỗi phần một database: có những bảng nào, mỗi bảng để làm gì, mỗi cột lưu gì, vì sao chọn kiểu và giới hạn đó, và dữ liệu thật trông ra sao. Phần 0 giải thích một lần những khái niệm dùng chung; các phần sau không nhắc lại.

Mọi phần dùng chung một câu chuyện mẫu (mục 0.7). Đọc lần lượt 5 phần là thấy một Learner đi từ lúc được tạo tài khoản tới lúc nhận Certificate, và dữ liệu nằm ở database nào.

## **0.2 Mỗi service một database** {#0.2-mỗi-service-một-database}

LearnUP có 5 service nghiệp vụ, mỗi service một database PostgreSQL riêng, đặt tên theo service: tenant-service dùng tenant\_db, course-service dùng course\_db, và tương tự với learning, assessment, achievement-reporting. Service này không được đọc database của service khác. Từ đó có ba hệ quả mà người đọc hay thắc mắc.

**Không có khóa ngoại sang database khác.** Cột learner\_id trong learning\_db lưu đúng giá trị id của bảng users bên tenant\_db, nhưng database learning không kiểm được người đó có tồn tại không, vì bảng users không nằm trong nó. Cột như vậy gọi là **ID logic**. Việc kiểm do code làm, bằng cách hỏi tenant-service.

**Hỏi service khác bằng REST.** REST là gọi API và chờ câu trả lời. Dùng khi cần câu trả lời ngay để làm bước tiếp theo, ví dụ khi phân công, learning hỏi tenant "người này có phải Learner của tổ chức không".

**Nghe service khác bằng event.** Event là một thông báo "việc X vừa xảy ra" mà service phát gửi lên Kafka, service nhận đọc về và tự xử lý. Kafka là hàng đợi thông điệp nằm giữa các service. Dùng khi không ai phải đứng chờ, ví dụ Enrollment hoàn thành thì learning phát EnrollmentCompleted, achievement-reporting nhận và tạo Certificate.

## **0.3 Kiểu dữ liệu** {#0.3-kiểu-dữ-liệu}

| Kiểu | Là gì | Dùng ở đâu, vì sao |
| ----- | ----- | ----- |
| uuid | Mã định danh 128 bit, viết thành chuỗi 36 ký tự gồm chữ số và chữ a–f. Sinh ra không cần hỏi ai mà gần như không thể trùng | Khóa chính mọi bảng. ID đi qua nhiều service và lộ trên đường dẫn web, nên không dùng số tăng dần (người ngoài đoán được ID kế tiếp) |
| uuid v7 và v4 | v7 có phần đầu là thời điểm sinh, nên ID sinh sau luôn lớn hơn ID sinh trước. v4 hoàn toàn ngẫu nhiên | LearnUP dùng v7: sắp theo ID là sắp theo thời gian, chỉ mục ghi nối đuôi nên nhanh. Riêng nội dung phiếu đánh giá dùng v4 để không lộ thời điểm gửi |
| varchar(n) | Chuỗi tối đa n **ký tự**. Chữ có dấu như "Ệ" vẫn tính 1 ký tự | Khi có căn cứ cho con số: chuẩn quốc tế, quy tắc nghiệp vụ, giới hạn ô nhập đã thống nhất, hoặc giới hạn kỹ thuật |
| text | Chuỗi không giới hạn độ dài | Khi không có căn cứ để đặt con số. Đặt bừa một giới hạn chỉ có hại: chặn nhầm dữ liệu hợp lệ |
| smallint, integer, bigint | Số nguyên 2, 4, 8 byte. integer tới khoảng 2,1 tỷ | bigint cho tiền (đồng) và dung lượng tệp (byte), vì một tệp video 2 GB đã là 2.147.483.648 byte, vượt integer |
| numeric(5,2) | Số thập phân **chính xác**, tối đa 5 chữ số, 2 chữ số sau dấu phẩy: 0,00 đến 999,99 | Điểm thang 0–100 làm tròn 2 chữ số. Không dùng số thực (real) vì số thực có sai số làm tròn, 0,1 \+ 0,2 không bằng đúng 0,3 |
| boolean | Đúng hoặc sai | Cờ bắt buộc, cờ hoàn thành sau hạn |
| timestamptz | Một thời điểm tuyệt đối, lưu theo giờ UTC, hiển thị đổi theo múi giờ người xem | Mọi cột thời gian. 00:00 ngày 20/10 giờ Việt Nam được lưu là 17:00 ngày 19/10 UTC; đổi về giờ tổ chức chỉ khi hiển thị hoặc tính mốc (BR-44) |
| jsonb | Một cột chứa cả một khối JSON | Khi dữ liệu có cấu trúc do nơi khác quyết định và bảng này chỉ cất nguyên văn: bản chốt điểm, bộ lọc báo cáo, nội dung event |
| Mảng: text\[\], uuid\[\]… | Một cột chứa danh sách nhiều giá trị cùng kiểu | Danh sách nhỏ, luôn đọc ghi cả cụm, không cần tra từng phần tử: Learning Outcome của Course, danh sách định dạng tệp cho phép |
| int4multirange | Tập nhiều khoảng số nguyên, ví dụ {\[0,45), \[80,95)}. PostgreSQL tự gộp khoảng chồng nhau | Các đoạn giây video Learner đã xem. Xem lại một đoạn không bị tính hai lần |
| bytea | Dữ liệu nhị phân | Mã băm SHA-256 (đúng 32 byte) của liên kết mời |

\[0,45) đọc là "từ giây 0 đến trước giây 45": ngoặc vuông là có tính đầu mút, ngoặc tròn là không tính.

## **0.4 Ràng buộc: database tự chặn dữ liệu sai** {#0.4-ràng-buộc:-database-tự-chặn-dữ-liệu-sai}

Code có thể có lỗi, người vận hành có thể gõ nhầm lệnh. Ràng buộc là luật đặt ngay trong database, mọi lệnh ghi vi phạm đều bị từ chối, bất kể đến từ đâu.

| Ràng buộc | Nghĩa | Ví dụ trong LearnUP |
| ----- | ----- | ----- |
| Bắt buộc (NOT NULL) | Cột phải có giá trị | Mọi Course phải có tên |
| Khóa chính (PRIMARY KEY) | Cột định danh mỗi dòng, không trùng, không trống | id |
| Duy nhất (UNIQUE) | Không hai dòng nào trùng giá trị, hoặc trùng tổ hợp nhiều cột | Mỗi Enrollment có tối đa một Certificate |
| Duy nhất có điều kiện | Chỉ cấm trùng trong những dòng thỏa một điều kiện | Email không trùng trong các tài khoản **chưa bị xóa**; tài khoản đã xóa thì email đó dùng lại được |
| Khóa ngoại (FOREIGN KEY) | Giá trị phải tồn tại ở bảng cha, trong cùng database. Có thể đặt "xóa dây chuyền": xóa dòng cha thì xóa luôn dòng con | Lesson phải thuộc một Module có thật; xóa Module thì Lesson bên trong mất theo |
| Khóa ngoại kép | Khóa ngoại trên cả cặp (ID cha, organization\_id) | Bảo đảm dòng con cùng tổ chức với dòng cha: không thể gắn Lesson của công ty A vào Module của công ty B |
| CHECK | Điều kiện mỗi dòng phải thỏa | Điểm tiêu chí từ 1 đến 5; "Certificate đã cấp thì phải có tên Learner" |
| Trigger | Đoạn lệnh database tự chạy mỗi khi có thao tác ghi | LearnUP chỉ dùng để chặn sửa, xóa các bản ghi bất biến như Certificate đã cấp |

**Transaction** là một nhóm lệnh ghi được thực hiện trọn gói: hoặc tất cả thành công, hoặc không lệnh nào có hiệu lực. Ví dụ ghi Enrollment Completed và ghi event thông báo phải nằm trong một transaction, để không bao giờ có chuyện đã Completed mà event bị mất.

**Chỉ mục (index)** giống mục lục cuối sách, giúp database tìm dòng nhanh mà không đọc cả bảng. Chỉ mục không đổi ý nghĩa dữ liệu nên tài liệu này không liệt kê.

## **0.5 Các cột gặp ở mọi bảng** {#0.5-các-cột-gặp-ở-mọi-bảng}

| Cột | Ý nghĩa |
| ----- | ----- |
| id | Khóa chính, uuid v7 do database tự sinh |
| organization\_id | Tổ chức sở hữu dòng dữ liệu. Mọi truy vấn đều lọc theo cột này để công ty A không bao giờ thấy dữ liệu công ty B. Bảng cấp nền tảng (gói dịch vụ, tham số) không có cột này |
| created\_at, updated\_at | Lúc tạo dòng và lúc sửa gần nhất. Có ở hầu hết bảng nên các phần sau không liệt kê lại |
| status | Trạng thái, lưu dạng chữ viết hoa chữ cái đầu mỗi từ: Active, PendingPayment. Dùng chữ thay vì kiểu liệt kê cố định để thêm trạng thái mới không phải đổi cấu trúc bảng |
| …\_at | Mốc thời điểm một việc xảy ra: deleted\_at, locked\_at. Trống nghĩa là việc đó chưa xảy ra |
| …\_as\_of | Thời điểm của event gần nhất đã áp dụng vào dòng này (mục 0.6) |

Để bảng cột ở các phần 1 đến 5 ngắn gọn, bốn cột id, organization\_id, created\_at, updated\_at và các cột nối sang bảng cha không được liệt kê trong bảng. Dòng "Ngoài các cột nêu trên, bảng còn có" ngay dưới mỗi bảng ghi đủ những cột này, nên khi so với sơ đồ ERD, mỗi bảng có đúng các cột trong bảng cột cộng với các cột ở dòng đó.

## **0.6 Năm ý hay gặp** {#0.6-năm-ý-hay-gặp}

**Ảnh chụp.** Chép một giá trị vào bản ghi tại thời điểm xảy ra việc rồi giữ nguyên mãi. Giống hóa đơn in giá lúc mua: cửa hàng tăng giá sau đó thì hóa đơn cũ không đổi. Certificate chụp tên Learner lúc cấp; kỳ Subscription chụp giá gói lúc thanh toán; mọi tham số nền tảng được chép vào bản ghi lúc tạo nên Admin đổi tham số không làm đổi kết quả cũ (BR-269).

**Bản sao.** Giữ một phần dữ liệu của service khác và cập nhật theo event, để đọc nhanh và không phụ thuộc service kia đang chạy. Khác ảnh chụp: bản sao luôn đi theo bản gốc. Bảng bản sao dùng luôn ID gốc làm khóa chính, để một đối tượng chỉ có một ID trên toàn hệ thống. **Bản sao thưa** chỉ có dòng cho đối tượng khác bình thường, ví dụ chỉ tài khoản bị vô hiệu hóa mới có dòng; không có dòng nghĩa là bình thường.

**Trạng thái lưu và trạng thái tính lúc đọc.** Quá hạn (Overdue) không được lưu: mỗi lần đọc, hệ thống so hạn với giờ hiện tại. Nếu lưu, phải có một việc chạy theo lịch canh đúng giờ để đổi trạng thái, chậm một phút là số liệu sai. Chỉ lưu trạng thái khi việc đổi trạng thái kéo theo việc khác như chép tham số hay gửi thông báo.

**Chịu event trùng.** Kafka bảo đảm giao mỗi event **ít nhất** một lần, nghĩa là đôi khi giao hai lần. Bên nhận phải thiết kế để nhận lại không sai, bằng một trong ba cách: ràng buộc duy nhất và "đã có thì bỏ qua"; cột …\_as\_of để bỏ qua event cũ hơn cái đã áp dụng; hoặc luật "không quay lui" (đã gán mốc kết thúc thì không mở lại).

**Hai bảng có ở nhiều service.**

outbox\_events là **hộp thư đi**. Muốn gửi event, service ghi một dòng vào bảng này trong cùng transaction với dữ liệu nghiệp vụ. Một tiến trình khoảng mỗi giây đọc các dòng chưa gửi, đẩy lên Kafka, đánh dấu đã gửi; dòng đã gửi bị xóa sau 7 ngày. Nhờ vậy không có chuyện dữ liệu đã lưu mà event bị mất vì service sập giữa chừng. Các cột: aggregate\_type, aggregate\_id (đối tượng phát event, cũng là khóa phân luồng trên Kafka để event cùng đối tượng đến đúng thứ tự), event\_type (tên event), payload (nội dung, jsonb), occurred\_at (lúc việc xảy ra), published\_at (lúc đã gửi, trống là chưa gửi).

platform\_settings là bản sao **tham số nền tảng**, chỉ một dòng duy nhất. Admin sửa tham số ở tenant-service; service khác nhận event PlatformSettingsChanged và cập nhật bản của mình. Cột source\_as\_of giữ thời điểm của lần cập nhật gần nhất. Mỗi service chỉ giữ những tham số mình dùng.

## **0.7 Câu chuyện mẫu** {#0.7-câu-chuyện-mẫu}

ID thật là uuid; tài liệu viết gọn thành ORG-ABC, U-AN… cho dễ đọc. Số liệu chỉ để minh họa.

| Nhân vật, đối tượng | ID viết gọn | Ghi chú |
| ----- | ----- | ----- |
| Công ty ABC | ORG-ABC | Múi giờ Asia/Ho\_Chi\_Minh, mua gói "Tiêu chuẩn" |
| Chị Lan | U-LAN | Organizer |
| Anh Minh | U-MINH | Instructor, phụ trách Course "An toàn lao động" |
| An, Bình, Cường | U-AN, U-BINH, U-CUONG | Learner, phòng Kỹ thuật |
| Chuỗi "An toàn lao động" | CH-ATLD | Gồm 2 phiên bản |
| Phiên bản 1, phiên bản 2 | C-ATLD-1, C-ATLD-2 | Bản 1 đã bị thay; bản 2 đang dùng |

Phiên bản 2 gồm Module "Nhận diện nguy cơ" có Lesson 1.1 với một video 10 phút (bắt buộc) và một tài liệu PDF (không bắt buộc); một Quiz bắt buộc, điểm đạt 70; một Assignment "Báo cáo đánh giá rủi ro", điểm đạt 60, có chấm chéo, mỗi bài 2 người chấm. Số ngày hoàn thành dự kiến: 14\.

| Ngày (2026) | Việc xảy ra | Database liên quan |
| ----- | ----- | ----- |
| 01/10 | ABC đăng ký, thanh toán; Lan tạo tài khoản Minh, An, Bình, Cường | tenant |
| 02/10–03/10 | Minh tạo phiên bản 2 từ phiên bản 1, gửi duyệt; Lan duyệt, phiên bản 1 chuyển Archived | course |
| 05/10 | Lan phân công An, Bình, Cường học phiên bản 2, hạn hết ngày 19/10; Course bị Locked | learning, course |
| 06/10 | An xem video, làm Quiz lần 1 được 60, lần 2 được 85 | learning, assessment |
| 07/10–08/10 | An, rồi Bình, Cường nộp bài Assignment | assessment |
| 15/10 | Chốt chu kỳ chấm chéo; ba người chấm chéo xong; Minh chốt điểm bài của An là 80; An hoàn thành Course và được cấp Certificate | assessment, learning, achievement-reporting |
| 16/10 | An gửi phiếu đánh giá hiệu quả đào tạo | achievement-reporting |
| 31/10 | Lan xem báo cáo và kết xuất Excel | achievement-reporting |

# **Phần 1\. tenant\_db: tổ chức, tài khoản, gói dịch vụ** {#phần-1.-tenant_db:-tổ-chức,-tài-khoản,-gói-dịch-vụ}

## **1.1 Service này lo việc gì** {#1.1-service-này-lo-việc-gì}

tenant-service (tên trong tài liệu kiến trúc: Organization & Commercial) giữ thông tin khách hàng doanh nghiệp, tài khoản người dùng, gói dịch vụ và việc thu tiền. Đây là nơi **sinh ra user\_id** mà mọi service khác dùng để chỉ một người.

Không giữ: mật khẩu và đăng nhập (identity-service), Course, Enrollment, điểm, Certificate.

## **1.2 Toàn cảnh** {#1.2-toàn-cảnh}

| Bảng | Trả lời câu hỏi |
| ----- | ----- |
| organizations | Khách hàng này là ai, dùng múi giờ nào, đang hoạt động hay bị khóa? |
| users | Người này là ai, thuộc tổ chức nào, vai trò gì, tài khoản còn dùng được không? |
| account\_tokens | Liên kết mời hoặc liên kết xác thực email này còn hợp lệ không? |
| subscription\_plans | Nền tảng đang bán những gói nào, giá và giới hạn bao nhiêu? |
| registrations | Ai đã đăng ký mà chưa trả tiền? |
| subscriptions | Tổ chức đang dùng kỳ nào, hết hạn lúc nào, đang ân hạn hay bị ngưng? |
| payments | Đã thu những khoản nào, thành công hay thất bại? |
| organization\_suspensions | Tổ chức bị Admin tạm khóa những lần nào? |
| platform\_settings | 20 tham số nền tảng đang áp dụng (bản gốc) |
| outbox\_events | Hộp thư đi (mục 0.6) |

| Bảng con | Tham chiếu tới | Nghĩa |
| ----- | ----- | ----- |
| users | organizations | Mỗi tài khoản thuộc đúng một tổ chức (trừ Admin) |
| account\_tokens | users | Liên kết gửi cho một người cụ thể |
| registrations | organizations, users, subscription\_plans | Lượt đăng ký của một tổ chức, do một Organizer khai, chọn một gói |
| subscriptions | organizations, subscription\_plans | Kỳ sử dụng của tổ chức theo một gói |
| payments | organizations, subscription\_plans, registrations, subscriptions | Giao dịch mua gói; thành công thì sinh ra một kỳ |
| organization\_suspensions | organizations | Các lần tổ chức bị khóa |

## **1.3 Từng bảng** {#1.3-từng-bảng}

### **organizations** {#organizations}

Mỗi dòng là một khách hàng doanh nghiệp.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| name | varchar(200) | Tên tổ chức | 200: giới hạn ô nhập đã thống nhất cho tên tổ chức |
| tax\_code | varchar(13) | Mã số thuế, chỉ chữ số | 10 hoặc 13 chữ số theo Thông tư 86/2024/TT-BTC |
| address | varchar(300) | Địa chỉ | 300: giới hạn ô nhập đã thống nhất |
| contact\_phone | varchar(16) | Số điện thoại, lưu dạng quốc tế \+849… | Chuẩn quốc tế E.164: tối đa 15 chữ số cộng dấu \+ |
| contact\_email | varchar(254) | Email liên hệ, không bắt buộc | 254: độ dài tối đa của email theo chuẩn RFC 5321 |
| logo\_file\_key | text | Khóa tệp logo trong kho lưu trữ | Do kho lưu trữ sinh, không có căn cứ đặt giới hạn |
| timezone | text | Múi giờ, mặc định Asia/Ho\_Chi\_Minh | Tên múi giờ chuẩn IANA |
| status | text | PendingPayment, Active, Suspended, Cancelled | — |

Ngoài các cột nêu trên, bảng còn có: id (chính là organization\_id mà mọi bảng khác dùng), created\_at, updated\_at.

Luật dữ liệu:

* Tên và mã số thuế **không bắt buộc duy nhất**. Hệ thống không xác minh được mã số thuế có thuộc người đăng ký không; nếu bắt duy nhất, kẻ xấu đăng ký trước bằng mã số thuế của công ty khác là chặn được công ty thật. Trùng thì chỉ cảnh báo Admin (BR-280).  
* Đổi múi giờ chỉ áp dụng cho các mốc tạo sau đó; mốc đã tính giữ nguyên (BR-44).  
* Trạng thái: PendingPayment → Active khi thanh toán; PendingPayment → Cancelled khi quá hạn chờ thanh toán; Active ↔ Suspended khi Admin khóa hoặc gỡ khóa.

### **users** {#users}

Tài khoản của cả bốn vai trò. Cột id chính là user\_id dùng khắp hệ thống và là mã người dùng trong token đăng nhập.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| organization\_id | uuid | Tổ chức; trống với Admin | — |
| email | varchar(254) | Email đăng nhập, luôn chữ thường | RFC 5321 |
| full\_name | varchar(100) | Họ tên | 100: giới hạn ô nhập họ tên |
| avatar\_file\_key | text | Ảnh đại diện | — |
| role | text | Admin, Organizer, Instructor, Learner | — |
| department | varchar(100) | Đơn vị công tác, gõ tự do | 100: giới hạn ô nhập; gõ tự do theo BR-279, lọc báo cáo không phân biệt hoa thường |
| status | text | Pending (chưa kích hoạt), Active, Deactivated | — |
| activated\_at | timestamptz | Lần kích hoạt đầu tiên | Để biết khi mở lại tài khoản bị vô hiệu hóa thì về Active hay Pending |
| deleted\_at | timestamptz | Lúc bị xóa | — |

Ngoài các cột nêu trên, bảng còn có: id (chính là user\_id), created\_at, updated\_at.

Luật dữ liệu:

* Email không trùng trong các tài khoản **chưa bị xóa** (BR-30, BR-31).  
* Mỗi tổ chức chỉ có một Organizer còn hiệu lực, tính cả người đang chờ nhận lời mời (BR-40).  
* Xóa tài khoản là gán deleted\_at, không xóa dòng: Certificate và kết quả học ở các service khác vẫn trỏ tới user\_id này (BR-37).

### **account\_tokens** {#account_tokens}

Liên kết mời (Instructor, Learner, Organizer thay thế) và liên kết xác thực email của Organizer. Email chứa một mã bí mật ngẫu nhiên; database **chỉ lưu mã băm** của nó, nên dù database bị lộ, không ai dùng được liên kết.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| user\_id | uuid | Người nhận liên kết | — |
| purpose | text | Invitation hoặc EmailVerification | — |
| token\_hash | bytea | Mã băm SHA-256 của mã bí mật | Đúng 32 byte: SHA-256 luôn cho ra 32 byte |
| expires\_at | timestamptz | Hết hạn | Lúc tạo \+ 7 ngày; số ngày chép từ tham số lúc tạo (BR-278) |
| consumed\_at | timestamptz | Đã được dùng | — |
| revoked\_at | timestamptz | Bị thu hồi (phát liên kết mới, sửa email, hủy lời mời) | Không thể vừa dùng vừa thu hồi |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

Luật dữ liệu: mỗi người, mỗi mục đích chỉ có một liên kết còn hiệu lực. Phát liên kết mới thì phải thu hồi liên kết cũ trong cùng transaction; quên thu hồi thì database báo lỗi.

### **subscription\_plans** {#subscription_plans}

Gói dịch vụ nền tảng đang bán; bảng cấp nền tảng, không có organization\_id.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| name | varchar(100) | Tên gói | 100: giới hạn ô nhập |
| price | bigint | Giá, đơn vị đồng | Lớn hơn 0: không có gói miễn phí |
| duration\_days | integer | Thời hạn | Tính bằng ngày, không bằng tháng vì tháng dài ngắn khác nhau |
| max\_learners, max\_instructors | integer | Số chỗ | Lớn hơn 0 |
| max\_course\_chains | integer | Số Course tối đa | Đếm theo **chuỗi phiên bản**, không đếm từng phiên bản (BR-1) |
| max\_storage\_bytes | bigint | Dung lượng lưu trữ | Byte, khớp đơn vị kho lưu trữ |
| is\_offered | boolean | Còn bán không | Ngừng bán thì đặt false, không bao giờ xóa, vì đăng ký và kỳ cũ còn trỏ tới (BR-3) |

Ngoài các cột nêu trên, bảng còn có: id, created\_at, updated\_at. Không có organization\_id vì là bảng cấp nền tảng.

### **registrations** {#registrations}

Một lượt đăng ký của khách mới trong lúc chờ thanh toán. Tách khỏi subscriptions vì lúc này tổ chức chưa có kỳ sử dụng nào, nhưng cần giữ liên kết thanh toán lại và đếm số lần gửi lại để chống lạm dụng.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| organizer\_user\_id | uuid | Organizer đã khai lúc đăng ký | Một đăng ký một tài khoản |
| plan\_id | uuid | Gói đã chọn | — |
| price, duration\_days, 4 cột giới hạn | như gói | **Ảnh chụp** gói lúc đăng ký | Admin đổi giá sau đó, khách vẫn trả giá lúc đăng ký (BR-275) |
| status | text | PendingPayment, Paid, Expired | — |
| expires\_at | timestamptz | Hết hạn chờ thanh toán | Lúc tạo \+ 7 ngày, chép từ tham số (BR-7) |
| paid\_at | timestamptz | Lúc thanh toán | Có khi và chỉ khi Paid |
| reopen\_token\_hash | bytea | Mã băm liên kết thanh toán lại | 32 byte. Gửi lại thì ghi đè, liên kết cũ tự hết hiệu lực |
| resend\_count, resend\_window\_started\_at | integer, timestamptz | Số lần gửi lại liên kết trong 24 giờ | Tối đa 5 lần mỗi 24 giờ (BR-32), chống gửi thư hàng loạt |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at. Bốn cột giới hạn tên là max\_learners, max\_instructors, max\_course\_chains, max\_storage\_bytes.

### **subscriptions** {#subscriptions}

Mỗi dòng là **một kỳ sử dụng** đã trả tiền. Gia hạn hay nâng cấp tạo dòng mới, không sửa dòng cũ, nên lịch sử giá và giới hạn của từng kỳ còn nguyên.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| plan\_id | uuid | Gói | — |
| source | text | Registration, Renewal, Upgrade | — |
| status | text | Scheduled (trả trước, chờ tới lượt), Active, Grace (ân hạn), Suspended, Ended | — |
| giá, thời hạn, 4 giới hạn | như gói | **Ảnh chụp** lúc thanh toán | BR-2, BR-274 |
| starts\_at, expires\_at | timestamptz | Bắt đầu, hết hạn | Chính xác tới giây, không làm tròn cuối ngày |
| grace\_ends\_at | timestamptz | Hết ân hạn | Hết hạn \+ 7 ngày, chép lúc vào Grace (BR-15) |
| suspended\_at, read\_only\_ends\_at | timestamptz | Lúc bị ngưng; hết quyền chỉ xem của Organizer | Ngưng \+ 30 ngày (BR-17) |
| ended\_at | timestamptz | Lúc bị kỳ khác thay | — |
| last\_reminder\_days | integer | Mốc nhắc gia hạn gần nhất đã gửi Organizer | Chống gửi trùng (mốc 7 ngày và 1 ngày, BR-18) |
| certificate\_reminder\_sent\_at | timestamptz | Đã nhắc Learner tải Certificate | Chỉ có giá trị khi kỳ đã từng vào Grace (BR-18) |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at. Sáu cột ảnh chụp tên là price, duration\_days, max\_learners, max\_instructors, max\_course\_chains, max\_storage\_bytes.

Luật dữ liệu:

* Mỗi tổ chức chỉ có một kỳ hiện hành (Active, Grace hoặc Suspended) và tối đa một kỳ trả trước (Scheduled, BR-281).  
* Vào trạng thái nào thì phải có mốc của trạng thái đó.  
* Trạng thái được lưu, không tính từ ngày tháng, vì mỗi lần chuyển phải chép tham số và gửi thông báo trong cùng transaction.  
* Việc nhắc Learner tải Certificate tách riêng khỏi việc chuyển sang Grace và được thử lại tới khi thành công, để việc chuyển trạng thái không phụ thuộc achievement-reporting-service.

| Việc xảy ra | Kỳ hiện tại | Kỳ mới |
| ----- | ----- | ----- |
| Thanh toán đăng ký | — | Active, bắt đầu lúc thanh toán |
| Gia hạn khi đang Active | Giữ nguyên | Scheduled, bắt đầu từ ngày hết hạn hiện tại |
| Gia hạn khi đang Grace | Ended | Active, bắt đầu từ ngày hết hạn cũ |
| Gia hạn khi đang Suspended | Ended | Active, bắt đầu lúc thanh toán |
| Nâng cấp (chỉ khi Active) | Ended | Active ngay, giữ ngày hết hạn cũ |
| Tới ngày hết hạn, không có kỳ trả trước | Grace | — |
| Hết ân hạn | Suspended | — |

### **payments** {#payments}

Từng lần thanh toán. Tách bảng vì một kỳ có thể phải thử thanh toán nhiều lần, và để sau này lắp cổng thanh toán thật mà không đổi cấu trúc.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| kind | text | Registration, Renewal, Upgrade | — |
| registration\_id | uuid | Lượt đăng ký, chỉ khi kind \= Registration | — |
| amount | bigint | Số tiền, đồng | Lớn hơn 0; nâng cấp tính theo BR-277 |
| status | text | Pending, Succeeded, Failed | — |
| subscription\_id | uuid | Kỳ sinh ra từ giao dịch | Mỗi kỳ sinh từ đúng một giao dịch |
| provider\_reference, failure\_reason | text | Mã giao dịch, lỗi từ dịch vụ thanh toán | Do bên ngoài trả về, không có căn cứ giới hạn |
| paid\_at | timestamptz | Lúc thành công | Succeeded khi và chỉ khi có paid\_at và subscription\_id |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, plan\_id (gói đang mua), created\_at, updated\_at.

### **organization\_suspensions** {#organization_suspensions}

Các lần Admin tạm khóa tổ chức. learning-service cần biết khoảng khóa để dời hạn hoàn thành cho Learner (BR-46, BR-47).

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| started\_at, ended\_at | timestamptz | Khoảng khóa; ended\_at trống là đang khóa | Mỗi tổ chức chỉ một lần khóa đang mở |
| reason | varchar(1000) | Lý do, bắt buộc | 1000: giới hạn chung cho mọi ô lý do (BR-271) |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

### **platform\_settings** {#platform_settings}

Bản gốc của 20 tham số nền tảng, một dòng duy nhất.

| Nhóm | Tham số (mặc định) |
| ----- | ----- |
| Đăng ký, Subscription | Hạn chờ thanh toán (168 giờ), ân hạn (7 ngày), Organizer chỉ xem sau khi ngưng (30 ngày), ngưỡng cảnh báo mức dùng (80%), mốc nhắc gia hạn (7 và 1 ngày), số lần gửi lại liên kết (5), hạn liên kết mời (7 ngày) |
| Course | Tốc độ đọc (200 từ/phút), giờ học mỗi ngày (60 phút), ngưỡng chênh thời lượng (20%), giới hạn tệp video (2 GB, 120 phút, MP4) và PDF (50 MB), hạn xử lý report (7 ngày), ngưỡng vi phạm (3) |
| Learning | Tỉ lệ xem video tối thiểu (90%) |
| Assessment | Độ dài chu kỳ chấm chéo (7 ngày), hạn chấm (3 ngày), nhắc trước hạn (24 giờ), số lượt liên tiếp (3), thời gian khóa (24 giờ) |
| Achievement | Hạn thực hiện phiếu đánh giá (14 ngày) |

\*Các cột của bảng: id, created\_at, updated\_at (không có organization\_id) và 24 cột tham số:

\- pending\_registration\_ttl\_hours (Hạn chờ thanh toán của lượt đăng ký, mặc định 168 giờ)

\- subscription\_grace\_days (Thời gian ân hạn sau khi Subscription hết hạn, mặc định 7 ngày)

\- organizer\_read\_only\_days (Số ngày Organizer còn chỉ xem và kết xuất báo cáo sau khi Subscription bị ngưng, mặc định 30 ngày)

\- usage\_warning\_threshold\_percent (Ngưỡng cảnh báo mức dùng so với giới hạn gói, mặc định 80%)

\- reading\_speed\_words\_per\_minute (Tốc độ đọc chuẩn để ước tính thời lượng tài liệu, mặc định 200 từ/phút)

\- study\_minutes\_per\_day (Số phút học quy ước mỗi ngày, mặc định 60 phút)

\- duration\_gap\_threshold\_percent (Ngưỡng chênh lệch thời lượng để cảnh báo Instructor, mặc định 20%)

\- video\_completion\_percent (Tỉ lệ xem video tối thiểu để tính hoàn thành, mặc định 90%)

\- report\_handling\_days (Thời hạn xử lý report vi phạm, mặc định 7 ngày)

\- instructor\_violation\_threshold (Ngưỡng số vi phạm của Instructor để cảnh báo, mặc định 3\)

\- evaluation\_form\_days (Thời hạn thực hiện phiếu đánh giá hiệu quả đào tạo, mặc định 14 ngày)

\- default\_peer\_review\_cycle\_days (Độ dài chu kỳ chấm chéo mặc định, 7 ngày)

\- default\_peer\_review\_deadline\_days (Thời hạn hoàn thành chấm chéo mặc định, 3 ngày)

\- peer\_review\_reminder\_hours (Nhắc người chấm trước hạn, mặc định 24 giờ)

\- default\_max\_consecutive\_attempts (Số lượt làm liên tiếp tối đa mặc định (n), 3 lượt)

\- default\_lockout\_hours (Thời gian tạm khóa sau khi hết n lượt mặc định (m), 24 giờ)

\- max\_video\_size\_bytes (Dung lượng tối đa một tệp video, mặc định 2 GB)

\- max\_video\_duration\_minutes (Thời lượng tối đa một video, mặc định 120 phút)

\- max\_reading\_size\_bytes (Dung lượng tối đa một tệp PDF, mặc định 50 MB)

\- allowed\_video\_mime\_types (Định dạng video cho phép, mặc định MP4)

\- allowed\_reading\_mime\_types (Định dạng tài liệu đọc cho phép, mặc định PDF)

\- max\_link\_resends\_per\_24h (Số lần gửi lại liên kết tối đa trong 24 giờ, mặc định 5\)

\- invitation\_link\_ttl\_days (Hạn hiệu lực của liên kết mời và liên kết xác thực, mặc định 7 ngày)

\- subscription\_reminder\_days (Các mốc nhắc Organizer trước khi Subscription hết hạn, mặc định 7 và 1 ngày)

### **outbox\_events** {#outbox_events}

| Event | Gửi cho |
| ----- | ----- |
| OrganizationSuspended, OrganizationReinstated | learning |
| UserDeactivated, UserReactivated | learning, assessment, identity |
| UserDeleted | identity, learning, assessment |
| SubscriptionStatusChanged | notification, learning, identity |
| PlatformSettingsChanged | course, learning, assessment, achievement-reporting |
| Yêu cầu gửi email; bản ghi nhật ký | notification; audit |

Các cột của bảng (như mục 0.6): id, aggregate\_type, aggregate\_id, event\_type, organization\_id, payload, occurred\_at, published\_at, created\_at, updated\_at. Bảng outbox\_events ở các service khác có cùng các cột này.

## **1.4 Ví dụ dữ liệu** {#1.4-ví-dụ-dữ-liệu}

**01/10 09:00: ABC đăng ký gói Tiêu chuẩn** (giả sử giá 12.000.000 đồng, 365 ngày, 100 Learner, 10 Instructor, 20 Course, 50 GB).

| Bảng | Dòng mới |
| ----- | ----- |
| organizations | ORG-ABC, "Công ty ABC", status \= PendingPayment |
| users | U-LAN, Organizer, status \= Pending |
| registrations | gói Tiêu chuẩn, giá 12.000.000 **chụp lại**, status \= PendingPayment, expires\_at \= 08/10 09:00 |

**01/10 09:05: thanh toán thành công.** Trong một transaction: payments thêm dòng Succeeded; subscriptions thêm kỳ SUB-1 Active từ 01/10/2026 09:05 đến 01/10/2027 09:05; registrations chuyển Paid; organizations chuyển Active; account\_tokens thêm liên kết xác thực email cho Lan; outbox\_events thêm yêu cầu gửi email.

**01/10 10:00: Lan tạo tài khoản An.**

| Bảng | Dữ liệu |
| ----- | ----- |
| users | U-AN, role \= Learner, department \= "Kỹ thuật", status \= Pending |
| account\_tokens | purpose \= Invitation, expires\_at \= 08/10 10:00 |

An bấm liên kết và đặt mật khẩu (mật khẩu lưu ở identity-service): token có consumed\_at; An chuyển Active, có activated\_at.

**Một năm sau, ABC không gia hạn.** 01/10/2027 09:05 SUB-1 chuyển Grace, grace\_ends\_at \= 08/10/2027 09:05. Việc chạy theo lịch hỏi achievement-reporting danh sách Learner có Certificate, gửi email nhắc An tải Certificate, gán certificate\_reminder\_sent\_at.

## **1.5 Trao đổi với service khác** {#1.5-trao-đổi-với-service-khác}

tenant-service **không chép dữ liệu** của service nào.

| Cung cấp cho | Cái gì | Cách |
| ----- | ----- | ----- |
| Mọi service | user\_id; tham số nền tảng; trạng thái tổ chức, tài khoản, Subscription | Event |
| course | Giới hạn gói, hỏi lúc kiểm, không chép (nâng cấp có hiệu lực ngay) | REST |
| learning, assessment | Múi giờ tổ chức lúc tính mốc | REST |
| achievement-reporting | Họ tên theo lô (trả cả tài khoản đã xóa); user\_id theo đơn vị công tác; trạng thái truy cập; số Learner | REST |

tenant-service hỏi lại: course (số Course, dung lượng đã dùng; Instructor còn phụ trách Course nào), learning (danh sách Course của một Learner), achievement-reporting (Learner nào có Certificate).

## **1.6 Không có ở đây** {#1.6-không-có-ở-đây}

Mật khẩu, đăng nhập Google (identity-service). Bảng phòng ban: đơn vị công tác là chữ gõ tự do (BR-279). Bảng thành viên nhiều tổ chức: một tài khoản thuộc đúng một tổ chức (BR-30).

# **Phần 2\. course\_db: Course, phiên bản, học liệu** {#phần-2.-course_db:-course,-phiên-bản,-học-liệu}

## **2.1 Service này lo việc gì** {#2.1-service-này-lo-việc-gì}

course-service giữ nội dung đào tạo: Course, các phiên bản của Course, cấu trúc Module → Lesson → học liệu, tệp học liệu và ảnh bìa, quy trình duyệt, cơ chế khóa nội dung (Locked), người phụ trách và việc kiểm duyệt report vi phạm. Đây cũng là **nơi duy nhất đếm** số Course và dung lượng lưu trữ đã dùng.

Không giữ: Quiz, Assignment (assessment-service), Enrollment và tiến độ (learning-service).

**Khái niệm quan trọng nhất của phần này:** mỗi dòng trong bảng courses là **một phiên bản**, không phải một Course theo nghĩa thông thường. Course "An toàn lao động" có 2 phiên bản thì courses có 2 dòng, nối với nhau bằng một dòng trong course\_chains. Mọi service khác khi nói course\_id đều hiểu là ID của một phiên bản; Enrollment và Certificate gắn với phiên bản (BR-108).

## **2.2 Toàn cảnh** {#2.2-toàn-cảnh}

| Bảng | Trả lời câu hỏi |
| ----- | ----- |
| organization\_quota\_locks | Không có dữ liệu nghiệp vụ; là "chìa khóa" để đếm giới hạn gói không bị sai khi nhiều người thao tác cùng lúc |
| course\_chains | Chuỗi phiên bản này do ai phụ trách? Tổ chức đang dùng bao nhiêu Course? |
| courses | Phiên bản này tên gì, đang ở trạng thái nào, đã Locked chưa? |
| modules, lessons, materials | Cấu trúc chương trình của một phiên bản gồm những gì, theo thứ tự nào, học liệu nào bắt buộc? |
| media\_files | Tệp nằm ở đâu trong kho, nặng bao nhiêu, video dài bao lâu? |
| content\_reports | Ai báo nội dung nào vi phạm, đã xử lý ra sao? (GĐ2) |
| platform\_settings, outbox\_events | Mục 0.6 |

| Bảng con | Tham chiếu tới | Nghĩa |
| ----- | ----- | ----- |
| courses | course\_chains | Phiên bản thuộc một chuỗi |
| courses | media\_files | Ảnh bìa, không bắt buộc |
| modules → lessons → materials | bảng bên trái | Cây chương trình; xóa cha thì xóa dây chuyền con |
| materials | media\_files | Học liệu trỏ tới tệp; tệp còn được trỏ thì không xóa được |
| lessons, materials | content\_reports | Report đã khiến nội dung bị vô hiệu hóa (GĐ2) |
| content\_reports | courses | Report thuộc một phiên bản |

## **2.3 Từng bảng** {#2.3-từng-bảng}

### **organization\_quota\_locks** {#organization_quota_locks}

Chỉ có một cột organization\_id, mỗi tổ chức một dòng.

Vì sao cần: tổ chức mua gói 20 Course và đang dùng 19\. Hai Instructor cùng bấm tạo Course mới trong cùng một giây: cả hai đếm thấy 19 \< 20, cả hai được tạo, tổ chức có 21 Course. Để tránh, mọi thao tác cần đếm giới hạn (tạo Course mới, xin tải tệp) phải **khóa dòng của tổ chức trong bảng này trước khi đếm**; người đến sau phải chờ người trước xong. Không khóa trên bảng courses được vì tổ chức mới có thể chưa có Course nào để khóa.

Ngoài cột organization\_id (khóa chính), bảng còn có created\_at, updated\_at. Bảng không có cột id.

### **course\_chains** {#course_chains}

Một chuỗi phiên bản của một Course.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| instructor\_id | uuid | Instructor phụ trách | Phụ trách cả chuỗi, không từng phiên bản (BR-287) |

Ngoài các cột nêu trên, bảng còn có: id (chính là chain\_id mà các phiên bản trong courses trỏ tới), organization\_id, created\_at, updated\_at.

Luật dữ liệu: giới hạn "số Course" của gói đếm bằng số dòng của bảng này (BR-1). Xóa phiên bản cuối cùng thì xóa luôn dòng chuỗi và trả lại một chỗ; xóa một phiên bản nháp khi chuỗi còn phiên bản khác thì không trả chỗ (BR-74).

### **courses** {#courses}

Mỗi dòng là một phiên bản.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| chain\_id | uuid | Chuỗi | — |
| version\_number | integer | Số hiệu phiên bản 1, 2, 3… | Không trùng trong chuỗi; lấy số lớn nhất \+ 1 khi đang khóa dòng chuỗi |
| name | varchar(200) | Tên Course | 200: giới hạn ô nhập tên Course |
| short\_description | varchar(500) | Mô tả ngắn | 500; bắt buộc từ lúc gửi duyệt (BR-290) |
| training\_objectives | varchar(2000) | Mục tiêu đào tạo | 2000; bắt buộc từ lúc gửi duyệt |
| learning\_outcomes | mảng varchar(200) | Danh sách kết quả học tập | Mỗi mục 200 ký tự, tối đa 20 mục; ít nhất 1 mục từ lúc gửi duyệt |
| cover\_file\_id | uuid | Ảnh bìa | — |
| expected\_completion\_days | integer | Số ngày hoàn thành dự kiến | 1–365; learning dùng để tính hạn |
| course\_type | text | Public (hiện trong danh mục tự học) hoặc Private | Phiên bản mới kế thừa (BR-101) |
| status | text | Draft, Submitted, Published, Rejected, Archived, Disabled | — |
| locked\_at | timestamptz | Lúc bị Locked | Gán khi có Enrollment đầu tiên; **không bao giờ gỡ** (BR-83) |
| submitted\_at, published\_at, archived\_at | timestamptz | Mốc gửi duyệt, phê duyệt, bị thay | published\_at giữ nguyên khi kích hoạt lại |
| rejected\_at, rejection\_reason | timestamptz, varchar(1000) | Lúc và lý do từ chối | 1000: giới hạn chung cho ô lý do |
| disabled\_at, disabled\_reason | timestamptz, varchar(1000) | Bị vô hiệu hóa do vi phạm (GĐ2) | — |
| assignment\_minutes, assignment\_minutes\_as\_of | integer, timestamptz | Tổng phút dự kiến của các Assignment | Nhận qua event AssignmentMinutesChanged từ assessment-service |

Ngoài các cột nêu trên, bảng còn có: id (chính là course\_id mà mọi service khác dùng), organization\_id, created\_at, updated\_at.

Ba khái niệm tách riêng, đừng nhầm: status là vòng đời; course\_type là ai nhìn thấy trong danh mục; locked\_at là đã có người học nên cấu trúc bị khóa.

Luật dữ liệu:

* Mỗi chuỗi tối đa một phiên bản Published (BR-111) và tối đa một phiên bản đang biên soạn (Draft, Submitted hoặc Rejected, BR-289).  
* Chỉ phiên bản Published, Archived hoặc Disabled mới có thể Locked.  
* Ngoài Draft và Rejected, phiên bản phải đủ mô tả ngắn, mục tiêu và ít nhất một Learning Outcome (BR-290).  
* **Phiên bản hiện hành** của chuỗi là phiên bản có published\_at gần nhất, kể cả khi đang Disabled (BR-336). Không lưu thành cột, tính khi đọc.  
* Thời lượng ước tính của Course không lưu, tính khi đọc từ học liệu bắt buộc và assignment\_minutes theo tham số hiện hành (BR-51).

Vòng đời: Instructor gửi duyệt (Draft/Rejected → Submitted), rút lại (Submitted → Draft); Organizer duyệt (Submitted → Published, phiên bản Published cũ của chuỗi chuyển Archived) hoặc từ chối (Submitted → Rejected); vô hiệu hóa do vi phạm (Published ↔ Disabled, GĐ2).

### **modules** {#modules}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| course\_id | uuid | Phiên bản chứa Module | Xóa phiên bản thì xóa dây chuyền |
| title | varchar(200) | Tiêu đề | 200: giới hạn ô nhập tiêu đề |
| position | integer | Thứ tự trong phiên bản, từ 1 | Không trùng trong phiên bản |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

Luật "thứ tự không trùng" chỉ được kiểm **lúc kết thúc transaction**: đổi chỗ Module 1 và 2 thì giữa chừng có lúc hai Module cùng vị trí; kiểm cuối transaction mới không báo lỗi oan. lessons và materials áp dụng cùng cách.

### **lessons** {#lessons}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| module\_id | uuid | Module chứa Lesson | — |
| title | varchar(200) | Tiêu đề | 200 |
| content | varchar(20000) | Nội dung soạn trực tiếp (Markdown) | 20000 ký tự × tối đa 3 byte ≈ 60 KB, vừa giới hạn 64 KB của một request |
| position | integer | Thứ tự trong Module | — |
| disabled\_at, disabled\_report\_id | timestamptz, uuid | Bị vô hiệu hóa theo report nào (GĐ2) | Cùng có hoặc cùng trống |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

Nội dung soạn trong Lesson **không phải học liệu**: không có cờ bắt buộc, không tính vào điều kiện cấp Certificate (BR-292).

### **materials** {#materials}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| lesson\_id | uuid | Lesson chứa học liệu | — |
| material\_type | text | Video hoặc Reading (PDF) | — |
| title | varchar(200) | Tiêu đề | 200 |
| is\_required | boolean | Có bắt buộc không | Không có giá trị mặc định: người soạn phải chọn |
| file\_id | uuid | Tệp | — |
| position | integer | Thứ tự trong Lesson | — |
| disabled\_at, disabled\_report\_id | timestamptz, uuid | Bị vô hiệu hóa (GĐ2) | — |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

Đây là **chỗ duy nhất** có cờ bắt buộc. Lesson bắt buộc khi có ít nhất một học liệu bắt buộc; Module bắt buộc khi có ít nhất một Lesson bắt buộc; hai điều này suy ra khi đọc, không lưu (BR-147). Khi Course đã Locked, chỉ thêm được học liệu **không** bắt buộc, nằm cuối Lesson (BR-286).

### **media\_files** {#media_files}

Tệp vật lý trong kho MinIO. Tách khỏi materials vì **một tệp có thể được nhiều phiên bản dùng chung**: tạo phiên bản 2 từ phiên bản 1 thì học liệu mới trỏ vào tệp cũ, dung lượng không bị nhân đôi (BR-102).

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| purpose | text | MaterialVideo, MaterialReading, CourseCover | — |
| status | text | Pending (đang tải), Ready, Released (đã giải phóng) | — |
| storage\_key | text | Đường dẫn trong MinIO | Duy nhất |
| original\_filename | varchar(255) | Tên tệp gốc | 255: giới hạn tên tệp của hệ điều hành |
| mime\_type | varchar(255) | Loại tệp | 255 theo chuẩn RFC 6838 |
| size\_bytes | bigint | Dung lượng | Lớn hơn 0 |
| duration\_seconds | integer | Thời lượng video | Tính bằng **giây** vì learning cần đo tỉ lệ xem chính xác; chỉ video |
| word\_count | integer | Số từ của PDF | Để ước tính thời gian đọc; 0 nếu PDF là ảnh quét (BR-293) |
| ready\_at, released\_at | timestamptz | Lúc sẵn sàng, lúc giải phóng | — |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

Luật dữ liệu:

* Dung lượng đã dùng \= tổng tệp Pending \+ Ready. Tệp Pending được tính ngay để hai người cùng tải không vượt giới hạn; tải dở quá 24 giờ thì bị xóa và trả lại chỗ.  
* Tệp còn được học liệu hoặc ảnh bìa trỏ tới thì database không cho xóa (BR-75).  
* Loại tệp quyết định cột nào có: video có thời lượng, PDF có số từ, ảnh bìa không có cả hai.

### **content\_reports (GĐ2)** {#content_reports-(gđ2)}

Report nội dung vi phạm và toàn bộ quyết định xử lý.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| course\_id | uuid | Phiên bản chứa nội dung bị report | — |
| target\_type, target\_id | text, uuid | Loại (Lesson, Material, Quiz, Assignment) và ID nội dung | Quiz và Assignment nằm ở assessment nên chỉ lưu ID logic |
| owner\_instructor\_id | uuid | Instructor phụ trách **lúc tạo report** | **Ảnh chụp**: vi phạm tính cho người phụ trách lúc đó (BR-297) |
| reporter\_id | uuid | Người gửi | — |
| reason | varchar(1000) | Lý do | 1000 |
| level | text | Organization hoặc Platform (đã chuyển lên Admin) | — |
| status | text | Pending, Resolved, Dismissed | — |
| due\_at | timestamptz | Hạn xử lý | Lúc tạo \+ 7 ngày, **chép** từ tham số (BR-235) |
| Nhóm org\_… |  | Quyết định của Organizer: kết quả, mức độ, lý do, người, lúc | Cùng có hoặc cùng trống |
| Nhóm escalation\_… |  | Chuyển lên Admin: loại, lý do, người, lúc | Chỉ khi level \= Platform |
| Nhóm admin\_… |  | Quyết định của Admin | Chỉ khi level \= Platform |
| revision\_requested\_at, review\_requested\_at | timestamptz | Yêu cầu sửa, yêu cầu xem xét lại | — |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at. \*Nhóm quyết định của Organizer (BR-237, BR-238):

\- org\_decision (Kết quả Organizer ra: xác nhận vi phạm hoặc bác bỏ report)

\- org\_severity (Mức độ vi phạm: Minor (Nhẹ) hoặc Severe (Nghiêm trọng); chỉ có khi xác nhận vi phạm)

\- org\_decision\_reason (Lý do của quyết định, gửi kèm thông báo cho người gửi và Instructor)

\- org\_decided\_by (Organizer đã ra quyết định)

\- org\_decided\_at (Thời điểm ra quyết định)

\*Nhóm chuyển lên Admin (BR-254, BR-295):

\- escalation\_type (Lý do chuyển cấp: ReporterAppeal (người gửi không đồng ý), OwnerAppeal (Instructor không đồng ý) hoặc Overdue (quá hạn xử lý))

\- escalation\_reason (Lời giải thích của người chuyển cấp)

\- escalated\_by (Người chuyển cấp; trống khi hệ thống tự chuyển vì quá hạn)

\- escalated\_at (Thời điểm chuyển lên Admin)

\*Nhóm quyết định của Admin (BR-255, BR-256):

\- admin\_decision (Kết quả cuối cùng của Admin: xác nhận vi phạm hoặc xác định không vi phạm)

\- admin\_severity (Mức độ vi phạm Admin xác định: Minor hoặc Severe; chỉ có khi xác nhận vi phạm)

\- admin\_decision\_reason (Lý do của quyết định cuối cùng)

\- admin\_decided\_by (Admin đã ra quyết định)

\- admin\_decided\_at (Thời điểm ra quyết định)

Luật dữ liệu: một người chỉ có một report đang chờ trên cùng một nội dung (BR-296). Số vi phạm của Instructor không lưu riêng, đếm từ các report Resolved.

### **platform\_settings** {#platform_settings-1}

10 tham số: tốc độ đọc, số phút học mỗi ngày, ngưỡng chênh thời lượng, 5 giới hạn tệp (dung lượng, thời lượng, định dạng video và PDF), hạn xử lý report, ngưỡng vi phạm Instructor.

\*Các cột của bảng: id, source\_as\_of, created\_at, updated\_at và 10 cột tham số:

\- source\_as\_of (Thời điểm của lần cập nhật tham số gần nhất từ tenant-service; event cũ hơn mốc này bị bỏ qua)

\- reading\_speed\_words\_per\_minute (Tốc độ đọc chuẩn để ước tính thời lượng tài liệu, mặc định 200 từ/phút)

\- study\_minutes\_per\_day (Số phút học quy ước mỗi ngày, dùng đối chiếu thời lượng Course với số ngày hoàn thành dự kiến, mặc định 60 phút)

\- duration\_gap\_threshold\_percent (Ngưỡng chênh lệch thời lượng để cảnh báo Instructor, mặc định 20%)

\- max\_video\_size\_bytes (Dung lượng tối đa một tệp video, mặc định 2 GB)

\- max\_video\_duration\_minutes (Thời lượng tối đa một video, mặc định 120 phút)

\- max\_reading\_size\_bytes (Dung lượng tối đa một tệp PDF, mặc định 50 MB)

\- allowed\_video\_mime\_types (Định dạng video cho phép, mặc định MP4)

\- allowed\_reading\_mime\_types (Định dạng tài liệu đọc cho phép, mặc định PDF)

\- report\_handling\_days (Thời hạn xử lý report vi phạm, mặc định 7 ngày)

\- instructor\_violation\_threshold (Ngưỡng số vi phạm của Instructor để cảnh báo, mặc định 3\)

### **outbox\_events** {#outbox_events-1}

Event về duyệt Course, đổi loại, chuyển phụ trách, xóa Module hoặc Course, tạo phiên bản mới (kèm bảng đối chiếu Module cũ → mới), thay tệp lỗi, vô hiệu hóa và kích hoạt lại nội dung hoặc Course. Người nhận chính: learning, assessment, notification, audit.

Các cột của bảng: như mục 0.6.

## **2.4 Ví dụ dữ liệu** {#2.4-ví-dụ-dữ-liệu}

**Trước 02/10:** chuỗi CH-ATLD (instructor\_id \= U-MINH) có phiên bản 1 đang Published, đã Locked vì từng có người học.

**02/10: Minh tạo phiên bản 2\.** Hệ thống chép cây của phiên bản 1:

| Bảng | Dòng |
| ----- | ----- |
| courses | C-ATLD-2, version\_number \= 2, status \= Draft, locked\_at trống |
| modules | "Nhận diện nguy cơ", position \= 1 |
| lessons | "1.1 Các loại nguy cơ", position \= 1 |
| materials | Video, is\_required \= true, file\_id \= F-VIDEO (tệp **dùng chung** với phiên bản 1\) |
| materials | PDF, is\_required \= false, file\_id \= F-PDF |
| media\_files | Không thêm dòng: F-VIDEO (180 MB, 600 giây) và F-PDF (2 MB, 3.000 từ) vẫn là hai dòng cũ |
| outbox\_events | CourseVersionCreated để assessment chép Quiz, Assignment sang phiên bản 2 |

**03/10: Lan duyệt.** Khóa dòng chuỗi; C-ATLD-1 chuyển Archived (archived\_at \= 03/10) **trước**, rồi C-ATLD-2 chuyển Published (published\_at \= 03/10). Phiên bản hiện hành của chuỗi giờ là C-ATLD-2.

**05/10: Lan phân công.** learning gọi REST gắn Locked: C-ATLD-2.locked\_at \= 05/10 09:00. Từ giờ Minh không đổi được cờ bắt buộc hay xóa học liệu; muốn đổi phải tạo phiên bản 3\.

## **2.5 Trao đổi với service khác** {#2.5-trao-đổi-với-service-khác}

| Dữ liệu | Cách | Ghi chú |
| ----- | ----- | ----- |
| Giới hạn gói, trạng thái Subscription | Hỏi tenant lúc kiểm | Không chép |
| Tổng phút Assignment | Nhận event từ assessment | Lưu vào assignment\_minutes |
| Đã có Learner hoàn thành Lesson chưa; mọi Enrollment đã kết thúc chưa | Hỏi learning | Khi sửa nội dung Lesson đã Locked; khi giải phóng tệp |
| Số Learner, số Certificate theo phiên bản | Hỏi learning, achievement-reporting | Hiển thị màn hình chuỗi phiên bản |

course-service cung cấp: gắn Locked và cây chương trình (cho learning), thông tin Course (cho assessment), thông tin phiên bản, phiên bản hiện hành, số Course đang triển khai (cho achievement-reporting), số Course và dung lượng đã dùng (cho tenant).

## **2.6 Không có ở đây** {#2.6-không-có-ở-đây}

Quiz, Assignment, câu hỏi, điểm (assessment). Enrollment, tiến độ (learning). Cột "bắt buộc" trên Module, Lesson (suy ra). Thời lượng ước tính (tính khi đọc). Lịch sử duyệt các lần trước và lịch sử chuyển phụ trách (nằm ở audit).

# **Phần 3\. learning\_db: phân công, tiến độ, hoàn thành** {#phần-3.-learning_db:-phân-công,-tiến-độ,-hoàn-thành}

## **3.1 Service này lo việc gì** {#3.1-service-này-lo-việc-gì}

learning-service giữ quan hệ giữa một Learner và một phiên bản Course, gọi là **Enrollment**: ai học Course nào, bắt buộc hay tự chọn, hạn khi nào, đang ở trạng thái nào, đã học xong học liệu nào, và quyết định khi nào Enrollment hoàn thành.

Không giữ: nội dung Course (chỉ giữ bản sao rút gọn, xem 3.3), Quiz và điểm (assessment), Certificate (achievement-reporting). Lưu ý tên gọi: "Assignment" trong LearnUP là bài tập của assessment; việc Organizer giao Course cho Learner gọi là **phân công** và tạo ra Enrollment.

## **3.2 Toàn cảnh** {#3.2-toàn-cảnh}

| Bảng | Trả lời câu hỏi |
| ----- | ----- |
| enrollments | Learner này học phiên bản nào, loại gì, hạn khi nào, trạng thái gì? |
| enrollment\_status\_intervals | Enrollment này đã ở trạng thái Miễn hoặc Tạm dừng những khoảng nào? (GĐ2) |
| material\_progress | Learner đã xem những đoạn nào của video, đã hoàn thành học liệu nào? |
| course\_version\_snapshots | Bản sao: phiên bản này thuộc chuỗi nào, có đang bị vô hiệu hóa không? |
| material\_snapshots | Bản sao: học liệu nào bắt buộc, video dài bao nhiêu giây? |
| lesson\_snapshots | Bản sao thưa: Lesson nào đang bị vô hiệu hóa? (GĐ2) |
| organization\_suspensions | Bản sao: tổ chức bị khóa những khoảng nào? (GĐ2) |
| learner\_accounts | Bản sao thưa: tài khoản nào bị vô hiệu hóa hoặc đã xóa? |
| platform\_settings, outbox\_events | Mục 0.6 |

| Bảng con | Tham chiếu tới | Nghĩa |
| ----- | ----- | ----- |
| enrollments | course\_version\_snapshots | Enrollment gắn với một phiên bản đã có bản sao |
| enrollment\_status\_intervals | enrollments | Xóa Enrollment thì xóa dây chuyền |
| material\_progress | enrollments, material\_snapshots | Tiến độ của một Enrollment trên một học liệu |
| material\_snapshots, lesson\_snapshots | course\_version\_snapshots | Cây rút gọn của một phiên bản |

## **3.3 Từng bảng** {#3.3-từng-bảng}

### **enrollments** {#enrollments}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| learner\_id | uuid | Learner | ID logic, do tenant sinh |
| course\_id | uuid | Phiên bản Course | Mỗi Learner một Enrollment mỗi phiên bản (BR-298) |
| enrollment\_type | text | Required (Organizer phân công) hoặc Optional (Learner tự đăng ký) | Optional chuyển được thành Required, không có chiều ngược lại |
| status | text | NotStarted, InProgress, Completed, Exempted (Miễn), Withdrawn (Đã rút), Halted (Tạm dừng) | **Không lưu Overdue** (xem dưới) |
| enrolled\_at | timestamptz | Lúc tạo Enrollment | Giữ nguyên khi chuyển Optional → Required |
| assigned\_at | timestamptz | Lúc được phân công | Chỉ Required |
| expected\_completion\_days | integer | Số ngày hoàn thành dự kiến | **Ảnh chụp** từ Course lúc phân công; 1–365 |
| base\_due\_at | timestamptz | Hạn gốc: hết ngày (ngày phân công \+ số ngày), theo múi giờ tổ chức | BR-136, BR-300 |
| extension\_seconds | bigint | Tổng thời gian Organizer đã kéo dài hạn | Không âm |
| due\_at | timestamptz | Hạn hiện hành | Luôn tính lại từ đầu (xem dưới) |
| video\_completion\_percent | integer | Tỉ lệ xem video để tính hoàn thành | **Ảnh chụp** tham số lúc tạo (BR-299), 1–100 |
| first\_activity\_at | timestamptz | Lần đầu có dữ liệu học tập | Ranh giới NotStarted và InProgress (BR-307) |
| completed\_at, completed\_late | timestamptz, boolean | Lúc hoàn thành; có sau hạn không | completed\_late **chốt** lúc hoàn thành, chỉ Required (BR-215) |
| withdrawn\_at, withdrawn\_reason | timestamptz, text | Lúc và lý do rút: Learner rút, tài khoản bị xóa, Organizer đóng Enrollment tạm dừng | — |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

**Hạn hiện hành** \= hạn gốc \+ phần Organizer đã kéo dài \+ tổng các khoảng tạm dừng đã kết thúc (khoảng ở Miễn hoặc Tạm dừng, khoảng tổ chức bị khóa). Mỗi khi một thành phần đổi, hệ thống **tính lại từ đầu** chứ không cộng thêm vào hạn cũ, nên nhận event trùng hay sai thứ tự vẫn ra đúng một kết quả (BR-124, BR-47).

**Quá hạn (Overdue) tính lúc đọc:** Enrollment Required ở NotStarted hoặc InProgress đã qua due\_at, và tổ chức không đang bị khóa, thì hiển thị là Overdue. Thống kê quá hạn loại thêm tài khoản đang bị vô hiệu hóa (BR-38).

Luật dữ liệu:

* Required phải có đủ ngày phân công, số ngày, hạn gốc, hạn hiện hành; Optional không có hạn nên các cột này trống.  
* NotStarted thì chưa có hoạt động; InProgress thì phải có.  
* Completed khi và chỉ khi có completed\_at; Completed không có đường quay lui (BR-116).  
* Chỉ Required mới được Miễn (BR-120).

### **enrollment\_status\_intervals (GĐ2)** {#enrollment_status_intervals-(gđ2)}

Mỗi lần Enrollment vào Miễn hoặc Tạm dừng là một dòng. Cần bảng này vì hạn phải được dời **đúng bằng** thời gian ở các trạng thái đó (BR-124).

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| kind | text | Exempted hoặc Halted | — |
| started\_at, ended\_at | timestamptz | Khoảng thời gian; ended\_at trống là đang ở trạng thái đó | Mỗi Enrollment tối đa một khoảng đang mở |
| reason | varchar(1000) | Lý do | Bắt buộc với Miễn (BR-271) |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, enrollment\_id (Enrollment chủ), created\_at, updated\_at.

### **material\_progress** {#material_progress}

Tiến độ của một Enrollment trên một học liệu. Chỉ tạo dòng khi có dữ liệu.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| enrollment\_id, material\_id | uuid | Enrollment, học liệu | Một dòng mỗi cặp |
| watched\_ranges | int4multirange | Các đoạn giây video đã xem | Chỉ video |
| completed\_at | timestamptz | Lúc hoàn thành học liệu | **Không bao giờ xóa** (BR-309) |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

Cách đo video (BR-299): trình duyệt gửi các đoạn đã phát mỗi 15 giây. Database cộng vào tập đoạn và **tự gộp đoạn chồng nhau**, nên xem lại không bị tính hai lần và tua không được tính. Học liệu hoàn thành khi tổng độ dài các đoạn ≥ thời lượng × tỉ lệ chụp trong Enrollment. PDF hoàn thành khi Learner bấm đánh dấu.

### **course\_version\_snapshots** {#course_version_snapshots}

Bản sao của phiên bản Course, lấy khi có Enrollment đầu tiên. Khóa chính là course\_id gốc.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | :---: |
| course\_id | uuid | ID phiên bản bên course | — |
| chain\_id | uuid | Chuỗi phiên bản | — |
| tree\_fetched\_at | timestamptz | Lúc lấy cây | — |
| disabled\_at, disabled\_as\_of | timestamptz | Phiên bản đang bị vô hiệu hóa; mốc event gần nhất (GĐ2) | — |

Ngoài các cột nêu trên, bảng còn có: organization\_id, created\_at, updated\_at. Bảng không có cột id: khóa chính là course\_id.

Vì sao giữ bản sao cây: mỗi lần Learner hoàn thành một học liệu, learning phải xét "đã đủ học liệu bắt buộc chưa". Hỏi course-service mỗi lần thì chậm và phụ thuộc course-service đang chạy. Sau khi Locked, cây gần như không đổi (chỉ đổi tiêu đề, thêm học liệu không bắt buộc, bị vô hiệu hóa), nên giữ bản sao là an toàn.

### **material\_snapshots** {#material_snapshots}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| material\_id | uuid | ID học liệu bên course | Khóa chính |
| course\_id, lesson\_id | uuid | Phiên bản, Lesson | — |
| material\_type | text | Video hoặc Reading | — |
| is\_required | boolean | Bắt buộc | Không đổi sau Locked (BR-90) |
| duration\_seconds, duration\_as\_of | integer, timestamptz | Thời lượng video | Chỉ video; thay tệp lỗi có thể đổi thời lượng |
| disabled\_at, disabled\_as\_of | timestamptz | Bị vô hiệu hóa (GĐ2) | — |

Ngoài các cột nêu trên, bảng còn có: organization\_id, created\_at, updated\_at. Bảng không có cột id: khóa chính là material\_id.

Bản sao **không có tiêu đề**: màn hình cần tiêu đề thì hỏi course-service.

### **lesson\_snapshots (GĐ2)** {#lesson_snapshots-(gđ2)}

Bản sao thưa: chỉ Lesson từng bị vô hiệu hóa mới có dòng. Cột lesson\_id, course\_id, disabled\_at, disabled\_as\_of. Không gộp cờ này vào học liệu vì học liệu bị vô hiệu hóa riêng phải giữ nguyên trạng thái khi Lesson được kích hoạt lại.

Học liệu **còn hoạt động** khi chính nó, Lesson chứa nó và phiên bản đều không bị vô hiệu hóa. Chỉ học liệu còn hoạt động mới là điều kiện hoàn thành (BR-243).

Ngoài các cột nêu trên, bảng này có thêm organization\_id, created\_at, updated\_at. Khóa chính là lesson\_id; bảng không có cột id.

### **organization\_suspensions (GĐ2)** {#organization_suspensions-(gđ2)}

Bản sao các lần tổ chức bị khóa, khóa chính là ID lần khóa bên tenant. Cột started\_at, ended\_at. Dùng để dời hạn và để không tính quá hạn trong lúc bị khóa.

Các cột của bảng: id (ID lần khóa bên tenant, không tự sinh), organization\_id, started\_at, ended\_at, created\_at, updated\_at.

### **learner\_accounts** {#learner_accounts}

Bản sao thưa tài khoản khác bình thường. Cột user\_id (khóa chính), deactivated\_at, deleted\_at, status\_as\_of. Không có dòng nghĩa là tài khoản bình thường. Tài khoản bị xóa thì các Enrollment chưa hoàn thành chuyển Withdrawn (BR-304).

Ngoài các cột nêu trên, bảng này có thêm organization\_id, created\_at, updated\_at. Khóa chính là user\_id; bảng không có cột id.

### **platform\_settings, outbox\_events** {#platform_settings,-outbox_events}

Tham số duy nhất: video\_completion\_percent. Event phát ra: EnrollmentAssigned, DeadlineExtended, EnrollmentCompleted, các event Miễn, khôi phục, đóng Enrollment tạm dừng.

EnrollmentCompleted quan trọng nhất: mang enrollmentId, learnerId, courseId, completedAt, completedLate (Optional gửi false) và **bản chốt điểm** (điểm các Quiz, Assignment tại lúc hoàn thành, BR-219). learning **không lưu** bản chốt điểm; bản chốt đi theo event sang achievement-reporting và được lưu trong Certificate. Vì vậy topic này trên Kafka giữ thông điệp 30 ngày.

\*Các cột của platform\_settings:

\- id (Khóa chính; bảng chỉ có đúng một dòng)

\- video\_completion\_percent (Tỉ lệ xem video tối thiểu để tính hoàn thành học liệu Video, mặc định 90%; được chép vào từng Enrollment lúc tạo)

\- source\_as\_of (Thời điểm của lần cập nhật tham số gần nhất từ tenant-service; event cũ hơn mốc này bị bỏ qua)

\- created\_at, updated\_at (Lúc tạo dòng, lúc sửa gần nhất)

\*Các cột của outbox\_events: như mục 0.6.

## **3.4 Ví dụ dữ liệu** {#3.4-ví-dụ-dữ-liệu}

**05/10 09:00: Lan phân công An học C-ATLD-2.** Trước khi ghi, learning hỏi tenant (An có phải Learner của ABC, múi giờ tổ chức) và gọi course gắn Locked. Một transaction ghi:

| Bảng | Dữ liệu |
| ----- | ----- |
| course\_version\_snapshots | C-ATLD-2, chain\_id \= CH-ATLD (lần đầu có Enrollment nên lấy cây) |
| material\_snapshots | Video: is\_required \= true, duration\_seconds \= 600; PDF: is\_required \= false |
| enrollments | E-AN: U-AN, C-ATLD-2, Required, NotStarted, assigned\_at \= 05/10 09:00, expected\_completion\_days \= 14, base\_due\_at \= due\_at \= 20/10 00:00 (hết ngày 19/10), video\_completion\_percent \= 90 |
| outbox\_events | EnrollmentAssigned để gửi email cho An |

**06/10: An xem video.** Xem 0–300 giây, tua lại xem 250–560, rồi xem 560–600.

| Lần gửi | Đoạn gửi lên | watched\_ranges sau khi gộp | Tổng |
| ----- | ----- | ----- | ----- |
| 1 | \[0,300) | {\[0,300)} | 300 giây |
| 2 | \[250,560) | {\[0,560)} | 560 giây |
| 3 | \[560,600) | {\[0,600)} | 600 giây ≥ 540 (90% × 600): hoàn thành |

material\_progress có completed\_at; E-AN có first\_activity\_at và chuyển InProgress.

**15/10 16:00: Minh chốt điểm bài của An.** assessment phát event báo tình trạng thay đổi; learning thấy học liệu bắt buộc đã đủ, hỏi assessment điều kiện và điểm: Quiz 85 ≥ 70, Assignment 80 ≥ 60, đã chấm chéo đủ. Một transaction: E-AN chuyển Completed, completed\_at \= 15/10 16:00, completed\_late \= false (trước hạn 20/10 00:00); outbox\_events thêm EnrollmentCompleted kèm bản chốt điểm.

**Trường hợp Cường:** không làm gì tới 20/10. Dòng E-CUONG vẫn lưu InProgress, nhưng từ 20/10 00:00 mọi màn hình đọc ra Overdue mà không ai phải sửa dữ liệu. Nếu Lan kéo hạn tới 25/10, extension\_seconds tăng 5 ngày, due\_at tính lại, Overdue tự hết.

## **3.5 Trao đổi với service khác** {#3.5-trao-đổi-với-service-khác}

| Dữ liệu | Cách | Khi nào |
| ----- | ----- | ----- |
| Số ngày hoàn thành dự kiến, chuỗi, cây rút gọn | Hỏi course, chép vào bản sao | Enrollment đầu tiên của phiên bản |
| Vô hiệu hóa Course, Lesson, học liệu | Event từ course | Khi xảy ra |
| Điều kiện và bản chốt điểm | Hỏi assessment | Mỗi lần xét hoàn thành |
| Múi giờ, vai trò Learner, trạng thái Subscription | Hỏi tenant, không chép | Lúc phân công |
| Khóa tổ chức, tài khoản bị vô hiệu hóa, xóa | Event từ tenant, chép vào bản sao | Khi xảy ra |

learning-service cung cấp: EnrollmentCompleted (achievement-reporting, assessment); Enrollment còn cho làm bài không (assessment); số Learner theo phiên bản, đã có ai hoàn thành Lesson chưa (course); số liệu báo cáo tổng hợp và danh sách Enrollment có trạng thái Overdue (achievement-reporting).

## **3.6 Không có ở đây** {#3.6-không-có-ở-đây}

Tiêu đề và thứ tự Module, Lesson, học liệu (hỏi course). Quiz, lượt làm, điểm (assessment). Bản chốt điểm (nằm trong Certificate). Cột Overdue và việc chạy theo lịch đổi trạng thái (tính lúc đọc). Lịch sử các lần kéo dài hạn và người thực hiện (nằm ở audit).

# **Phần 4\. assessment\_db: Quiz, Assignment, chấm chéo** {#phần-4.-assessment_db:-quiz,-assignment,-chấm-chéo}

## **4.1 Service này lo việc gì** {#4.1-service-này-lo-việc-gì}

assessment-service giữ mọi thứ về đánh giá kết quả học: Quiz và câu hỏi, Assignment và Rubric (bộ tiêu chí chấm), lượt làm Quiz, bài nộp, chấm chéo giữa các Learner, Instructor chấm và chốt điểm, cơ chế khóa sau n lượt liên tiếp.

Không giữ: cấu trúc Course (course), Enrollment (learning), Certificate (achievement-reporting). Quiz và Assignment gắn với Course bằng course\_id và module\_id là ID logic bên course-service.

Hai cơ chế cần hiểu trước khi đọc bảng:

**Khóa n lượt, m giờ.** Mỗi Assessment cho phép tối đa n lượt liên tiếp (mặc định 3). Làm hết n lượt thì bị khóa m giờ (mặc định 24), hết khóa thì đếm lại từ đầu. Chặn việc làm Quiz liên tục để dò đáp án (BR-175, BR-176).

**Chu kỳ chấm chéo.** Với Assignment bật chấm chéo, bài nộp được gom theo chu kỳ (mặc định 7 ngày). Hết chu kỳ, hệ thống xếp ngẫu nhiên những người đã nộp trong chu kỳ và giao mỗi người chấm N bài của người khác (N từ 2 đến 5). Người chấm có hạn (mặc định 3 ngày). Mỗi người chấm luôn là người đã nộp bài trong chính chu kỳ đó, nên cần ít nhất N \+ 1 bài (BR-202, BR-203).

## **4.2 Toàn cảnh** {#4.2-toàn-cảnh}

| Nhóm | Bảng | Trả lời câu hỏi |
| ----- | ----- | ----- |
| Định nghĩa | assessments | Quiz, Assignment này thuộc Course nào, điểm đạt bao nhiêu, có bắt buộc không? |
|  | quiz\_questions, quiz\_question\_options | Quiz có những câu hỏi, đáp án nào, đáp án nào đúng? |
|  | rubric\_criteria | Assignment chấm theo những tiêu chí nào, mỗi tiêu chí tối đa bao nhiêu điểm? |
| Bài làm | learner\_assessment\_states | Learner này đã làm bao nhiêu lượt liên tiếp, đang bị khóa không, lượt nào được tính điểm, nợ chấm chéo không? |
|  | quiz\_attempts, quiz\_attempt\_answers | Mỗi lượt làm Quiz bắt đầu, nộp lúc nào, chọn đáp án nào, được bao nhiêu điểm? |
|  | submissions | Mỗi lần nộp Assignment nộp gì, đang ở bước chấm nào, điểm chốt bao nhiêu? |
| Chấm chéo | peer\_review\_cycles | Chu kỳ nào, ba mốc thời gian, ai chấm bài ai? |
|  | submission\_reviews, submission\_review\_scores | Ai chấm bài nào, điểm từng tiêu chí, nhận xét gì? |
| Bản sao | completed\_enrollments | Enrollment nào đã Completed (Quiz, Assignment chuyển chỉ đọc)? |
|  | learner\_accounts | Tài khoản nào bị vô hiệu hóa hoặc đã xóa? |
| Hạ tầng | platform\_settings, outbox\_events | Mục 0.6 |

| Bảng con | Tham chiếu tới | Nghĩa |
| ----- | ----- | ----- |
| quiz\_questions, rubric\_criteria, learner\_assessment\_states, quiz\_attempts, submissions, peer\_review\_cycles | assessments | Thuộc một Quiz hoặc Assignment; xóa Assessment thì xóa dây chuyền |
| quiz\_question\_options | quiz\_questions | Đáp án của câu hỏi |
| quiz\_attempt\_answers | quiz\_attempts, quiz\_question\_options | Lượt làm đã chọn đáp án nào |
| learner\_assessment\_states | quiz\_attempts, submissions | Trỏ tới lượt được tính điểm, bài nộp gần nhất |
| submissions | peer\_review\_cycles | Bài nộp thuộc chu kỳ nào |
| submission\_reviews | submissions | Lượt chấm của một bài |
| submission\_review\_scores | submission\_reviews, rubric\_criteria | Điểm của một tiêu chí trong một lượt chấm |

## **4.3 Từng bảng** {#4.3-từng-bảng}

### **assessments** {#assessments}

Quiz và Assignment chung một bảng, phân biệt bằng cột kind, vì chúng dùng chung thứ tự trong Course, chung điểm đạt, chung cơ chế n/m và chung cờ vô hiệu hóa.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| course\_id | uuid | Phiên bản Course | ID logic |
| module\_id | uuid | Module, nếu Quiz gắn Module; trống nếu gắn cả Course | Assignment luôn gắn Course (BR-162) |
| kind | text | Quiz hoặc Assignment | — |
| title | varchar(200) | Tiêu đề | 200: cùng giới hạn tiêu đề Module, Lesson |
| position | integer | Thứ tự trong chỗ gắn | Không trùng trong cùng chỗ gắn (BR-291) |
| passing\_score | numeric(5,2) | Điểm đạt | Lớn hơn 0 tới 100, 2 chữ số thập phân (BR-315) |
| max\_consecutive\_attempts, lockout\_hours | integer | n và m | **Chép** tham số lúc tạo; Instructor sửa được |
| is\_required | boolean | Bắt buộc | Assignment luôn bắt buộc (BR-165) |
| time\_limit\_minutes | integer | Thời gian làm Quiz | Chỉ Quiz, 1–1440 phút (tối đa một ngày) |
| prompt | varchar(8000) | Đề bài Assignment (Markdown) | 8000 × 3 byte ≈ 24 KB, cộng Rubric vẫn dưới 64 KB một request |
| 4 cột prompt\_file\_… |  | Một tệp đề bài: khóa, tên, loại, dung lượng | Tên, loại 255; tệp ≤ 50 MB (BR-320) |
| expected\_duration\_minutes | integer | Thời lượng dự kiến làm Assignment | Lớn hơn 0; cộng vào thời lượng Course |
| peer\_review\_enabled | boolean | Bật chấm chéo | Chỉ Assignment |
| peer\_reviewers\_per\_submission | smallint | N | 2–5: ít nhất 2 để lấy trung bình và so chênh lệch |
| peer\_review\_cycle\_days, peer\_review\_deadline\_days | integer | Độ dài chu kỳ, hạn chấm | **Chép** tham số lúc bật |
| peer\_review\_score\_gap | numeric(5,2) | Ngưỡng chênh điểm giữa người chấm | Vượt thì chuyển Instructor xem lại (BR-321) |
| disabled\_at | timestamptz | Bị vô hiệu hóa (GĐ2) | Do course-service ra lệnh |
| copied\_from\_id | uuid | Assessment gốc khi chép sang phiên bản mới (GĐ2) | Chống chép trùng |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at. Bốn cột tệp đề bài tên là prompt\_file\_key, prompt\_file\_name, prompt\_file\_mime, prompt\_file\_size\_bytes.

Luật dữ liệu: Quiz phải có thời gian giới hạn, không có đề bài, không bật chấm chéo; Assignment phải có đề bài, thời lượng, luôn bắt buộc, không gắn Module; bật chấm chéo thì phải có đủ bốn tham số.

### **quiz\_questions, quiz\_question\_options** {#quiz_questions,-quiz_question_options}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| question\_type | text | SingleChoice, MultipleChoice, TrueFalse | — |
| content (câu hỏi) | varchar(2000) | Nội dung câu hỏi | Khoảng 300 từ, đủ cho câu hỏi kèm tình huống ngắn |
| content (đáp án) | varchar(500) | Nội dung đáp án | 500 |
| is\_correct | boolean | Đáp án đúng | Không bao giờ gửi cho Learner trước khi lượt làm được chấm |
| position | integer | Thứ tự | — |

Ngoài các cột nêu trên, bảng quiz\_questions còn có id, organization\_id, assessment\_id (Quiz chứa câu hỏi), created\_at, updated\_at; bảng quiz\_question\_options còn có id, organization\_id, question\_id (câu hỏi chứa đáp án), created\_at, updated\_at.

Mỗi câu 2–10 đáp án; một lựa chọn có đúng một đáp án đúng; Đúng/Sai có đúng hai đáp án. Mỗi Quiz 1–100 câu. Quiz đã có người làm thì không sửa câu hỏi được (BR-96).

### **rubric\_criteria** {#rubric_criteria}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| name | varchar(200) | Tên tiêu chí | 200 |
| description | varchar(500) | Mô tả | 500 |
| max\_points | smallint | Điểm tối đa | Số nguyên 1–100 |
| position | integer | Thứ tự | — |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, assessment\_id (Assignment dùng Rubric), created\_at, updated\_at.

Mỗi Rubric 1–10 tiêu chí. Assignment đã có bài nộp thì không sửa Rubric (BR-98). Điểm một lượt chấm \= tổng điểm các tiêu chí ÷ tổng điểm tối đa × 100 (BR-315).

### **learner\_assessment\_states** {#learner_assessment_states}

Một dòng cho mỗi cặp (Assessment, Learner), tạo ở lần hoạt động đầu tiên. Dòng này cũng là "chìa khóa" khi Learner thao tác đồng thời, ví dụ mở hai tab cùng bắt đầu Quiz.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| learner\_id | uuid | Learner | Một dòng mỗi cặp |
| first\_activity\_at | timestamptz | Hoạt động đầu tiên | Báo cho learning để chuyển InProgress (BR-307) |
| consecutive\_count | integer | Số lượt liên tiếp đã dùng | Không âm |
| locked\_until | timestamptz | Bị khóa tới lúc nào | Khóa m giờ sau lượt thứ n |
| recorded\_attempt\_id | uuid | Lượt Quiz được tính điểm | Lượt điểm cao nhất; hòa thì lượt sớm hơn (BR-159) |
| latest\_submission\_id | uuid | Bài nộp gần nhất | Assignment tính bài gần nhất (BR-170) |
| peer\_review\_obligation | text | Nghĩa vụ chấm chéo: trống, Pending, Fulfilled, Missed, Exempted | — |
| exempted\_at, exempted\_by | timestamptz, uuid | Instructor miễn nghĩa vụ | BR-316 |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, assessment\_id, created\_at, updated\_at.

Khóa n/m xử lý khi cần: lúc Learner bắt đầu lượt mới, nếu locked\_until đã qua thì đếm lại từ 0; nếu chưa qua thì từ chối. Không có việc chạy theo lịch mở khóa.

**Đạt một Assessment:** Quiz có lượt được tính điểm và điểm ≥ điểm đạt. Assignment có bài nộp gần nhất đã chốt, điểm chốt ≥ điểm đạt, và nghĩa vụ chấm chéo trống, Fulfilled hoặc Exempted (BR-212).

### **quiz\_attempts, quiz\_attempt\_answers** {#quiz_attempts,-quiz_attempt_answers}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| attempt\_number | integer | Lượt thứ mấy | Không trùng cho cùng Learner, Quiz |
| started\_at, deadline\_at | timestamptz | Bắt đầu; hết giờ \= bắt đầu \+ thời gian giới hạn | — |
| submitted\_at, submission\_kind | timestamptz, text | Lúc nộp; Manual hoặc TimedOut (tự nộp khi hết giờ) | — |
| score | numeric(5,2) | Điểm lượt | Chấm ngay khi nộp: số câu đúng ÷ tổng câu × 100 |
| option\_id  (bảng đáp án) | uuid | Mỗi đáp án Learner đã chọn là một dòng | Ghi ngay khi chọn, mất mạng không mất bài |

Ngoài các cột nêu trên, bảng quiz\_attempts còn có id, organization\_id, assessment\_id, learner\_id, created\_at, updated\_at; bảng quiz\_attempt\_answers còn có id, organization\_id, attempt\_id (lượt làm), question\_id (câu hỏi), created\_at, updated\_at.

Mỗi Learner chỉ có tối đa một lượt đang làm trên một Quiz. Lượt được tính ngay khi bắt đầu, không chờ nộp (BR-314). Một câu đúng khi tập đáp án đã chọn trùng khớp tập đáp án đúng, không có điểm từng phần.

### **submissions** {#submissions}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| submission\_number | integer | Lần nộp thứ mấy | — |
| content | varchar(20000) | Bài làm dạng chữ | 20000: cùng căn cứ nội dung Lesson; có chữ hoặc có tệp |
| 4 cột file\_… |  | Tệp nộp | 1 tệp ≤ 50 MB, PDF, DOCX hoặc ZIP; không tính dung lượng gói |
| submitted\_at | timestamptz | Lúc nộp | — |
| cycle\_id | uuid | Chu kỳ chấm chéo | — |
| superseded\_at | timestamptz | Bị bài nộp mới hơn thay thế | — |
| grading\_status | text | WaitingForCycle, InPeerReview, NeedsInstructorGrading, AwaitingFinalization, Finalized | — |
| intervention\_reason | text | Vì sao cần Instructor chấm: chấm chéo tắt, không đủ bài, người chấm bỏ, chênh điểm lớn… | Chỉ khi NeedsInstructorGrading |
| final\_score | numeric(5,2) | Điểm chốt | 0–100 |
| finalization\_comment | varchar(2000) | Nhận xét khi chốt | Bắt buộc nếu điểm chốt khác điểm tổng hợp (BR-322) |
| finalized\_at, finalized\_by | timestamptz, uuid | Lúc và người chốt | — |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, assessment\_id (Assignment), learner\_id (người nộp), created\_at, updated\_at. Bốn cột tệp tên là file\_key, file\_name, file\_mime, file\_size\_bytes.

Mọi bài nộp đều phải qua Instructor chốt điểm; chấm chéo chỉ đưa ra điểm gợi ý (trung bình các lượt chấm hợp lệ).

### **peer\_review\_cycles** {#peer_review_cycles}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| opens\_at, closes\_at, review\_due\_at | timestamptz | Ba mốc: mở, chốt và phân công, hạn chấm | Tính theo ngày lịch, múi giờ tổ chức (BR-312); mở \< chốt \< hạn |
| reviewers\_per\_submission, score\_gap, reminder\_hours |  | N, ngưỡng chênh, giờ nhắc | **Chép** lúc tạo chu kỳ: Instructor sửa tham số giữa chừng không ảnh hưởng chu kỳ đang chạy |
| status | text | Open, Assigned, InstructorOnly (không đủ bài), Completed | — |
| reviewer\_permutation | mảng uuid | Thứ tự ngẫu nhiên những người nộp bài | Người ở vị trí i chấm bài của vị trí i+1 … i+N theo vòng |
| closed\_at, reminded\_at, completed\_at | timestamptz | Lúc hệ thống thực sự chốt, nhắc, kết thúc | — |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, assessment\_id, created\_at, updated\_at.

Chu kỳ chỉ được tạo khi có bài nộp đầu tiên rơi vào; khoảng không có bài nộp không sinh chu kỳ. Chốt chu kỳ, nhắc trước hạn, kết thúc hạn do việc chạy theo lịch làm, vì phải báo cho người dùng.

### **submission\_reviews, submission\_review\_scores** {#submission_reviews,-submission_review_scores}

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| reviewer\_id | uuid | Người chấm | — |
| reviewer\_role | text | Peer (Learner) hoặc Instructor | — |
| status | text | Pending, Completed, Removed (người chấm bị vô hiệu hóa), Expired (quá hạn không chấm) | — |
| score | numeric(5,2) | Điểm lượt chấm | Tính lúc hoàn thành |
| comment | varchar(2000) | Nhận xét chung | Bắt buộc khi hoàn thành (BR-324) |
| points (bảng điểm tiêu chí) | smallint | Điểm một tiêu chí | Số nguyên từ 0 tới điểm tối đa của tiêu chí |

Ngoài các cột nêu trên, bảng submission\_reviews còn có id, organization\_id, submission\_id (bài được chấm), cycle\_id (chu kỳ; trống khi Instructor chấm), completed\_at (lúc chấm xong), created\_at, updated\_at; bảng submission\_review\_scores còn có id, organization\_id, review\_id, criterion\_id, created\_at, updated\_at.

Lượt chấm chỉ được ghi nhận khi có điểm cho **mọi** tiêu chí và có nhận xét. Người chấm không thấy tên tác giả, tác giả không thấy tên người chấm; Instructor thấy cả hai (BR-190–BR-192).

### **completed\_enrollments, learner\_accounts** {#completed_enrollments,-learner_accounts}

completed\_enrollments là bản sao Enrollment đã Completed, khóa chính là enrollment\_id gốc, nhận từ event EnrollmentCompleted. Có dòng thì Learner không bắt đầu lượt Quiz mới và không nộp bài mới nữa, nhưng lượt đang làm dở được làm nốt và vẫn chấm chéo được (BR-169, BR-325).

learner\_accounts là bản sao thưa như ở learning. Khi chốt chu kỳ, lượt chấm giao cho người bị vô hiệu hóa được tạo sẵn ở trạng thái Removed và bài chuyển Instructor chấm (BR-39).

Các cột của completed\_enrollments: enrollment\_id (khóa chính), organization\_id, learner\_id, course\_id, completed\_at, created\_at, updated\_at. Các cột của learner\_accounts: user\_id (khóa chính), organization\_id, deactivated\_at, deleted\_at, status\_as\_of, created\_at, updated\_at.

### **platform\_settings, outbox\_events** {#platform_settings,-outbox_events-1}

5 tham số: độ dài chu kỳ, hạn chấm, giờ nhắc, số lượt liên tiếp, thời gian khóa. Event phát ra: LearnerAssessmentStatusChanged (báo learning xét lại tiến độ), AssignmentMinutesChanged (báo course tổng phút Assignment), các thông báo phân công chấm, nhắc chấm, cần Instructor chấm, đã chốt điểm.

\*Các cột của platform\_settings:

\- id (Khóa chính; bảng chỉ có đúng một dòng)

\- default\_peer\_review\_cycle\_days (Độ dài chu kỳ chấm chéo mặc định, 7 ngày; chép vào Assignment lúc bật chấm chéo)

\- default\_peer\_review\_deadline\_days (Thời hạn hoàn thành chấm chéo mặc định, 3 ngày, đếm từ ngày chốt chu kỳ; chép vào Assignment lúc bật chấm chéo)

\- peer\_review\_reminder\_hours (Nhắc người chấm trước hạn, mặc định 24 giờ; chép vào chu kỳ lúc tạo)

\- default\_max\_consecutive\_attempts (Số lượt làm liên tiếp tối đa mặc định (n), 3 lượt; chép vào Quiz, Assignment lúc tạo)

\- default\_lockout\_hours (Thời gian tạm khóa sau khi hết n lượt mặc định (m), 24 giờ; chép vào Quiz, Assignment lúc tạo)

\- source\_as\_of (Thời điểm của lần cập nhật tham số gần nhất từ tenant-service; event cũ hơn mốc này bị bỏ qua)

\- created\_at, updated\_at (Lúc tạo dòng, lúc sửa gần nhất)

\*Các cột của outbox\_events: như mục 0.6.

## **4.4 Ví dụ dữ liệu** {#4.4-ví-dụ-dữ-liệu}

**06/10: An làm Quiz** (10 câu, 30 phút, điểm đạt 70, n \= 3).

| Bảng | Dữ liệu |
| ----- | ----- |
| learner\_assessment\_states | Tạo dòng (An, Quiz): first\_activity\_at \= 06/10 14:00, consecutive\_count \= 1 |
| quiz\_attempts | Lượt 1: bắt đầu 14:00, deadline\_at 14:30, nộp 14:20, 6/10 câu đúng → score \= 60 |
| learner\_assessment\_states | recorded\_attempt\_id \= lượt 1 |
| quiz\_attempts | Lượt 2: nộp 15:10, score \= 85; consecutive\_count \= 2 |
| learner\_assessment\_states | recorded\_attempt\_id chuyển sang lượt 2 (85 \> 60\) |

**07/10 10:00: An nộp Assignment.** Chưa có chu kỳ nào, hệ thống tạo chu kỳ: mở 07/10 00:00, chốt 15/10 00:00, hạn chấm 18/10 00:00. submissions: lần 1, grading\_status \= WaitingForCycle. Bình, Cường nộp ngày 08/10, rơi vào cùng chu kỳ.

**15/10 00:00: chốt chu kỳ.** 3 bài ≥ N \+ 1 \= 3, đủ điều kiện. Xếp ngẫu nhiên \[U-BINH, U-AN, U-CUONG\]; với N \= 2 mỗi người chấm 2 bài của hai người còn lại.

| Bảng | Dữ liệu |
| ----- | ----- |
| peer\_review\_cycles | status \= Assigned, reviewer\_permutation như trên |
| submission\_reviews | 6 dòng Pending: mỗi bài 2 người chấm |
| submissions | 3 bài chuyển InPeerReview |
| learner\_assessment\_states | Nghĩa vụ của ba người chuyển Pending |

**15/10 sáng:** Bình và Cường chấm bài của An (78 và 82 theo Rubric) → bài An chuyển AwaitingFinalization, điểm gợi ý 80\. An chấm xong 2 bài được giao → nghĩa vụ Fulfilled.

**15/10 16:00: Minh chốt điểm bài của An là 80\.** submissions: Finalized, final\_score \= 80 (bằng điểm gợi ý nên không cần nhận xét). Event LearnerAssessmentStatusChanged báo learning, learning xét và chuyển An sang Completed. Sau đó completed\_enrollments nhận dòng của An: An không nộp bài mới được nữa.

## **4.5 Trao đổi với service khác** {#4.5-trao-đổi-với-service-khác}

| Dữ liệu | Cách | Khi nào |
| ----- | ----- | ----- |
| Trạng thái Course, thời điểm Locked, Instructor phụ trách | Hỏi course, không chép | Mỗi thao tác của Instructor (chuyển phụ trách phải có hiệu lực ngay) |
| Enrollment còn cho làm bài không | Hỏi learning | Bắt đầu lượt Quiz, nộp bài |
| Enrollment đã Completed | Event từ learning, chép vào bản sao | Khi xảy ra |
| Múi giờ tổ chức | Hỏi tenant | Tạo chu kỳ |
| Tài khoản bị vô hiệu hóa, xóa | Event từ tenant, chép vào bản sao | Khi xảy ra |

assessment-service cung cấp: điều kiện và bản chốt điểm (learning); số Quiz bắt buộc và Assignment còn hoạt động, đặt cờ vô hiệu hóa (course); kết quả theo Learner cho báo cáo (achievement-reporting).

## **4.6 Không có ở đây** {#4.6-không-có-ở-đây}

Enrollment, tiến độ (learning). Cấu trúc Course (course). Certificate (achievement-reporting). Ngân hàng câu hỏi dùng chung giữa các Course. Điểm tổng hợp, độ chênh điểm (tính lúc đọc). Lịch sử các lần bị khóa n/m.

# **Phần 5\. achievement\_reporting\_db: Certificate, phiếu đánh giá, báo cáo** {#phần-5.-achievement_reporting_db:-certificate,-phiếu-đánh-giá,-báo-cáo}

## **5.1 Service này lo việc gì** {#5.1-service-này-lo-việc-gì}

achievement-reporting-service giữ Certificate, phiếu đánh giá hiệu quả đào tạo, và điều phối báo cáo, kết xuất tệp.

Không giữ: điều kiện cấp Certificate (learning đã xét rồi gửi sang), Enrollment, tiến độ, điểm. Báo cáo **không có bảng số liệu riêng**: mỗi lần xem, service hỏi thẳng learning, assessment, tenant, course rồi ghép lại, để số liệu tuân thủ luôn khớp dữ liệu gốc. Service này không phát event nào, nên không có bảng outbox\_events.

## **5.2 Toàn cảnh** {#5.2-toàn-cảnh}

| Bảng | Trả lời câu hỏi | Giai đoạn |
| ----- | ----- | ----- |
| certificates | Learner này được cấp Certificate nào, ghi tên gì, ngày nào, mã gì? | 1 |
| evaluation\_forms | Learner nào được mời đánh giá Course, hạn tới khi nào, đã gửi chưa? | 2 |
| evaluation\_responses | Nội dung các phiếu đã gửi (không biết của ai) | 2 |
| report\_exports | Ai yêu cầu kết xuất báo cáo nào, tệp đã xong chưa, còn tải được tới khi nào? | 2 |
| platform\_settings | Hạn thực hiện phiếu đánh giá (mục 0.6) | 2 |

| Bảng con | Tham chiếu tới | Nghĩa |
| ----- | ----- | ----- |
| evaluation\_forms | certificates | Phiếu chỉ mở cho lượt hoàn thành đã có Certificate, cùng tổ chức |
| evaluation\_responses | **không có** | Cố ý không nối với phiếu nào, để không ai truy ra người gửi (BR-261) |

Bảng platform\_settings không có mục riêng ở 5.3. Các cột của bảng: id, evaluation\_form\_days, source\_as\_of, created\_at, updated\_at.

## **5.3 Từng bảng** {#5.3-từng-bảng}

### **certificates** {#certificates}

Mỗi dòng là một Certificate cho một Enrollment đã hoàn thành.

Việc cấp đi qua hai bước. Khi nhận event EnrollmentCompleted, service ghi ngay dòng ở trạng thái Pending với đủ dữ liệu có trong event. Sau đó mới hỏi tenant tên Learner và hỏi course tên Course; có đủ thì chuyển Issued. Hỏi lỗi thì một việc chạy mỗi phút thử lại, giãn dần, **không bao giờ bỏ cuộc**. Nhờ ghi trước hỏi sau, một khi event đã tới thì không có chuyện Learner hoàn thành mà mất Certificate.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| enrollment\_id | uuid | Enrollment đã hoàn thành | Duy nhất: nhận event trùng không tạo Certificate thứ hai (BR-213) |
| learner\_id, course\_id | uuid | Learner, phiên bản Course | Cặp này cũng duy nhất: mỗi Learner một Certificate mỗi phiên bản (BR-213) |
| certificate\_code | varchar(12) | Mã định danh, hiển thị dạng XXXX-XXXX-XXXX | 12 ký tự ngẫu nhiên, bảng chữ Crockford Base32 (bỏ I, L, O, U cho khỏi nhầm với 1 và 0): khoảng 10¹⁸ tổ hợp, không đoán được mã người khác; duy nhất toàn nền tảng (BR-331) |
| status | text | Pending (chờ lấy tên) hoặc Issued | Learner chỉ thấy Certificate Issued |
| issued\_at | timestamptz | Ngày cấp | \= lúc hoàn thành trong event, không phải lúc lấy được tên, để thử lại không làm lệch ngày (BR-326) |
| completed\_late | boolean | Hoàn thành sau hạn | Từ event (BR-215) |
| score\_snapshot | jsonb | Bản chốt điểm lúc hoàn thành | Lưu nguyên văn, service không diễn giải (BR-219) |
| learner\_name | varchar(100) | **Ảnh chụp** họ tên | 100: cùng giới hạn họ tên bên tenant, để không bị cắt chữ |
| course\_name | varchar(200) | **Ảnh chụp** tên Course | 200: cùng giới hạn tên Course |
| version\_number | integer | **Ảnh chụp** số hiệu phiên bản | ≥ 1 |
| chain\_id | uuid | Chuỗi phiên bản | Dùng cho báo cáo phiên bản (GĐ2) |
| issue\_attempts, next\_attempt\_at, last\_error | integer, timestamptz, text | Số lần hỏi tên thất bại, lần thử kế tiếp, lỗi gần nhất | Chỉ có nghĩa khi Pending |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

Luật dữ liệu:

* Pending thì 4 cột ảnh chụp trống và phải có lần thử kế tiếp; Issued thì 4 cột ảnh chụp phải đủ và không còn thông tin thử lại.  
* **Bất biến** (trigger): Certificate đã Issued thì không ai sửa được; không ai xóa được Certificate, kể cả khi tài khoản Learner bị xóa (BR-217, BR-220). Khi còn Pending, các cột lấy từ event (ngày cấp, bản chốt điểm…) cũng không đổi được.  
* Không có cột loại Enrollment: Enrollment đã hoàn thành vẫn có thể đổi từ Optional sang Required (BR-135), nên giá trị chụp sẽ sai.

Bản PDF không lưu sẵn: mỗi lần Learner tải, hệ thống sinh PDF từ dòng đã chốt (BR-216, BR-220).

### **evaluation\_forms (GĐ2)** {#evaluation_forms-(gđ2)}

Phiếu mời một Learner đánh giá Course vừa hoàn thành. Bảng này **chỉ biết ai được mời và đã gửi hay chưa, không chứa nội dung phiếu**.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| enrollment\_id | uuid | Lượt hoàn thành | Mỗi lượt một phiếu (BR-257) |
| learner\_id | uuid | Learner được mời | Chỉ dùng cho màn hình của chính Learner |
| course\_id | uuid | Phiên bản Course | — |
| opened\_at | timestamptz | Lúc mở phiếu | \= lúc hoàn thành |
| due\_at | timestamptz | Hạn gửi | Mở \+ 14 ngày; số ngày **chép** từ tham số lúc tạo (BR-258, BR-269) |
| submitted\_at | timestamptz | Lúc gửi; trống là chưa gửi | Phải trước due\_at |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

Luật dữ liệu:

* Phiếu "đang mở" khi chưa gửi và chưa quá hạn; không có việc chạy theo lịch đóng phiếu, vì đóng phiếu không phải báo cho ai.  
* Gửi rồi thì không gỡ, không sửa, không xóa được (BR-327, BR-263).  
* Organizer và Instructor chỉ thấy **số đếm** (bao nhiêu phiếu đã mở, đã gửi), không bao giờ thấy từng dòng.

### **evaluation\_responses (GĐ2)** {#evaluation_responses-(gđ2)}

Nội dung phiếu đã gửi. Đây là bảng ngoại lệ của quy ước chung: khóa chính là uuid v4 ngẫu nhiên và **không có cột thời gian**. Nếu có thời điểm gửi, người xem báo cáo biết An hoàn thành lúc nào, ghép lại là biết phiếu nào của An.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| course\_id | uuid | Phiên bản Course | Để xem theo phiên bản, đối chiếu trong chuỗi (BR-265) |
| content\_usefulness | smallint | Mức độ hữu ích của nội dung | Số nguyên 1–5, bắt buộc (BR-332) |
| difficulty\_fit | smallint | Độ khó phù hợp | 1–5 (5 là rất phù hợp) |
| material\_quality | smallint | Chất lượng học liệu | 1–5 |
| comment | varchar(2000) | Nhận xét tự do, không bắt buộc | 2000: khoảng 300 từ, cùng giới hạn nhận xét chấm bài |

Ngoài các cột nêu trên, bảng còn có: id (uuid v4), organization\_id. Bảng cố ý không có created\_at, updated\_at.

Luật dữ liệu:

* Không có cột Learner, Enrollment hay liên kết tới phiếu: đây chính là ẩn danh (BR-261).  
* Không sửa, không xóa được (trigger).  
* Kết quả của một phiên bản chỉ hiển thị khi có **từ 5 phiếu** trở lên; dưới 5 chỉ hiện tỉ lệ đã gửi (BR-328). Nhận xét luôn sắp theo id ngẫu nhiên, không theo thứ tự gửi.

Gửi phiếu là một transaction gồm hai bước. Bước một ghi thời điểm gửi vào phiếu của Learner, chỉ thành công nếu phiếu đúng của Learner đó, chưa gửi và còn hạn. Bước hai thêm một dòng nội dung phiếu. Nhờ vậy mỗi phiếu chỉ gửi một lần, và số dòng nội dung luôn bằng số phiếu đã gửi, dù hai bảng không nối với nhau.

### **report\_exports (GĐ2)** {#report_exports-(gđ2)}

Mỗi dòng là một yêu cầu kết xuất báo cáo ra Excel hoặc PDF. Kết xuất chạy nền vì phải gọi nhiều service, có thể lâu hơn thời gian chờ của một request.

| Cột | Kiểu | Lưu gì | Giới hạn và lý do |
| ----- | ----- | ----- | ----- |
| requested\_by, requester\_role | uuid, text | Người yêu cầu; Organizer hoặc Instructor | Chỉ người yêu cầu tải được tệp |
| report\_type | text | Overview, Course, Learner, Version, InstructorCourse, Evaluation | Instructor chỉ được hai loại của mình (BR-222) |
| file\_format | text | Excel hoặc Pdf | BR-231 |
| filters | jsonb | Bộ lọc đã chọn | Khoảng thời gian ≤ 366 ngày, ≤ 100 Course (cần xác nhận khi thử thực tế) |
| status | text | Pending, Running, Succeeded, Failed | — |
| attempts | integer | Số lần chạy | Tối đa 3 rồi Failed |
| started\_at, finished\_at | timestamptz | Bắt đầu, kết thúc | Running quá 15 phút coi như bị bỏ rơi, cho chạy lại |
| file\_key, file\_size\_bytes | text, bigint | Tệp trong MinIO | Không tính vào dung lượng gói (BR-288) |
| error\_message | text | Lỗi | Chỉ khi Failed |
| expires\_at | timestamptz | Hạn xóa tệp | Xong \+ 7 ngày (BR-330): tệp chứa dữ liệu cá nhân, không để lâu |

Ngoài các cột nêu trên, bảng còn có: id, organization\_id, created\_at, updated\_at.

Mỗi người tối đa 3 yêu cầu đang chờ cùng lúc, chống bấm liên tục làm quá tải các service khác. Khi tạo yêu cầu và khi tải, hệ thống hỏi tenant trạng thái Subscription: Organizer vẫn kết xuất được trong 30 ngày sau khi bị ngưng, Instructor thì không (BR-17, BR-232).

## **5.4 Báo cáo lấy dữ liệu ở đâu** {#5.4-báo-cáo-lấy-dữ-liệu-ở-đâu}

| Báo cáo | Nguồn |
| ----- | ----- |
| Tổng quan (UC35) | Số Learner (tenant); số Course đang triển khai (course); tỉ lệ hoàn thành, quá hạn, tách Required và Optional (learning); số Certificate (bảng certificates) |
| Theo Course (UC35.1) | learning đếm sẵn 7 con số theo từng Course |
| Theo Learner (UC35.2) | Danh sách Enrollment (learning), kết quả Quiz và Assignment (assessment), Certificate (bảng certificates) |
| Theo phiên bản (UC35.3) | Số Certificate mỗi phiên bản (bảng certificates); phiên bản hiện hành (course) |
| Phụ trách của Instructor (UC36) | Chuỗi Instructor đang phụ trách (course) rồi như báo cáo Learner |

Tỉ lệ hoàn thành \= số Completed ÷ số Enrollment không ở Đã rút, Miễn, Tạm dừng (BR-333). Bộ lọc khoảng thời gian xét Enrollment theo ngày phân công (Required) hoặc ngày đăng ký (Optional), Certificate theo ngày cấp (BR-329).

## **5.5 Ví dụ dữ liệu** {#5.5-ví-dụ-dữ-liệu}

**15/10 16:00:00: nhận EnrollmentCompleted của An.** Một transaction:

| Bảng | Dữ liệu |
| ----- | ----- |
| certificates | enrollment\_id \= E-AN, learner\_id \= U-AN, course\_id \= C-ATLD-2, certificate\_code \= 7K3M9QX2ABCD, status \= Pending, issued\_at \= 15/10 16:00, completed\_late \= false, score\_snapshot \= \[Quiz 85, đạt; Assignment 80, đạt\], 4 cột ảnh chụp trống, next\_attempt\_at \= ngay bây giờ |
| evaluation\_forms | enrollment\_id \= E-AN, opened\_at \= 15/10 16:00, due\_at \= 29/10 16:00, submitted\_at trống |

**15/10 16:00:01:** hỏi tenant và course thành công. certificates chuyển Issued, learner\_name \= "Nguyễn Văn An", course\_name \= "An toàn lao động", version\_number \= 2, chain\_id \= CH-ATLD. An thấy Certificate mã 7K3M-9QX2-ABCD, ngày cấp 15/10/2026.

Nếu lúc đó tenant đang bảo trì, dòng vẫn ở Pending, issue\_attempts \= 1, next\_attempt\_at \= 16:00:30; lần thử sau thành công thì ngày cấp vẫn là 15/10 16:00.

**Năm 2027 An đổi tên trong tenant.** Certificate cũ vẫn ghi "Nguyễn Văn An", vì là ảnh chụp.

**16/10: An gửi phiếu** (4, 4, 5, "Video dễ hiểu"). evaluation\_forms của An có submitted\_at; evaluation\_responses thêm một dòng course\_id \= C-ATLD-2, ba điểm và nhận xét, không có gì chỉ về An. Chị Lan xem kết quả phiên bản 2: mới có 1 phiếu, dưới ngưỡng 5, nên chỉ thấy "1/1 Learner đã gửi phiếu".

**31/10: Lan kết xuất báo cáo Course ra Excel.** report\_exports: Pending → Running → Succeeded, file\_size\_bytes \= 18.432, expires\_at \= 07/11. Sau 07/11 tệp bị xóa khỏi MinIO; Lan cần thì kết xuất lại.

## **5.6 Trao đổi với service khác** {#5.6-trao-đổi-với-service-khác}

| Dữ liệu | Cách | Khi nào |
| ----- | ----- | ----- |
| Lượt hoàn thành kèm bản chốt điểm | Event EnrollmentCompleted từ learning | Khi xảy ra |
| Họ tên Learner; tên Course, số hiệu, chuỗi | Hỏi tenant, course, **chụp lại** | Lúc cấp Certificate |
| Số liệu Enrollment, kết quả Assessment, họ tên hiện tại, đơn vị, trạng thái truy cập, phiên bản hiện hành | Hỏi, **không chép** | Mỗi lần xem hoặc kết xuất báo cáo |

achievement-reporting-service cung cấp: số Certificate theo phiên bản (course); danh sách Learner có Certificate để nhắc tải khi Subscription vào ân hạn (tenant).

## **5.7 Không có ở đây** {#5.7-không-có-ở-đây}

Bảng số liệu báo cáo (hỏi thẳng nguồn mỗi lần xem). Tệp PDF Certificate lưu sẵn. Bảng outbox (không phát event). Trang tra cứu Certificate công khai cho người ngoài (MVP chưa làm; Organizer xác minh bằng bộ lọc mã Certificate). Đường sửa họ tên sai chính tả trên Certificate đã cấp (còn là câu hỏi mở của nhóm).