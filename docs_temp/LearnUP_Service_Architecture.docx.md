# **LEARNUP – SERVICE ARCHITECTURE**

# **1\. Tổng quan kiến trúc**

**5 Business Services:**

* Organization & Commercial Service  
* Course Service  
* Learning Service  
* Assessment Service  
* Achievement & Reporting Service

**3 Supporting / Platform Services:**

* Identity Service  
* Notification Service  
* Audit Service

API Gateway, Eureka Server, Kafka, PostgreSQL và React Frontend là infrastructure/platform components, không được tính vào con số 8 application services.

## **1.1 Tên trong tài liệu và tên trong code**

Tên trong tài liệu viết cho người đọc. Tên trong code dùng chữ thường nối bằng gạch ngang, và dùng thống nhất cho thư mục, container, database, tên đăng ký service và tiền tố log.

| Tên trong tài liệu | Tên trong code | Database |
| ----- | ----- | ----- |
| Organization & Commercial Service | tenant-service | tenant\_db |
| Identity Service | identity-service | identity\_db |
| Course Service | course-service | course\_db |
| Learning Service | learning-service | learning\_db |
| Assessment Service | assessment-service | assessment\_db |
| Achievement & Reporting Service | achievement-reporting-service | achievement\_reporting\_db |
| Notification Service | notification-service | notification\_db |
| Audit Service | audit-service | audit\_db |

# **2\. Nguyên tắc phân chia service**

Một domain chỉ có một owner chính. Service sở hữu source of truth và chịu trách nhiệm thay đổi dữ liệu của domain đó.

Không truy cập trực tiếp database của service khác. Các service giao tiếp qua API hoặc event phù hợp; không cross-database query và không foreign key giữa các database.

Phân biệt các thuật ngữ dễ trùng. Course assignment cho Learner là Enrollment; Assignment là bài tập thuộc Assessment.

Service ra quyết định không tự sửa database của service khác. Nó gọi API hoặc phát event để service đang sở hữu source of truth tự thực thi thay đổi.

Định danh người dùng dùng chung một giá trị. Toàn hệ thống dùng user\_id do Organization & Commercial sinh ra; JWT sub mang chính giá trị này, và mọi service lưu user\_id trong dữ liệu của mình. Không có định danh thứ hai cho cùng một người.

Đường dẫn API đặt theo tài nguyên, không theo tên service. Ví dụ /api/organizations/**, /api/subscriptions/**, /api/auth/\*\*. Nhờ vậy đổi tên hoặc gộp tách service về sau không buộc frontend phải sửa.

## **2.1 Chọn REST hay Kafka**

Không có quy tắc cứng cho toàn hệ thống. Chọn theo từng trường hợp, dựa trên ba tiêu chí:

* Người dùng đang chờ để biết thao tác thành công hay thất bại, hoặc bên gọi cần giá trị trả về để quyết định bước tiếp theo — dùng REST đồng bộ.  
* Tác động lan ra nhiều bản ghi, không ai đứng chờ, và độ trễ vài giây không ảnh hưởng nghiệp vụ — dùng Kafka.  
* Việc chỉ mang tính báo cho biết, mất một thông điệp không làm sai nghiệp vụ, như email và thông báo — dùng Kafka.

Điều kiện bắt buộc khi dùng Kafka cho thay đổi trạng thái:

* Publish phải nằm trong cùng transaction với việc ghi database, theo cơ chế outbox. Nếu service ghi database xong rồi sập trước khi publish thì event mất mà không có lỗi nào hiện ra ở đâu.  
* Bên nhận phải xử lý được thông điệp trùng lặp, vì Kafka giao ít nhất một lần. Riêng BR-124 — dời hạn hoàn thành thêm đúng khoảng thời gian Enrollment ở Exempted hoặc Halted — phải tính theo mốc thời gian đã lưu, không cộng dồn mỗi lần nhận.  
* Event mang theo organizationId để bên nhận lọc đúng phạm vi, và mang thời điểm phát sinh để tính các quy tắc phụ thuộc thời gian.

## **2.2 Chống lạm dụng các endpoint công khai**

Hai endpoint không cần đăng nhập là đăng ký Organization (UC02) và gửi lại liên kết (UC03.1) dễ bị lạm dụng nhất. Thiệt hại chính không nằm ở dung lượng database mà ở thư gửi đi hàng loạt, làm giảm uy tín máy chủ thư và kéo cả thư mời thật vào hộp thư rác, cùng với chi phí băm mật khẩu. Hai lớp chặn:

* Organization & Commercial: một email chỉ có một đăng ký chờ thanh toán còn hiệu lực; đăng ký lại bằng email đó thì gửi lại liên kết nếu đăng ký cũ đã xác thực, hoặc thay đăng ký cũ nếu chưa xác thực. Mọi thư đăng ký, kể cả thư gửi lại, tính vào giới hạn theo email trong 24 giờ gần nhất (BR-276, BR-32). Mã xác thực bị giới hạn số lần nhập sai để chặn dò mã (BR-337).  
* API Gateway: giới hạn số request theo địa chỉ IP cho hai endpoint trên. Ngưỡng cụ thể là cấu hình của Gateway, không phải tham số nghiệp vụ, để điều chỉnh khi vận hành mà không phải sửa mã nguồn.

CAPTCHA trên form đăng ký chưa làm trong MVP vì cần tích hợp dịch vụ bên ngoài; hai lớp trên đủ cho phạm vi đồ án. Bản ghi của các đăng ký đã hủy được giữ lại, không có lịch xóa, vì dung lượng không đáng kể và việc xóa kéo theo đồng bộ tham chiếu ở Identity Service.

## **2.3 Outbox và liên kết chứa mã bí mật**

Mọi thông điệp một service gửi lên Kafka, kể cả yêu cầu gửi email và bản ghi nhật ký, đều đi qua bảng outbox của service đó. Tiến trình relay hỏi bảng outbox theo chu kỳ khoảng một giây, gửi các dòng chưa gửi theo thứ tự thời gian rồi đánh dấu đã gửi; nếu chạy nhiều bản relay thì dùng SELECT … FOR UPDATE SKIP LOCKED. Không dùng công cụ đọc log thay đổi như Debezium, vì cần vận hành thêm cụm Kafka Connect. Các dòng đã gửi được xóa sau 7 ngày.

Database chỉ lưu mã băm của liên kết mời, liên kết mở lại đăng ký và mã xác thực email, nhưng email phải chứa giá trị gốc, nên giá trị gốc đi qua outbox và Kafka. Ba biện pháp để giá trị gốc không bị lưu lâu:

* Relay xóa trường chứa liên kết và mã xác thực khỏi nội dung thông điệp trong bảng outbox ngay sau khi gửi thành công.  
* Topic Kafka dành cho yêu cầu gửi email đặt thời gian giữ thông điệp 24 giờ.  
* Notification Service không lưu liên kết gốc và mã xác thực vào lịch sử gửi thư; chỉ lưu tên mẫu thư và các tham số còn lại.

# **3.1 Organization & Commercial Service**

Service này quản lý tenant/organization, tài khoản người dùng và commercial lifecycle.

**Sở hữu:**

* Organization profile và timezone.  
* Bản ghi tài khoản người dùng: email đăng nhập, họ tên, ảnh đại diện, vai trò, đơn vị công tác, trạng thái tài khoản.  
* Mã mời và mã xác thực email.  
* Membership của Organizer, Instructor và Learner.  
* Subscription Plan, Subscription và Payment.  
* Bulk member import (import nhiều thành viên cùng lúc).  
* Các trạng thái và giai đoạn trong vòng đời Subscription.  
* Platform parameters/configuration ở góc độ quản lý cấu hình.

**Không sở hữu:**

* Credential/password.  
* Course và Course structure.  
* Enrollment/progress.  
* Quiz/Assignment/Grade.  
* Certificate.

**Ràng buộc định danh:**

Email là định danh đăng nhập duy nhất trên toàn nền tảng, chỉ xét các tài khoản chưa bị xóa, và tài khoản đó thuộc đúng một Organization (BR-30, BR-31). Ràng buộc này được ép ở tầng database bằng một chỉ mục duy nhất có điều kiện trên cột email.

Tên tổ chức và mã số thuế không có ràng buộc duy nhất ở tầng database, vì hệ thống không xác minh mã số thuế có thuộc về người đăng ký hay không; mã số thuế trùng chỉ được cảnh báo cho Admin (BR-280).

**Múi giờ:**

Learning Service và Assessment Service xác định mốc kết thúc theo múi giờ hiện hành của Organization tại thời điểm tạo mốc, rồi lưu thành thời điểm tuyệt đối. Đổi múi giờ chỉ áp dụng cho các mốc tạo sau đó (BR-44), nên Organization & Commercial không phát event khi múi giờ thay đổi. Việc dời hạn theo BR-47 và BR-124 cộng thêm một khoảng thời gian nên không cần tới múi giờ.

**Tham số nền tảng:**

Course, Learning, Assessment và Achievement & Reporting đọc tham số nền tảng thường xuyên, nên mỗi service giữ một bản sao cục bộ. Khi Admin lưu tham số, Organization & Commercial phát event PlatformSettingsChanged mang toàn bộ giá trị mới; lúc khởi động, service gọi REST một lần để lấy bản đầu tiên. Theo BR-269, service dùng tham số chép giá trị vào bản ghi của mình tại lúc tạo, không đọc lại tham số khi tính sau đó.

**Vì sao bản ghi tài khoản nằm ở service này:**

* BR-23 — tạo tài khoản Instructor hoặc Learner phải kiểm số chỗ còn lại theo Subscription.  
* BR-25 — import vượt số chỗ thì chặn toàn bộ lần import, không import một phần. Đây là đòi hỏi hoặc xong hết hoặc không làm gì, nên tài khoản, membership và số chỗ phải nằm trong cùng một transaction.  
* BR-26 — một dòng import bị đánh dấu lỗi khi email trùng với một tài khoản chưa bị xóa trên nền tảng, kể cả tài khoản thuộc Organization khác.

# **3.2 Identity Service**

Identity Service là supporting/platform service, tách khỏi 5 business services. Nó giữ cách chứng minh danh tính; Organization & Commercial giữ người đó là ai trong tổ chức.

**Sở hữu:**

* Credential: mật khẩu đã băm và vòng đời mật khẩu.  
* Refresh token.  
* JWT issuing.  
* Google Login: liên kết tài khoản Google với user\_id.  
* Mã khôi phục mật khẩu.

**Không sở hữu:**

* Bản ghi tài khoản, email đăng nhập, họ tên, vai trò, trạng thái tài khoản.  
* Membership business rules.  
* Course, Enrollment, Assessment, Certificate.

**Định danh:**

Bảng credential lấy user\_id do Organization & Commercial sinh ra làm khóa chính. Không có identity\_id riêng. Hai service tham chiếu nhau bằng chính user\_id, không dùng cross-database foreign key.

**Thời điểm tạo credential:**

Theo BR-21, tài khoản Instructor và Learner do Organizer tạo, người dùng nhận email mời rồi tự đặt mật khẩu. Nên ở bước import hàng loạt, Identity Service không nhận bản ghi nào; credential chỉ được tạo khi từng người bấm liên kết mời và đặt mật khẩu.

**Đăng nhập (UC05, BR-27):**

Identity Service nhận email và mật khẩu, gọi Organization & Commercial một lần để lấy user\_id cùng trạng thái tài khoản, trạng thái Subscription và trạng thái Organization, rồi mới kiểm mật khẩu và cấp JWT. Đây là cuộc gọi chỉ đọc, và BR-27 đòi kiểm cả ba trạng thái nên cuộc gọi này là bắt buộc.

# **3.3 Course Service**

Course Service sở hữu cấu trúc, lifecycle, policy chỉnh sửa và việc kiểm duyệt nội dung của Course.

**Sở hữu:**

* Course.  
* Course Version.  
* Module, Lesson, Material.  
* Course approval/submission.  
* Course lifecycle.  
* Public/Private visibility.  
* Course Lock.  
* Instructor ownership/transfer.  
* Versioning.  
* Kiểm duyệt nội dung: report vi phạm, quyết định xử lý, lịch sử vi phạm của Instructor, và cờ vô hiệu hóa của từng thành phần nội dung.

**Ba khái niệm phải tách biệt:**

* status \= lifecycle của Course.  
* courseType \= PUBLIC/PRIVATE, quyết định visibility/discoverability.  
* locked \= policy giới hạn chỉnh sửa cấu trúc sau khi có Enrollment.

CourseType không quyết định Required/Optional. Public course và Private course đều có thể được gán Required hoặc Optional thông qua Enrollment.

Gắn Locked: khi tạo Enrollment, Learning Service gọi REST sang Course Service. Course Service kiểm Course còn nhận Enrollment (Published) và gắn Locked trong cùng lời gọi, dưới khóa dòng Course mà các thao tác sửa cấu trúc cũng dùng. Không dùng Kafka cho việc này, vì độ trễ của event tạo ra một khoảng hở trong đó đã có Enrollment mà cấu trúc vẫn sửa được, trái BR-81. Locked không có đường gỡ (BR-83).

Phụ trách và giới hạn: quyền phụ trách gắn với cả chuỗi phiên bản (BR-287). Course Service là nơi đếm số chuỗi phiên bản (BR-1) và dung lượng lưu trữ đã dùng (BR-288); con số giới hạn và trạng thái Subscription được hỏi Organization & Commercial qua REST lúc kiểm, không chép.

**Vì sao kiểm duyệt đặt ở service này:**

* BR-239 — thứ bị vô hiệu hóa là Lesson, học liệu, nội dung Quiz hoặc đề bài Assignment. Cờ vô hiệu hóa nằm trên chính nội dung mà service này giữ.  
* BR-245 — muốn biết Course có còn thành phần bắt buộc nào hoạt động hay không thì phải có cùng lúc cấu trúc chương trình, cờ bắt buộc của từng học liệu và danh sách thành phần đang bị vô hiệu hóa. Đặt ở đây thì phần học liệu được tính và ghi trong cùng một transaction; phần Quiz bắt buộc và Assignment hỏi Assessment Service (xem 6.3).  
* BR-248 và BR-249 — hậu quả kéo theo là Course chuyển Disabled rồi Enrollment chuyển Halted, và chuỗi đó bắt đầu từ chính Course.

Cờ vô hiệu hóa của Quiz và Assignment nằm ở Assessment Service, nên Course Service gọi sang Assessment để đặt cờ đó.

# **3.4 Learning Service**

Learning Service là owner của quan hệ Learner–Course và trạng thái học.

**Sở hữu:**

* Enrollment.  
* Required/Optional.  
* Course assignment cho Learner.  
* Deadline và Overdue.  
* Progress.  
* Completion.  
* Bảy trạng thái Enrollment theo BR-115: NotStarted, InProgress, Completed, Overdue, Exempted, Withdrawn, Halted.  
* Nguồn gốc và mốc thời gian của Exempted và Halted.

Assignment exercise lại thuộc Assessment Service.

**Vì sao phải lưu nguồn gốc và mốc thời gian:**

* BR-123 — Organizer gỡ được trạng thái Exempted do Organizer đặt.  
* BR-125 — trạng thái Halted do hệ thống đặt khi Course bị vô hiệu hóa thì không gỡ theo cách đó.  
* BR-124 — hạn hoàn thành được dời thêm đúng khoảng thời gian Enrollment ở trạng thái Exempted hoặc Halted.

**Xét điều kiện cấp Certificate:**

Learning Service là nơi biết Enrollment chuyển sang Completed. Nó xét lại điều kiện tại BR-211 và BR-212 mỗi khi một học liệu hoàn thành, mỗi khi nhận event từ Assessment Service báo tình trạng Quiz hoặc Assignment của một Learner đã thay đổi, và mỗi khi một thành phần bị vô hiệu hóa (BR-310). Khi học liệu bắt buộc đã đủ, nó hỏi Assessment Service qua REST điểm Quiz, điểm Assignment và tình trạng nghĩa vụ chấm chéo; kết quả của lời gọi này vừa là căn cứ quyết định, vừa là bản chốt điểm theo BR-219. Learning Service không sở hữu Certificate.

**Hạn hoàn thành và Overdue:**

Learning Service lưu hạn gốc tính theo múi giờ Organization lúc phân công (BR-300), phần Organizer đã kéo dài và các khoảng Enrollment ở Exempted, Halted hoặc Organization bị tạm khóa. Hạn hiện hành luôn được tính lại từ các thành phần đã lưu, không cộng dồn mỗi lần nhận event, nên nhận event trùng hoặc sai thứ tự không làm sai hạn (BR-124, BR-47). Overdue không được lưu mà tính lúc đọc: Enrollment Required ở NotStarted hoặc InProgress đã qua hạn thì hiển thị là Overdue.

# **3.5 Assessment Service**

Assessment Service sở hữu toàn bộ nghiệp vụ đánh giá kết quả học tập.

**Sở hữu:**

* Quiz.  
* Question.  
* Attempt.  
* Assignment exercise và Rubric.  
* Submission.  
* Grade.  
* n/m consecutive attempt/submission lock.  
* Peer Review, gồm chu kỳ chấm chéo với ba mốc thời gian, tập người đánh giá và hoán vị phân công theo BR-186, BR-202 và BR-203.  
* Instructor finalization.  
* Cờ vô hiệu hóa của Quiz và Assignment, đặt theo lệnh từ Course Service.

Không sở hữu Course structure, Enrollment, Learning Progress hoặc Certificate.

**Ranh giới quan trọng:**

* Course assignment → Learning → Enrollment.  
* Assignment bài tập → Assessment → Submission/Grade.

**Dữ liệu lấy từ service khác:**

* Enrollment còn cho làm bài: hỏi Learning Service qua REST khi bắt đầu lượt làm Quiz và khi nộp bài. Event EnrollmentCompleted được giữ thành bản sao để chuyển Quiz và Assignment sang chỉ đọc (BR-169, BR-325).  
* Trạng thái Course, thời điểm Locked và Instructor đang phụ trách: hỏi Course Service qua REST mỗi lần Instructor thao tác, không chép, vì chuyển quyền phụ trách phải có hiệu lực ngay (BR-78, BR-285, BR-318).  
* Tài khoản bị vô hiệu hóa hoặc bị xóa: giữ bản sao thưa từ event của Organization & Commercial, để việc chốt chu kỳ chấm chéo không phụ thuộc service khác đang chạy (BR-39, BR-199).  
* Múi giờ Organization: hỏi REST lúc tạo chu kỳ chấm chéo, lưu ba mốc thành thời điểm tuyệt đối (BR-44, BR-312).

# **3.6 Achievement & Reporting Service**

Service này quản lý kết quả đạt được, chứng nhận, training evaluation và reporting.

**Sở hữu:**

* Certificate.  
* Training Evaluation.  
* Reports và export.

**Không sở hữu:**

* Source of truth của Course, Learning và Assessment.  
* Kiểm duyệt nội dung và hồ sơ vi phạm — thuộc Course Service.

Certificate tham chiếu Course Version và Learner bằng logical IDs; không tạo cross-database foreign key.

Certificate là bản ghi bất biến, được chốt tại thời điểm cấp theo BR-219 và BR-220. Service này nhận thông tin hoàn thành cùng bản chốt điểm từ Learning Service và lưu lại; nó không tự tính điều kiện cấp.

Reporting không trở thành source of truth cho Course, Enrollment, Progress hoặc Grade. Khi cần dữ liệu báo cáo, service này đọc hoặc orchestrate từ các source owner.

Báo cáo không giữ bản sao dữ liệu của service khác. Mỗi lần xem hoặc kết xuất, service này gọi REST theo lô: số liệu tổng hợp và danh sách Enrollment (có Overdue) hỏi Learning Service, kết quả Assessment hỏi Assessment Service, họ tên, đơn vị công tác và trạng thái truy cập hỏi Organization & Commercial, phiên bản hiện hành và phạm vi Instructor hỏi Course Service. Lý do: Learning Service không phát event cho phần lớn thay đổi trạng thái và tiến độ, còn Overdue chỉ được tính lúc đọc; giữ bản sao sẽ phải chép lại cả công thức tính hạn và là nguồn lệch số liệu tuân thủ lớn nhất. Đổi lại, báo cáo phụ thuộc các service kia đang chạy.

Phiếu đánh giá hiệu quả đào tạo tách thành hai phần không nối với nhau: phần ghi nhận Learner nào được mời và đã gửi chưa, và phần nội dung phiếu không mang danh tính, không mang thời điểm gửi (BR-261, BR-327). Kết quả chỉ hiển thị khi một phiên bản có từ 5 phiếu đã gửi trở lên (BR-328).

Service này không phát event nào lên Kafka nên không có bảng outbox; nó chỉ nhận EnrollmentCompleted từ Learning Service và PlatformSettingsChanged từ Organization & Commercial.

# **3.7 Notification Service**

Notification Service là supporting service riêng để xử lý việc gửi thông báo.

**Sở hữu:**

* Notification.  
* Notification template.  
* Delivery.  
* Email.  
* In-app notification, gồm nội dung thông báo và trạng thái đã đọc của từng người nhận theo UC49.

Business service không tự sở hữu cơ chế gửi email. Chúng phát sinh thông tin cần thông báo; Notification Service chịu trách nhiệm delivery.

**Ví dụ:**

* Learning Service → learner được assign course → Notification Service → gửi email.  
* Assessment Service → peer-review deadline reminder → Notification Service.

# **3.8 Audit Service**

Audit Service là supporting/cross-cutting service, sở hữu lịch sử hành động cần audit.

**Sở hữu:**

* Audit Log.  
* Actor.  
* Action.  
* Target.  
* Timestamp.  
* Organization context.  
* Correlation/request information khi cần.

Ví dụ: course approval, member import, password change, governance decision.

Audit Log là durable record, khác với notification tạm thời. Cơ chế kỹ thuật cụ thể để bảo đảm durability cần được chốt ở bước architecture/implementation; không nên coi audit là best-effort message.

# **4\. Bảng ownership tổng hợp**

| Service | Sở hữu chính | Không sở hữu |
| ----- | ----- | ----- |
| Organization & Commercial | Organization, bản ghi tài khoản, email đăng nhập, mã mời, mã xác thực email, Membership, Plan, Subscription, Payment, quota, platform parameters | Credential, Course, Enrollment, Assessment, Certificate |
| Identity | Credential, Password, JWT, Refresh Token, Google Login, mã khôi phục mật khẩu | Bản ghi tài khoản, Membership business, Course, Enrollment, Assessment |
| Course | Course, Version, Module, Lesson, Material, Approval, Lifecycle, Visibility, Lock, kiểm duyệt nội dung | Enrollment, Progress, Grade |
| Learning | Enrollment, Required/Optional, Deadline, Progress, Completion, bảy trạng thái Enrollment | Assessment Assignment, Question, Grade, Certificate |
| Assessment | Quiz, Assignment, Question, Attempt, Submission, Grade, Peer Review và chu kỳ chấm chéo | Course, Enrollment, Certificate |
| Achievement & Reporting | Certificate, Training Evaluation, Reports | Source of truth của Course/Learning/Assessment, kiểm duyệt nội dung |
| Notification | Notification, Template, Delivery, Email/In-app notification | Business state |
| Audit | Audit Log, Action History | Business state |

# **5\. File Storage và Storage Quota**

Chính sách tính dung lượng đã chốt tại BR-288: chỉ tệp học liệu và ảnh bìa Course tính vào giới hạn dung lượng của Subscription; tệp dùng chung giữa các Course Version tính một lần; tệp bài nộp của Learner, ảnh đại diện, logo Organization, tệp Certificate và tệp báo cáo kết xuất không tính.

* Organization & Commercial: giữ con số giới hạn dung lượng của Subscription. Khi cần hiển thị mức sử dụng hoặc cảnh báo theo BR-19, hỏi Course Service qua REST.  
* Course: giữ file references của Course Materials và ảnh bìa Course, và là nơi duy nhất đếm dung lượng đã dùng.  
* Assessment: giữ file references của Submission.  
* Achievement & Reporting: giữ file references của tệp báo cáo kết xuất; tệp được lưu 7 ngày rồi xóa (BR-330). Bản PDF của Certificate không lưu sẵn mà được kết xuất từ bản ghi đã chốt mỗi lần Learner tải (BR-216, BR-220).  
* Physical object/file storage: xem như infrastructure component cho tới khi có yêu cầu domain đủ lớn để tách thành service. Công cụ đã chốt là MinIO (giao tiếp tương thích Amazon S3, chạy trong docker compose). Trình duyệt tải tệp thẳng vào MinIO bằng đường dẫn ký sẵn do service sở hữu tệp cấp; service chỉ cấp phép, giữ chỗ dung lượng và kiểm tra tệp sau khi tải xong. Ảnh bìa Course nhận JPEG, PNG hoặc WebP, tối đa 5 MB; đây là cấu hình của Course Service, không phải tham số nghiệp vụ.

Giải phóng dung lượng theo BR-74 và BR-75: chỉ xóa tệp mà không phiên bản nào còn tham chiếu tới. Thay tệp lỗi kỹ thuật theo BR-87 và BR-104 sửa chính tệp dùng chung.

# **6\. Luồng tương tác mẫu**

## **6.1 Giao Course cho Learner**

Organizer thao tác qua Gateway → Learning Service tạo hoặc cập nhật Enrollment. Course Service không tạo Assignment cho Learner. Required/Optional và deadline nằm trên Enrollment.

## **6.2 Learner làm Assignment**

Learner có Enrollment hợp lệ → Assessment Service xử lý Assignment → Submission → Peer Review hoặc Instructor grading → Grade. Learning Service vẫn là owner của progress và completion, không sở hữu Assignment exercise.

## **6.3 Kiểm duyệt và vô hiệu hóa nội dung**

Course Service ghi nhận report và quyết định xử lý trong database của mình. Khi quyết định là vô hiệu hóa một thành phần nội dung, Course Service đặt cờ vô hiệu hóa: nếu thành phần là Lesson hoặc học liệu thì ghi ngay trong database của mình; nếu là Quiz hoặc Assignment thì gọi REST sang Assessment Service, vì đây là một bản ghi và Organizer đang chờ biết kết quả.

Sau mỗi lần vô hiệu hóa, Course Service kiểm BR-245. Thành phần bắt buộc theo BR-211 gồm học liệu bắt buộc, Quiz bắt buộc và mọi Assignment: phần học liệu Course Service tự tính từ cấu trúc chương trình và cờ bắt buộc của chính nó; phần Quiz và Assignment hỏi Assessment Service qua REST số Quiz bắt buộc và Assignment còn hoạt động của Course. Nếu Course không còn thành phần bắt buộc nào hoạt động thì Course chuyển sang Disabled trong cùng transaction ghi của Course Service. Hai service không nằm chung một transaction; khả năng Assessment đổi trạng thái đúng trong khoảng giữa lời hỏi và lúc ghi là không đáng kể vì vô hiệu hóa là thao tác hiếm.

Course Service phát event CourseDisabled lên Kafka. Learning Service nhận và chuyển toàn bộ Enrollment đang dở — NotStarted, InProgress và Overdue theo BR-302 — sang Halted theo BR-249. Chọn Kafka vì số Enrollment bị ảnh hưởng có thể rất lớn, không ai đứng chờ kết quả, và quyền truy cập của Learner đã bị chặn ngay ở mức Course theo BR-248 nên độ trễ vài giây không tạo lỗ hổng. Organizer khôi phục hoặc đóng từng Enrollment ở Halted qua UC24.8 (BR-250, BR-303).

Việc loại thành phần bị vô hiệu hóa khỏi điều kiện cấp Certificate theo BR-243 cũng đi qua event, vì nó là việc tính lại trên nhiều Enrollment.

Kích hoạt lại đi theo đường ngược lại: Lesson và học liệu ghi ngay trong database của Course Service, Quiz và Assignment gọi REST sang Assessment Service, rồi Course Service phát event ContentReactivated để Learning Service đưa thành phần trở lại điều kiện cấp Certificate cho các Enrollment chưa hoàn thành (BR-244). Khi Admin xác định không vi phạm trên một report mà Organizer đã xác nhận, việc kích hoạt lại này chạy ngay trong thao tác ra quyết định của Admin; Course đã Disabled không tự kích hoạt lại mà do Admin xét theo BR-242 (BR-294).

## **6.4 Cấp Certificate**

Learning Service phát hiện Enrollment đủ điều kiện chuyển Completed → hỏi Assessment Service qua REST điểm Quiz, điểm Assignment và tình trạng nghĩa vụ chấm chéo → xét điều kiện theo BR-211 và BR-212 → chuyển Enrollment sang Completed và ghi event EnrollmentCompleted kèm bản chốt điểm theo BR-219 vào outbox trong cùng transaction → Achievement & Reporting nhận event và tạo Certificate, lưu như bản ghi bất biến theo BR-220; Assessment Service nhận cùng event để chuyển Quiz và Assignment sang chỉ đọc theo BR-169.

Chọn Kafka thay vì REST vì việc hoàn thành thường do một event kích hoạt nên không ai đứng chờ, và nếu lời gọi REST thất bại sau khi Enrollment đã chuyển Completed thì Certificate bị mất mà không có lỗi nào hiện ra. Achievement & Reporting chịu được event trùng vì mỗi Enrollment sinh tối đa một Certificate (BR-213).

Để Certificate không bao giờ mất khi lời gọi REST lấy họ tên Learner và tên Course thất bại, Achievement & Reporting ghi Certificate ở trạng thái chờ cấp ngay trong transaction nhận event, với đủ dữ liệu từ event (bản chốt điểm, thời điểm hoàn thành, dấu hiệu hoàn thành sau hạn, mã định danh), rồi mới xác nhận đã nhận với Kafka. Sau đó mới gọi REST sang Organization & Commercial và Course Service để chụp họ tên, tên Course và số hiệu phiên bản; lỗi thì một việc chạy theo lịch thử lại với khoảng cách giãn dần và không bao giờ bỏ cuộc. Ngày cấp là thời điểm hoàn thành, không phải lúc chụp xong (BR-326). Event có payload sai định dạng làm dừng việc nhận và báo động, không bị bỏ qua. Learning Service không lưu bản chốt điểm và xóa dòng outbox sau 7 ngày, nên message trên Kafka là bản gốc duy nhất; topic EnrollmentCompleted giữ message 30 ngày. Bên nhận bị sót event khôi phục bằng cách đặt lại offset của consumer group về trước thời điểm sót rồi đọc lại; mọi bên nhận chịu trùng nên việc đọc lại luôn an toàn.

## **6.5 Gửi notification**

Business Service phát sinh thông tin cần thông báo → Notification Service xử lý template và delivery → email hoặc in-app notification.

## **6.6 Ghi audit**

Service thực hiện business action → Audit Service nhận thông tin audit → lưu Audit Log. Audit không trở thành owner của business state.

## **6.7 Đồng bộ cấu trúc Course với Assessment Service và Learning Service**

Quiz và Assignment thuộc Assessment Service nhưng gắn vào Module hoặc Course của Course Service (BR-154, BR-162). Ba luồng event giữ cho hai bên khớp nhau:

Tạo phiên bản mới (BR-100): Course Service chép Module, Lesson và học liệu sang phiên bản mới, rồi phát event CourseVersionCreated kèm bảng đối chiếu ID Module cũ sang ID Module mới. Assessment Service nhận và chép Quiz, Assignment sang phiên bản mới. Chọn Kafka vì Instructor không phải chờ bước chép này mới tiếp tục biên soạn được, và việc chép chạm tới nhiều bản ghi.

Xóa Module hoặc xóa Course (UC15.4, UC14.5): Course Service phát event ModuleDeleted hoặc CourseDeleted; Assessment Service xóa Quiz và Assignment đi kèm. Việc này an toàn vì chỉ Course chưa Locked mới xóa được, nên chưa có lượt làm bài hay bài nộp nào.

Thời lượng Assignment (BR-51, BR-172): Assessment Service phát event mang tổng thời lượng dự kiến của các Assignment theo từng phiên bản Course, dưới dạng giá trị tuyệt đối kèm thời điểm phát sinh. Course Service lưu lại để tính thời lượng ước tính, không phải hỏi Assessment Service mỗi lần hiển thị danh mục.

Chiều ngược lại dùng REST vì bên gọi cần câu trả lời ngay. Assessment Service hỏi Course Service Module có tồn tại và thuộc Course không khi tạo Quiz (BR-154), và Course có Locked không khi sửa Quiz hoặc Assignment (BR-92–BR-94, BR-185). Course Service hỏi Learning Service đã có Learner hoàn thành Lesson chưa khi sửa nội dung Lesson của Course đã Locked (BR-95), và mọi Enrollment trên một phiên bản đã Completed hoặc Withdrawn chưa khi giải phóng học liệu (BR-75).

Các câu hỏi Assessment Service gửi Course Service khi Instructor thao tác được gộp thành một lời gọi REST, trả về trạng thái Course, thời điểm Locked và Instructor đang phụ trách; trạng thái cần để chặn chỉnh sửa khi Course đang Submitted theo BR-285. Khi Instructor gửi Course đi phê duyệt, Course Service hỏi Assessment Service mọi Quiz của Course đã có câu hỏi chưa (BR-323). Event thời lượng Assignment tên là AssignmentMinutesChanged, mang tổng số phút tuyệt đối của mọi Assignment trong phiên bản, kể cả Assignment đang bị vô hiệu hóa, cho đồng nhất với cách Course Service tính học liệu.

# **7\. Việc chạy theo lịch**

Một số quy tắc nghiệp vụ yêu cầu hệ thống tự chạy vào một thời điểm, không có actor nào bấm nút. Không cần service riêng cho việc này; mỗi service tự chạy lịch thuộc phạm vi dữ liệu của mình.

| Service | Việc chạy theo lịch | Quy tắc |
| ----- | ----- | ----- |
| Organization & Commercial | Hủy đăng ký ở trạng thái Pending Payment khi quá thời hạn hiệu lực: đăng ký chuyển Expired, Organization đi kèm chuyển Cancelled, tài khoản Organizer chưa kích hoạt được coi là đã xóa để giải phóng email | BR-7 |
| Organization & Commercial | Chuyển Subscription hết hạn sang thời gian ân hạn rồi sang Suspended | BR-15, BR-16 |
| Organization & Commercial | Kết thúc quyền chỉ xem và kết xuất báo cáo của Organizer sau thời hạn quy định | BR-17 |
| Organization & Commercial | Thông báo cho Organizer tại các mốc nhắc trước khi Subscription hết hạn và khi Subscription chuyển sang thời gian ân hạn; nhắc Learner tải Certificate một lần khi Subscription chuyển sang thời gian ân hạn; việc nhắc tách khỏi việc chuyển trạng thái và thử lại cho tới khi lấy được danh sách Learner có Certificate từ Achievement & Reporting | BR-18 |
| Assessment | Chốt chu kỳ chấm chéo và phân công bài chấm, nhắc trước hạn đánh giá, kết thúc hạn đánh giá; chốt các lượt làm Quiz đã hết thời gian giới hạn mà không ai nộp. Chu kỳ không cần mở theo lịch: chu kỳ được tạo khi có bài nộp đầu tiên rơi vào (BR-312) | BR-161, BR-186, BR-188, BR-189, BR-194, BR-312 |
| Course | Chuyển report quá thời hạn xử lý lên Admin | BR-235, BR-254 |
| Course | Xóa tệp tải lên dở (trạng thái Pending) quá 24 giờ để trả lại dung lượng đã giữ chỗ | Việc kỹ thuật, không phải quy tắc nghiệp vụ |
| Achievement & Reporting | Thử lại việc cấp Certificate còn chờ chụp họ tên Learner và tên Course; chạy các yêu cầu kết xuất báo cáo; xóa tệp kết xuất quá thời hạn lưu | BR-213, BR-220, BR-231, BR-330 |

Learning Service không có việc chạy theo lịch. Trạng thái Overdue được tính lúc đọc từ hạn hoàn thành đã lưu (BR-136, BR-142), vì việc chuyển sang Overdue không chép tham số và không phát event; nhờ vậy việc kéo dài hạn theo BR-140 có hiệu lực ngay mà không cần tính lại.

Achievement & Reporting không đóng phiếu đánh giá theo lịch. Phiếu lưu hạn thực hiện tính lúc mở (BR-258, BR-269); phiếu còn mở hay đã đóng được xét khi có người chạm tới, vì việc đóng phiếu không phải báo cho ai.

# **8\. Phân bổ Use Case**

Bảng dưới đối chiếu 167 Use Case với 8 service. Không Use Case nào bị sót hoặc nằm ở hai service.

| Service | Nhóm Feature | Số UC | GĐ1 |
| ----- | ----- | ----- | ----- |
| Organization & Commercial | Đăng ký và kích hoạt dịch vụ; Quản lý Subscription; Quản lý thông tin Organization; Quản lý tài khoản người dùng; Quản trị nền tảng; UC03, UC03.1, UC04, UC09, UC09.1 | 45 | 27 |
| Identity | UC05, UC05.1, UC06, UC07, UC08 | 5 | 5 |
| Course | Quản lý Course; Quản lý cấu trúc chương trình học; Quản lý học liệu; Phê duyệt và phiên bản Course; Kiểm duyệt nội dung và chế tài; UC25, UC25.1, UC25.2 | 50 | 23 |
| Learning | Phân công đào tạo trừ UC25 đến UC25.2; Học tập và tiến độ | 19 | 11 |
| Assessment | Quản lý Assessment; Làm bài và đánh giá chéo; Chấm điểm và chốt kết quả | 29 | 23 |
| Achievement & Reporting | Chứng nhận hoàn thành; Báo cáo đào tạo; Đánh giá hiệu quả đào tạo | 16 | 3 |
| Notification | UC49 | 1 | 1 |
| Audit | UC50, UC51 | 2 | 2 |
| **Tổng** |  | **167** | **95** |

Cột GĐ1 là số Use Case thuộc giai đoạn 1 theo bảng Use Case. Nhóm Kiểm duyệt nội dung, nhóm Báo cáo đào tạo và nhóm Đánh giá hiệu quả đào tạo đều nằm hoàn toàn ở giai đoạn 2\.