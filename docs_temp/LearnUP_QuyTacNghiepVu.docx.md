# **TỔNG HỢP QUY TẮC NGHIỆP VỤ ĐÃ CHỐT**

Nền tảng quản lý đào tạo nội bộ doanh nghiệp (B2B SaaS)

# **1\. SUBSCRIPTION VÀ VÒNG ĐỜI DỊCH VỤ**

## **1.1. Gói dịch vụ**

| ID | Rule Definition |
| ----- | ----- |
| **BR-1** | Mỗi Subscription Plan gồm giá, thời hạn sử dụng và bốn nhóm giới hạn: số Learner, số Instructor, số Course và dung lượng lưu trữ. Giá áp dụng theo BR-2: Organization đang sử dụng giữ giá tại thời điểm kích hoạt cho tới hết thời hạn hiện tại; giá mới chỉ áp cho lượt đăng ký và gia hạn phát sinh sau đó. Giới hạn số Course đếm theo chuỗi phiên bản, không đếm theo từng bản ghi Course: một chuỗi gồm bản gốc và mọi phiên bản kế thừa từ nó tính là một Course (xem Mục 6). |
| **BR-2** | Admin là người tạo, chỉnh sửa và ngừng cung cấp Plan. Khi Admin chỉnh sửa cấu hình một Plan, thay đổi chỉ áp dụng cho các lượt đăng ký và gia hạn phát sinh sau đó. Organization đang sử dụng giữ nguyên giới hạn tại thời điểm kích hoạt cho đến hết thời hạn hiện tại. |
| **BR-3** | Khi Admin ngừng cung cấp một Plan, Plan đó bị gỡ khỏi danh sách Guest lựa chọn và không còn được chọn cho lượt đăng ký mới hoặc làm gói đích khi nâng cấp. Organization đang dùng Plan đó không bị ảnh hưởng và tiếp tục gia hạn được chính Plan đó theo cấu hình hiện tại của Plan. |
| **BR-274** | Khi Organization gia hạn một Plan đã bị Admin chỉnh sửa, giá và bốn giới hạn áp dụng cho kỳ mới là cấu hình hiện tại của Plan theo BR-2. Nếu giới hạn mới thấp hơn mức Organization đang sử dụng, việc gia hạn vẫn thực hiện được; hệ thống không vô hiệu hóa hay xóa tài khoản, Course hoặc học liệu nào, nhưng Organization không tạo thêm hoặc tải thêm được ở giới hạn đang vượt cho tới khi mức sử dụng xuống dưới giới hạn. Màn hình gia hạn cảnh báo trước điều này. |

## **1.2. Đăng ký dịch vụ**

| BR-4 | Guest phải chọn gói trước rồi mới khai báo thông tin, vì gói quyết định số tiền phải trả và các giới hạn tổ chức sẽ nhận được. |
| :---- | :---- |
| **BR-5** | Một lượt đăng ký tạo đồng thời hai thứ: bản ghi đăng ký ở trạng thái Pending Payment và tài khoản Organizer ở trạng thái chưa kích hoạt. Tại thời điểm tạo, email của đăng ký chưa được xác thực. |
| **BR-6** | Ngay khi bản ghi đăng ký được tạo, hệ thống gửi một thư chứa mã xác thực email theo BR-337 và liên kết mở lại đăng ký. Guest phải xác thực email trước khi thanh toán, bằng một trong hai cách: nhập mã xác thực trên màn hình đăng ký, hoặc mở liên kết mở lại đăng ký. Mở liên kết được tính là đã xác thực, vì liên kết chỉ có trong thư gửi tới chính email đó. Hệ thống không cho thực hiện thanh toán khi email của đăng ký chưa được xác thực. Khi thanh toán thành công, hệ thống kích hoạt Subscription theo BR-9 và tài khoản Organizer theo BR-20, không gửi thêm thư xác thực nào. Lý do: email Organizer là định danh đăng nhập của cả Organization (BR-30) và không tự sửa được (BR-33); nếu xác thực sau thanh toán, khách gõ sai email vẫn trả tiền được nhưng không bao giờ đăng nhập được, trong khi Subscription vẫn trôi ngày theo BR-9. |
| **BR-7** | Đăng ký ở trạng thái Pending Payment có thời hạn hiệu lực theo tham số cấp nền tảng. Trong thời hạn đó, Guest mở lại đăng ký từ liên kết đã nhận và thanh toán lại không giới hạn số lần. Quá thời hạn, cả bản ghi đăng ký lẫn tài khoản Organizer chưa kích hoạt đi kèm đều tự động bị hủy, dù email đã được xác thực hay chưa: bản ghi đăng ký chuyển sang trạng thái Expired, Organization khai báo trong đăng ký chuyển sang trạng thái Cancelled, và tài khoản Organizer được coi là đã xóa theo BR-31 nên email được cấp lại. Guest đăng ký lại được ngay bằng chính email đó. Cancelled khác Suspended tại BR-45: Organization ở Cancelled chưa từng hoạt động và không có đường khôi phục; muốn sử dụng dịch vụ thì thực hiện một lượt đăng ký mới. |
| **BR-8** | Đã bỏ. Quy tắc này chỉ có nghĩa khi xác thực email diễn ra sau thanh toán. Theo BR-6, mọi đăng ký đã thanh toán đều đã xác thực email, nên không còn trạng thái tài khoản đã thanh toán mà chưa xác thực. |
| **BR-9** | Thời điểm kích hoạt Subscription là thời điểm thanh toán thành công. Thời hạn sử dụng đếm từ thời điểm này. |
| **BR-275** | Giá, thời hạn sử dụng và bốn giới hạn của Plan được chốt vào bản ghi đăng ký tại thời điểm tạo. Admin chỉnh sửa hoặc ngừng cung cấp Plan trong lúc đăng ký còn ở trạng thái Pending Payment không làm thay đổi số tiền phải trả và các giới hạn tổ chức sẽ nhận. Subscription kích hoạt theo BR-9 nhận các giá trị đã chốt này. |
| **BR-276** | Khi Guest đăng ký bằng một email đang gắn với đăng ký còn ở trạng thái Pending Payment và còn trong thời hạn hiệu lực: nếu email của đăng ký đó đã được xác thực, hệ thống không tạo đăng ký mới mà gửi lại liên kết mở lại đăng ký; nếu chưa được xác thực, đăng ký cũ bị hủy với hệ quả như quá hạn tại BR-7 và hệ thống tạo đăng ký mới theo BR-5. Mỗi thư gửi theo quy tắc này được tính vào giới hạn gửi lại tại BR-32; khi đã chạm giới hạn, hệ thống không gửi thư và không tạo đăng ký mới. Phản hồi trên màn hình giống nhau trong mọi trường hợp, không cho biết email đã gắn với đăng ký nào hay chưa. Lý do: đăng ký chưa xác thực không chứng minh được người tạo sở hữu email; nếu nó giữ email suốt thời hạn tại BR-7, một người dùng email của tổ chức khác để đăng ký trước sẽ chặn được tổ chức đó đăng ký trong suốt thời hạn này. |
| **BR-337** | Mã xác thực email gồm 6 chữ số ngẫu nhiên, có hiệu lực theo tham số cấp nền tảng tính từ lúc gửi. Nhập sai quá số lần theo tham số cấp nền tảng thì mã mất hiệu lực và Guest yêu cầu mã mới theo BR-32. Mỗi lần gửi mã mới làm mã và liên kết mở lại đăng ký cũ mất hiệu lực. Lý do dùng mã thay vì chỉ dùng liên kết: Guest nhập mã ngay trên màn hình đăng ký, không phải rời luồng để vào hộp thư rồi quay lại, nên ít bỏ dở trước bước thanh toán. Với mặc định 5 lần nhập sai mỗi mã và tối đa 6 mã trong 24 giờ (thư đầu cộng 5 lần gửi lại theo BR-32), người không có quyền truy cập hộp thư đoán trúng mã trong 24 giờ với xác suất không quá 30/1.000.000, tức 0,003%. |

## **1.3. Gia hạn và nâng cấp**

| BR-10 | Gia hạn thực hiện theo gói hiện tại. |
| :---- | :---- |
| **BR-11** | Gia hạn trong thời gian ân hạn thì thời hạn mới tính từ ngày hết hạn cũ, không phải từ ngày thanh toán. Những ngày ân hạn đã dùng bị trừ thẳng vào gói mới. |
| **BR-12** | Chỉ khi Subscription đã chuyển sang Suspended thì gia hạn mới tính từ ngày thanh toán. |
| **BR-281** | Organization gia hạn sớm được bất cứ lúc nào khi Subscription đang hoạt động. Kỳ gia hạn sớm bắt đầu từ ngày hết hạn của kỳ hiện tại, và tại một thời điểm Organization chỉ có tối đa một kỳ đã gia hạn trước chưa bắt đầu. |
| **BR-13** | Nâng cấp chỉ được sang gói có giới hạn lớn hơn hoặc bằng mức đang sử dụng. Giới hạn mới áp dụng ngay sau khi thanh toán thành công; ngày hết hạn hiện tại giữ nguyên. |
| **BR-277** | Số tiền nâng cấp tính theo tỉ lệ số ngày còn lại của kỳ hiện tại: (đơn giá ngày của gói mới − đơn giá ngày theo giá và thời hạn Organization đang giữ) × số ngày còn lại tới ngày hết hạn, trong đó đơn giá ngày bằng giá chia cho số ngày thời hạn của gói. Phần ngày lẻ tính tròn thành một ngày, số tiền làm tròn lên đến đồng. Kết quả không lớn hơn 0 thì nâng cấp không cần thanh toán. Nâng cấp chỉ thực hiện được khi Subscription đang hoạt động, không trong thời gian ân hạn hay Suspended; khi đó Organization gia hạn theo BR-10 đến BR-12. |
| **BR-282** | Không nâng cấp được khi Organization đang có một kỳ đã gia hạn trước chưa bắt đầu theo BR-281. Lý do: kỳ đã gia hạn trước mang giới hạn của gói cũ, nên nâng cấp lúc đó sẽ làm giới hạn tụt về gói cũ khi kỳ mới bắt đầu. Organization nâng cấp được sau khi kỳ đã gia hạn bắt đầu. |
| **BR-14** | Hệ thống không hỗ trợ hạ cấp gói. |

## **1.4. Hết hạn, ân hạn và Suspended**

| BR-15 | Khi Subscription hết hạn, hệ thống vào thời gian ân hạn truy cập là 7 ngày. Trong thời gian này Learner vẫn học tiếp và hoàn thành được các Course đã Enroll, nhưng không Enroll mới; Organizer không tạo tài khoản, không tạo Course và không upload học liệu. |
| :---- | :---- |
| **BR-16** | Hết thời gian ân hạn, Subscription chuyển sang Suspended. Đây là điều kiện duy nhất cắt quyền truy cập của Learner. |
| **BR-17** | Khi Subscription chuyển sang Suspended, Learner và Instructor mất toàn bộ quyền truy cập. Organizer giữ quyền truy cập giới hạn ở chế độ chỉ xem và kết xuất báo cáo đào tạo của tổ chức mình, trong 30 ngày kể từ khi Suspended. Hết 30 ngày, Organizer cũng mất quyền truy cập. Dữ liệu không bị xóa; nếu Organization gia hạn, toàn bộ quyền truy cập và dữ liệu được khôi phục đầy đủ. |
| **BR-18** | Khi Subscription sắp hết hạn, hệ thống thông báo cho Organizer tại các mốc nhắc cấu hình cấp nền tảng; thông báo ghi rõ giá và bốn giới hạn sẽ áp dụng khi gia hạn theo cấu hình hiện tại của Plan. Khi Subscription chuyển sang thời gian ân hạn, hệ thống thông báo cho Organizer, đồng thời nhắc một lần các Learner đã có Certificate tải bản PDF về lưu trước khi mất quyền truy cập theo BR-17. Learner không được nhắc ở các mốc trước hết hạn, vì phần lớn Organization gia hạn đúng hạn và Learner của họ không bao giờ mất quyền truy cập. |
| **BR-19** | Hệ thống hiển thị cảnh báo cho Organizer khi bất kỳ giới hạn nào trong bốn giới hạn của gói đạt ngưỡng cấu hình cấp nền tảng. |

# **2\. TÀI KHOẢN VÀ TRUY CẬP**

## **2.1. Tạo và kích hoạt tài khoản**

| ID | Rule Definition |
| ----- | ----- |
| **BR-20** | Tài khoản Organizer được tạo trong luồng đăng ký dịch vụ, xác thực email trước khi thanh toán theo BR-6, và được kích hoạt ngay tại thời điểm thanh toán thành công. Từ thời điểm đó, Guest trở thành Organizer và đăng nhập được. |
| **BR-21** | Tài khoản Instructor và Learner do Organizer tạo. Người dùng nhận email mời, tự đặt mật khẩu và kích hoạt tài khoản. |
| **BR-22** | Organizer phát lại lời mời được cho tài khoản chưa kích hoạt hoặc có lời mời đã hết hiệu lực. |
| **BR-278** | Lời mời tạo tài khoản có thời hạn hiệu lực theo tham số cấp nền tảng. Mỗi lần phát lại lời mời, hệ thống tạo liên kết mới và làm liên kết cũ mất hiệu lực. Người mở một liên kết đã hết hạn được thông báo rõ liên kết đã hết hạn và cách nhận liên kết mới, không phải một thông báo lỗi chung. Cách thông báo này cũng áp dụng khi mở liên kết mở lại đăng ký của một đăng ký đã quá hạn theo BR-7, kèm hướng dẫn thực hiện lượt đăng ký mới. |
| **BR-23** | Tạo tài khoản Instructor hoặc Learner đều phải qua bước kiểm tra số chỗ còn lại theo giới hạn của Subscription. |

## **2.2. Import hàng loạt**

| BR-24 | Import bằng tệp Excel áp dụng cho cả Instructor và Learner. Hệ thống hiển thị các dòng hợp lệ và các dòng lỗi kèm lý do, sau đó Organizer xác nhận thì mới tạo tài khoản và gửi lời mời. |
| :---- | :---- |
| **BR-25** | Hệ thống đối chiếu số dòng hợp lệ với số chỗ còn lại. Nếu vượt quá thì chặn toàn bộ lần import, không import một phần. |
| **BR-26** | Một dòng trong tệp import bị đánh dấu lỗi khi: thiếu trường bắt buộc; email sai định dạng; email trùng với một dòng khác trong cùng tệp; email trùng với một tài khoản chưa bị xóa trên nền tảng, kể cả tài khoản thuộc Organization khác; hoặc vai trò khai không hợp lệ. Lý do lỗi hiển thị theo từng dòng theo BR-24. |

## **2.3. Đăng nhập**

| BR-27 | Đăng nhập bằng email và mật khẩu áp dụng cho cả bốn vai trò. Hệ thống kiểm tra trạng thái tài khoản, trạng thái Subscription và trạng thái Organization trước khi cấp quyền theo vai trò. |
| :---- | :---- |
| **BR-28** | Đăng nhập bằng Google áp dụng cho Organizer, Instructor và Learner. Không áp dụng cho Admin nền tảng. |
| **BR-29** | Đăng nhập bằng Google không tự tạo tài khoản mới: email Google chưa tồn tại trong hệ thống thì hệ thống từ chối. Việc kiểm tra này chỉ xét các tài khoản chưa bị xóa theo BR-31. Đây là đăng nhập bằng tài khoản cá nhân, khác với SSO cấp doanh nghiệp vốn nằm ngoài phạm vi MVP. |
| **BR-30** | Email là định danh đăng nhập duy nhất trên toàn nền tảng. Tại một thời điểm, một email tương ứng với nhiều nhất một tài khoản chưa bị xóa, và tài khoản đó thuộc đúng một Organization. |
| **BR-31** | Ràng buộc duy nhất tại BR-30 chỉ xét các tài khoản chưa bị xóa. Email của một tài khoản đã xóa được cấp lại cho tài khoản mới; hai tài khoản là hai bản ghi độc lập, và kết quả đào tạo cùng Certificate cũ vẫn thuộc về tài khoản cũ theo BR-37. |
| **BR-32** | Guest yêu cầu gửi lại thư đăng ký bằng cách nhập email đã dùng khi đăng ký. Hệ thống chỉ gửi khi email đó gắn với một đăng ký còn ở trạng thái Pending Payment và còn trong thời hạn hiệu lực theo BR-7. Thư gửi lại chứa liên kết mở lại đăng ký mới, kèm mã xác thực mới theo BR-337 nếu email chưa được xác thực; liên kết và mã cũ mất hiệu lực. Đăng ký đã thanh toán không thuộc phạm vi quy tắc này, vì tài khoản Organizer đã kích hoạt theo BR-20; người quên mật khẩu dùng chức năng khôi phục mật khẩu. Phản hồi trên màn hình là trung tính, không cho biết email đó có tồn tại trong hệ thống hay không. Số thư gửi lại bị giới hạn theo tham số cấp nền tảng, đếm theo email trong 24 giờ gần nhất, tính chung với các thư gửi theo BR-276. Khi đã chạm giới hạn, phản hồi trên màn hình vẫn trung tính. |

## **2.4. Quản lý thông tin tài khoản**

| BR-33 | Mỗi người dùng tự quản lý họ tên và ảnh đại diện của chính mình. Email đăng nhập không thuộc phạm vi tự chỉnh sửa. |
| :---- | :---- |
| **BR-34** | Organizer nhập họ tên, email và đơn vị công tác khi tạo tài khoản Instructor hoặc Learner, và chỉnh sửa được họ tên và email khi tài khoản chưa kích hoạt. Từ khi tài khoản được kích hoạt, họ tên và ảnh đại diện do chính người dùng quản lý theo BR-33; Organizer không chỉnh sửa được. Đơn vị công tác do Organizer quản lý ở mọi thời điểm; người dùng không tự chỉnh sửa. |
| **BR-35** | Sửa email của tài khoản chưa kích hoạt làm lời mời cũ mất hiệu lực và hệ thống gửi lời mời mới. |
| **BR-279** | Đơn vị công tác là thông tin nhập tự do, không chọn từ danh mục. Hệ thống chuẩn hóa khoảng trắng khi lưu, gợi ý các giá trị đã có trong cùng Organization khi nhập, và gom nhóm không phân biệt chữ hoa chữ thường khi lọc báo cáo theo BR-230. |

## **2.5. Vô hiệu hóa và xóa tài khoản**

| BR-36 | Vô hiệu hóa tài khoản áp dụng cho cả ba vai trò Learner, Instructor và Organizer. Thao tác không xóa dữ liệu học tập và không giải phóng chỗ theo giới hạn gói. Hệ quả theo vai trò: Learner theo BR-38 và BR-39; Instructor theo BR-41; Organizer theo BR-40. |
| :---- | :---- |
| **BR-37** | Xóa tài khoản thu hồi quyền truy cập và giải phóng chỗ. Bản ghi kết quả đào tạo và Certificate đã cấp được giữ lại phục vụ lưu vết. |
| **BR-304** | Khi tài khoản Learner bị xóa, các Enrollment chưa ở trạng thái Completed của người đó chuyển sang Withdrawn; dữ liệu học tập được giữ lại theo BR-37. Lý do: tài khoản đã xóa không còn học được, nếu giữ trạng thái cũ thì Enrollment bị tính quá hạn mãi và chặn việc giải phóng học liệu theo BR-75. |
| **BR-38** | Enrollment của tài khoản đang bị vô hiệu hóa không được tính vào thống kê quá hạn. |
| **BR-39** | Nếu một Learner bị vô hiệu hóa tài khoản giữa chu kỳ chấm chéo, hệ thống loại phân công chấm của người đó và chuyển bài sang cho Instructor chấm. |
| **BR-40** | Khi Organizer hiện tại không còn khả năng quản trị, Admin gửi lời mời thiết lập Organizer mới tới một email chưa gắn với tài khoản chưa bị xóa nào trên nền tảng; Organizer cũ chuyển sang trạng thái vô hiệu hóa ngay tại thời điểm Admin thực hiện thao tác, không chờ Organizer mới nhận lời mời. Admin phát lại hoặc hủy được lời mời này theo cách tại BR-22. Nguyên tắc mỗi Organization chỉ có một Organizer tại một thời điểm được giữ nguyên, và Organizer đang chờ nhận lời mời cũng được tính. |
| **BR-41** | Không xóa hoặc vô hiệu hóa được tài khoản Instructor khi người đó còn phụ trách ít nhất một Course chưa ở trạng thái Archived. Thao tác xóa hoặc vô hiệu hóa yêu cầu chọn Instructor tiếp nhận trong cùng Organization; hệ thống thực hiện chuyển quyền theo BR-76 rồi mới thực hiện thao tác. Nếu Organization không còn Instructor nào khác, thao tác bị chặn kèm danh sách Course cần xử lý. |

# **3\. ORGANIZATION**

| ID | Rule Definition |
| ----- | ----- |
| **BR-42** | Thông tin Organization gồm tên tổ chức, mã số thuế, địa chỉ, thông tin liên hệ, logo hiển thị và múi giờ. |
| **BR-43** | Mã số thuế chỉ là thông tin định danh pháp nhân. Nó không kéo theo nghiệp vụ xuất hóa đơn — nghiệp vụ hóa đơn nằm ngoài phạm vi MVP. |
| **BR-280** | Tên tổ chức và mã số thuế không bắt buộc duy nhất trên nền tảng. Lý do: hệ thống không xác minh mã số thuế có thuộc về người đăng ký hay không, nên ràng buộc duy nhất sẽ cho phép một người đăng ký trước bằng mã số thuế của tổ chức khác và chặn tổ chức thật. Màn hình chi tiết Organization của Admin cảnh báo khi mã số thuế trùng với một Organization khác để Admin xem xét. |
| **BR-44** | Múi giờ của Organization là căn cứ xác định thời điểm kết thúc của hai loại mốc: hạn hoàn thành Course của các Enrollment dạng Required, và hạn đánh giá của các chu kỳ chấm chéo. Thay đổi múi giờ chỉ áp dụng cho các mốc được xác định sau thời điểm thay đổi; các mốc đã xác định trước đó giữ nguyên thời điểm. Giao diện cảnh báo điều này khi Organizer đổi múi giờ. |
| **BR-45** | Admin tạm khóa một Organization (Suspended) khi tổ chức đó nhiều lần để report quá thời hạn xử lý, hoặc vi phạm mang tính hệ thống. |
| **BR-46** | Thời gian Organization bị tạm khóa không tính vào thời gian xác định quá hạn của các Enrollment. |
| **BR-47** | Khi Admin gỡ tạm khóa, hạn hoàn thành của các Enrollment đang dở được dời tương ứng với thời gian gián đoạn. |
| **BR-311** | "Enrollment đang dở" tại BR-47 gồm mọi Enrollment dạng Required chưa ở trạng thái Completed hoặc Withdrawn, kể cả Exempted và Halted. Phạm vi này khác với BR-249 (xem BR-302), nơi cụm từ chỉ gồm NotStarted, InProgress và Overdue vì Enrollment đang ở Exempted không chuyển sang Halted. Lý do: nếu không dời hạn cho Enrollment đang Exempted hoặc Halted, Learner sẽ chịu thiệt từ quyết định tạm khóa ở cấp trên khi họ quay lại học, trái nguyên tắc 20.1. |
| **BR-283** | Tạm khóa Organization không dừng và không dời thời hạn Subscription. Lý do: tạm khóa là chế tài cho vi phạm do chính Organization gây ra theo BR-45, nên hệ thống không bù thời gian sử dụng cho khoảng bị tạm khóa. |
| **BR-48** | Tạm khóa Organization là biện pháp ở cấp nền tảng, dành cho vi phạm mang tính hệ thống. Vi phạm của một Course đơn lẻ được xử lý bằng vô hiệu hóa nội dung hoặc vô hiệu hóa Course (Mục 17), không bằng tạm khóa cả Organization. |

# **4\. COURSE**

## **4.1. Thuộc tính**

| ID | Rule Definition |
| ----- | ----- |
| **BR-49** | Một Course gồm: tên, mô tả ngắn, ảnh bìa, mục tiêu đào tạo, Learning Outcomes, số ngày hoàn thành dự kiến và loại khóa học. |
| **BR-290** | Khi tạo Course, bắt buộc có tên, số ngày hoàn thành dự kiến và loại khóa học. Mô tả ngắn, mục tiêu đào tạo và ít nhất một Learning Outcome bắt buộc khi gửi phê duyệt theo BR-66, và phải còn đủ ở mọi trạng thái sau đó. Ảnh bìa không bắt buộc. Lý do: Course ở Draft là bản nháp nên được phép còn thiếu; nội dung đưa ra thẩm định phải đầy đủ. |
| **BR-50** | Số ngày hoàn thành dự kiến do Instructor khai lúc tạo Course. Đây là căn cứ tính hạn hoàn thành cho các Enrollment dạng Required (Mục 8). |
| **BR-51** | Thời lượng ước tính là con số hệ thống tự tính, không do ai khai. Công thức gồm ba thành phần: Thời lượng ước tính (phút) \= Σ thời lượng các học liệu Video bắt buộc \+ Σ (số từ của học liệu Reading bắt buộc ÷ tốc độ đọc chuẩn) \+ Σ thời lượng dự kiến thực hiện của các Assignment. Mỗi học liệu được làm tròn lên đến phút trước khi cộng. Chỉ học liệu bắt buộc được cộng, vì con số này đo khối lượng học bắt buộc để đối chiếu với số ngày hoàn thành dự kiến theo BR-54; học liệu không bắt buộc không tính, cùng lý do Quiz không tính tại BR-52. Mọi Assignment đều được cộng vì Assignment không có cờ bắt buộc (BR-165). Kết quả hiển thị quy đổi ra giờ theo BR-53. Thời lượng ước tính được tính theo tham số hiện hành tại thời điểm hiển thị: thay đổi tốc độ đọc chuẩn áp dụng ngay cho mọi Course. Đây không phải kết quả đã ghi nhận theo BR-269, vì con số chỉ phục vụ hiển thị và cảnh báo tại BR-55. |
| **BR-52** | Thời gian giới hạn của Quiz không được cộng vào công thức. Lý do: Quiz thường ngắn so với ba thành phần kia, và một phần Quiz chỉ là bài tự kiểm tra giữa các Module chứ không phải khối lượng học bắt buộc. Cộng vào sẽ làm con số nhiễu mà không đổi được kết luận. |
| **BR-53** | Số ngày hoàn thành dự kiến và thời lượng ước tính là hai đại lượng khác nhau, khác cả đơn vị, và không được nhầm lẫn: số ngày hoàn thành dự kiến là hạn mức thời gian lịch (ngày), còn thời lượng ước tính là khối lượng nội dung (giờ). |
| **BR-54** | Để đối chiếu được hai đại lượng khác đơn vị đó, hệ thống quy đổi qua tham số nền tảng số giờ học quy ước mỗi ngày (mặc định 1 giờ, phù hợp với đào tạo nội bộ nơi nhân viên học xen kẽ công việc): Sức chứa (giờ) \= số ngày hoàn thành dự kiến × số giờ học quy ước mỗi ngày. Cảnh báo tại BR-55 xuất hiện khi thời lượng ước tính (giờ) \> sức chứa × (1 \+ ngưỡng chênh lệch thời lượng). Ví dụ với mặc định 1 giờ mỗi ngày và ngưỡng 20%, Course khai 10 ngày hoàn thành dự kiến được cảnh báo khi thời lượng ước tính vượt 12 giờ. |
| **BR-55** | Hệ thống tự hiển thị cảnh báo khi thời lượng ước tính vượt sức chứa quá ngưỡng chênh lệch cấu hình. Cảnh báo không chặn việc gửi Course đi phê duyệt. |
| **BR-293** | Khi tài liệu Reading không trích được chữ (ví dụ bản scan dạng ảnh), số từ được ghi nhận bằng 0 và phần đọc của tài liệu đó tính 0 phút vào thời lượng ước tính. Hệ thống cảnh báo Instructor ngay lúc tải lên để Instructor biết thời lượng ước tính đang thiếu phần này. Số từ không do Instructor khai, theo BR-51. |

## **4.2. Loại khóa học: Public và Private**

| BR-56 | Course có thuộc tính courseType với hai giá trị: Public và Private. Thuộc tính này chỉ quyết định việc hiển thị trong danh mục tự học. |
| :---- | :---- |
| **BR-57** | Chỉ Course loại Public đã Published mới xuất hiện trong danh mục tự học của Learner và mới tìm kiếm được trong danh mục đó. |
| **BR-58** | Course loại Private vẫn được Organizer phân công bình thường. Learner được phân công một Course Private vẫn thấy Course đó trong màn hình "Course của tôi", dù nó không có trong danh mục tự học. |
| **BR-59** | Việc một Learner được phân công hay tự đăng ký do bảng Enrollment quyết định, không do courseType quyết định. Hai khái niệm này độc lập với nhau. |
| **BR-60** | Instructor đổi được courseType sau khi tạo Course, kể cả khi Course đã Locked, vì đây là thuộc tính hiển thị chứ không phải căn cứ tính kết quả học tập. Mỗi lần đổi, hệ thống thông báo cho Organizer và ghi vào nhật ký theo BR-270. Organizer đổi lại courseType bất cứ lúc nào. |
| **BR-61** | Đổi courseType từ Public sang Private không ảnh hưởng các Enrollment đã có. Learner đã tự đăng ký trước đó vẫn học tiếp bình thường, Enrollment vẫn là Optional nên vẫn không có hạn hoàn thành. Việc đổi sang Private chỉ làm Course biến mất khỏi danh mục tự học đối với những người chưa đăng ký. |

## **4.3. Bốn tổ hợp của courseType và Enrollment**

| Tổ hợp | Đường tạo ra |
| ----- | ----- |
| Public \+ Optional | Learner thấy Course trong danh mục và tự đăng ký |
| Public \+ Required | Organizer phân công |
| Private \+ Required | Organizer phân công |
| Private \+ Optional | KHÔNG có đường tạo mới (xem BR-62 và BR-63) |

| BR-62 | Không có đường tạo mới một Enrollment Optional trên Course loại Private. Learner không thấy Course Private trong danh mục nên không tự đăng ký được; còn vào bằng phân công thì Enrollment luôn là Required kèm hạn hoàn thành. |
| :---- | :---- |
| **BR-63** | Tuy vậy tổ hợp Private \+ Optional vẫn tồn tại được dưới dạng tàn dư: khi một Course chuyển từ Public sang Private, các Enrollment Optional đã phát sinh trước đó vẫn chạy tiếp bình thường theo BR-61. Hệ thống không cắt quyền học của những người này và không chuyển họ sang Required. |

## **4.4. Vòng đời trạng thái Course**

| BR-64 | Chuỗi trạng thái Course: Draft → Submitted → Published → Archived, cùng hai nhánh rẽ là Rejected (từ Submitted) và Disabled (từ Published). |
| :---- | :---- |
| **BR-65** | Hệ thống dùng duy nhất tên trạng thái Published. Không viết "Approved/Published" ở bất kỳ chỗ nào. Hành động vẫn giữ tên "Phê duyệt Course"; kết quả của hành động đó là Course chuyển sang trạng thái Published. |
| **BR-66** | Instructor gửi Course từ Draft hoặc Rejected sang Submitted. Hành động này chuyển trách nhiệm xử lý từ Instructor sang Organizer. |
| **BR-67** | Instructor thu hồi Course từ Submitted về Draft, nhưng chỉ trước khi Organizer ra quyết định phê duyệt. |
| **BR-285** | Khi Course ở trạng thái Submitted, Instructor không chỉnh sửa được thành phần nào của Course, kể cả các thao tác luôn cho phép tại Mục 5.2. Muốn sửa, Instructor thu hồi Course về Draft theo BR-67. Lý do: nội dung Organizer thẩm định phải đúng là nội dung được xuất bản khi phê duyệt. |
| **BR-68** | Organizer phê duyệt: chấp thuận thì Course chuyển Published; từ chối kèm lý do thì Course chuyển Rejected. Hệ thống thông báo kết quả cho Instructor phụ trách. |
| **BR-69** | Course nằm yên ở trạng thái Rejected. Instructor chỉnh sửa ngay trong trạng thái đó với quyền biên soạn như Draft, xong thì gửi duyệt lại: Rejected → Submitted trực tiếp, không đi vòng qua Draft. |
| **BR-70** | Chỉ Course ở trạng thái Published mới được phân công hoặc xuất hiện trong danh mục tự học. |
| **BR-71** | Archived và Disabled không nối tiếp nhau. Đó là hai kết cục thay thế nhau. Chỉ Archived mới là trạng thái kết thúc thật; Disabled quay lại Published được sau khi vi phạm đã được khắc phục. |
| **BR-72** | Course không có thuộc tính "thời điểm kết thúc" và không có trạng thái "Closed". Course sống cho tới khi bị thay bằng phiên bản mới (Archived) hoặc bị vô hiệu hóa do vi phạm nội dung (Disabled). |

## **4.5. Xóa Course**

| BR-73 | Chỉ xóa được Course ở trạng thái Draft hoặc Rejected. Course đã từng phát sinh Enrollment thì không xóa được. |
| :---- | :---- |
| **BR-74** | Việc giải phóng tài nguyên có hai vế riêng, không gộp chung. Xóa Course ở trạng thái Draft hoặc Rejected theo BR-73 giải phóng dung lượng lưu trữ của các tệp mà không phiên bản nào khác còn tham chiếu tới. Quota số Course đếm theo chuỗi phiên bản (BR-1), nên chỉ được giải phóng khi thao tác xóa làm chuỗi không còn phiên bản nào; xóa một phiên bản Draft hoặc Rejected của chuỗi còn phiên bản khác không giải phóng quota số Course. Giải phóng học liệu của phiên bản Archived theo BR-75 chỉ giải phóng dung lượng lưu trữ. |
| **BR-75** | Instructor phụ trách giải phóng học liệu của một phiên bản ở trạng thái Archived khi mọi Enrollment trên phiên bản đó đều đã ở trạng thái Completed hoặc Withdrawn. Enrollment ở NotStarted, InProgress, Overdue, Exempted hoặc Halted chặn thao tác, vì Learner vẫn còn học được (BR-107, BR-121, BR-142) hoặc Enrollment còn có thể được khôi phục (BR-250). Thao tác xóa các tệp học liệu mà không phiên bản nào khác trong chuỗi còn tham chiếu tới, và giải phóng phần dung lượng tương ứng. Bản ghi phiên bản — số hiệu, tên, cấu trúc chương trình, ngày duyệt, kết quả học tập đã ghi nhận — được giữ lại để BR-108, BR-229 và BR-265 vẫn tham chiếu được. Thao tác không giải phóng quota số Course, vì chuỗi vẫn tồn tại. |

## **4.6. Chuyển quyền phụ trách**

| BR-76 | Organizer chuyển một Course sang cho Instructor khác trong cùng Organization phụ trách. |
| :---- | :---- |
| **BR-77** | Instructor tiếp nhận kế thừa quyền chỉnh sửa nội dung trong phạm vi còn được phép, quyền chấm điểm và quyền tạo phiên bản mới. |
| **BR-78** | Mọi việc chấm điểm luôn thuộc về Instructor đang phụ trách Course tại thời điểm xử lý, không thuộc về người đã tạo ra nội dung. |
| **BR-79** | Instructor chỉ xem được nội dung của các Course mình đang phụ trách. Course do Instructor khác phụ trách không xuất hiện trong bất kỳ danh sách, danh mục hay kết quả tìm kiếm nào của Instructor, ở mọi trạng thái. Quyền xem nội dung phát sinh khi nhận chuyển quyền phụ trách theo BR-76 và chấm dứt khi chuyển đi. |
| **BR-287** | Quyền phụ trách gắn với cả chuỗi phiên bản (Mục 6), không gắn với từng phiên bản: tại một thời điểm, mọi phiên bản trong một chuỗi do cùng một Instructor phụ trách. Chuyển quyền theo BR-76 áp dụng cho cả chuỗi, và phiên bản mới tạo theo BR-100 thuộc Instructor đang phụ trách chuỗi. Lý do: theo BR-78, việc chấm điểm trên phiên bản cũ thuộc Instructor đang phụ trách; tách theo phiên bản thì bản cũ và bản mới có thể thuộc hai người khác nhau. Điều kiện tại BR-41 xét theo chuỗi. Vì phiên bản mới nhất của một chuỗi không bao giờ ở trạng thái Archived, Instructor còn phụ trách bất kỳ chuỗi nào đều phải được chuyển quyền trước khi bị xóa hoặc vô hiệu hóa tài khoản. |

# **5\. CƠ CHẾ KHÓA NỘI DUNG (LOCKED)**

## **5.1. Nguyên tắc**

| ID | Rule Definition |
| ----- | ----- |
| **BR-80** | Course được gắn thuộc tính Locked ngay khi phát sinh Enrollment đầu tiên, bất kể Enrollment đó là Required do phân công hay Optional do Learner tự đăng ký. Locked là thuộc tính độc lập với chuỗi trạng thái tại BR-64, không phải một giá trị trong chuỗi đó. |
| **BR-81** | Mục đích của Locked là bảo vệ tính toàn vẹn kết quả học tập: khi đã có người học, việc thêm bớt thành phần bắt buộc hoặc thay đổi cấu trúc sẽ làm sai lệch tiến độ và điều kiện cấp Certificate đã ghi nhận. |
| **BR-82** | Locked không phải là khóa toàn bộ. Nguyên tắc phân loại: thao tác chỉ ảnh hưởng cách hiển thị thì luôn cho phép; thao tác làm thay đổi căn cứ tính kết quả thì bị chặn. |
| **BR-83** | Việc Learner rút khỏi Course không gỡ thuộc tính Locked, vì dữ liệu học tập vẫn tồn tại. |
| **BR-284** | Trước khi Locked, Course ở trạng thái Published được chỉnh sửa với quyền biên soạn như Draft, kể cả các thao tác tại Mục 5.3, và không phải phê duyệt lại. Lý do: chưa có Learner nào nên chưa có kết quả học tập cần bảo vệ theo BR-81; việc kiểm soát nội dung sau phê duyệt dựa vào cơ chế report tại Mục 17\. Đóng băng cấu trúc ngay khi Published sẽ làm một Course lỡ duyệt với cấu trúc sai không có đường sửa khi chưa tạo được phiên bản mới. |

## **5.2. Thao tác LUÔN thực hiện được, kể cả khi Course đã Locked**

| BR-84 | Chỉnh sửa tên, mô tả ngắn, ảnh bìa, mục tiêu đào tạo, Learning Outcomes, số ngày hoàn thành dự kiến và loại khóa học của Course. |
| :---- | :---- |
| **BR-85** | Chỉnh sửa tiêu đề Module và tiêu đề Lesson. |
| **BR-86** | Chỉnh sửa tiêu đề học liệu. |
| **BR-87** | Thay thế một tệp học liệu bị lỗi kỹ thuật bằng tệp mới. Đây là sửa lỗi kỹ thuật, không phải thay đổi nội dung chương trình. |
| **BR-286** | Thêm học liệu mới vào một Lesson đã có thực hiện được kể cả khi Course đã Locked, với điều kiện học liệu đó được tạo ở dạng không bắt buộc. Học liệu không bắt buộc không thuộc điều kiện cấp Certificate (BR-147) và không tính vào thời lượng ước tính (BR-51), nên không làm thay đổi căn cứ tính kết quả theo BR-82. Thêm học liệu bắt buộc khi Course đã Locked bị chặn như thay đổi cờ bắt buộc tại BR-90. Học liệu thêm khi Course đã Locked luôn nằm cuối Lesson và không đổi được thứ tự, theo BR-89. Kiểm tra tại BR-151 vẫn áp dụng. |

## **5.3. Thao tác BỊ CHẶN khi Course đã Locked**

| BR-88 | Thêm Module, thêm Lesson, xóa Module, xóa Lesson. |
| :---- | :---- |
| **BR-89** | Thay đổi thứ tự các thành phần trong cây chương trình. |
| **BR-90** | Thay đổi cờ bắt buộc của học liệu. Module và Lesson không có cờ riêng theo BR-147 nên không cần nhắc tới ở đây. |
| **BR-91** | Xóa học liệu. |
| **BR-92** | Xóa Quiz hoặc Assignment đã có dữ liệu. |
| **BR-93** | Bật hoặc tắt chế độ chấm chéo của một Assignment. |
| **BR-94** | Chỉnh sửa điểm đạt tối thiểu và trạng thái bắt buộc của Quiz. |
| **BR-318** | Khi Course đã Locked, chỉ thêm được Quiz ở dạng không bắt buộc; Quiz đó nằm cuối vị trí gắn và không đổi được thứ tự. Không thêm được Assignment. Lý do: mọi Assignment (BR-165) và Quiz bắt buộc (BR-211) đều là điều kiện cấp Certificate; thêm chúng khi đã có Learner làm đổi căn cứ tính kết quả, trái BR-81. Quy tắc này tương ứng với BR-286 của học liệu. |
| **BR-319** | Chỉnh sửa điểm đạt tối thiểu của Assignment bị chặn khi Course đã Locked, như với Quiz tại BR-94. Lý do: điểm đạt là căn cứ xét hoàn thành Assignment (BR-211); nếu sửa được sau khi đã có bài chấm thì Learner đã đạt có thể thành chưa đạt, hoặc ngược lại. |

## **5.4. Ràng buộc theo dữ liệu đã phát sinh, độc lập với Locked**

| BR-95 | Chỉnh sửa nội dung của một Lesson chỉ thực hiện được khi chưa có Learner nào hoàn thành Lesson đó. |
| :---- | :---- |
| **BR-96** | Thêm, sửa, xóa câu hỏi và đáp án của một Quiz chỉ thực hiện được khi Quiz đó chưa có lượt làm bài. |
| **BR-323** | Course chỉ gửi phê duyệt được khi mọi Quiz của Course có ít nhất một câu hỏi. Sau khi Course rời trạng thái Draft hoặc Rejected, Instructor không xóa được câu hỏi cuối cùng của một Quiz. Lý do: Quiz không có câu hỏi thì không làm được; nếu Quiz đó bắt buộc thì không Learner nào nhận được Certificate. |
| **BR-97** | Chỉnh sửa thời gian giới hạn, số lượt liên tiếp tối đa và thời gian tạm khóa của Quiz chỉ thực hiện được khi Quiz chưa có lượt làm bài. |
| **BR-98** | Chỉnh sửa đề bài, Rubric, số lượt nộp tối đa và thời gian tạm khóa của Assignment chỉ thực hiện được khi Assignment chưa có bài nộp. |
| **BR-99** | Giao diện xem cấu trúc chương trình hiển thị lý do bị khóa của từng thành phần, để Instructor biết vì sao không sửa được thay vì thấy nút bị mờ mà không rõ nguyên nhân. |

# **6\. PHIÊN BẢN COURSE**

| ID | Rule Definition |
| ----- | ----- |
| **BR-100** | Khi nội dung cần cập nhật mà Course đã Locked, Instructor tạo một phiên bản mới: hệ thống sao chép toàn bộ cấu trúc của Course đã Locked thành phiên bản mới ở trạng thái Draft, liên kết với Course gốc thành một chuỗi phiên bản. |
| **BR-101** | Phiên bản mới kế thừa loại khóa học (Public hoặc Private) của bản gốc. |
| **BR-102** | Phiên bản mới dùng chung tham chiếu tới những tệp học liệu được giữ lại từ bản gốc, nên phần đó không nhân đôi dung lượng lưu trữ. Học liệu được thay mới ở phiên bản mới vẫn chiếm dung lượng riêng và vẫn bị kiểm tra theo BR-151. |
| **BR-103** | Khi một tệp học liệu dùng chung được thay thế trong một phiên bản đang ở trạng thái Draft hoặc Rejected, việc thay thế tạo ra một tham chiếu tệp mới thuộc riêng phiên bản đó. Các phiên bản trước vẫn tiếp tục tham chiếu tới tệp gốc và nội dung của chúng không thay đổi. |
| **BR-104** | Việc thay tệp bị lỗi kỹ thuật theo BR-87 là ngoại lệ của BR-103: thao tác tác động lên chính tệp dùng chung, nên bản sửa đến được mọi phiên bản đang tham chiếu tới nó. Đây là chủ đích, vì BR-87 đã tuyên bố nội dung chương trình không đổi mà chỉ sửa lỗi kỹ thuật. Thao tác được ghi nhận theo BR-270. |
| **BR-105** | Phiên bản mới phải trải qua lại quy trình phê duyệt như một Course bình thường. |
| **BR-106** | Khi phiên bản mới được duyệt, phiên bản trước tự động chuyển sang Archived. Nếu phiên bản trước đang ở trạng thái Disabled thì giữ nguyên Disabled, không chuyển sang Archived, vì Archived và Disabled là hai kết cục thay thế nhau theo BR-71. |
| **BR-107** | Learner đang học dở ở phiên bản cũ vẫn học tiếp và hoàn thành được trên phiên bản đó. Archived nghĩa là không nhận người mới, không phải đóng cửa với người đang học. |
| **BR-108** | Certificate luôn ghi rõ Course và phiên bản đã hoàn thành. Nhờ đó doanh nghiệp phân biệt được nhân viên nào đã học nội dung cũ và nhân viên nào đã học nội dung mới. |
| **BR-109** | Màn hình xem chuỗi phiên bản hiển thị: số hiệu phiên bản, trạng thái từng bản, ngày tạo và ngày phê duyệt, số Learner đang học và đã hoàn thành ở từng bản, số Certificate đã cấp theo từng bản, và phiên bản nào đang là bản hiện hành. |
| **BR-336** | Phiên bản hiện hành của một chuỗi Course là phiên bản có ngày phê duyệt gần nhất trong chuỗi. Phiên bản hiện hành bị vô hiệu hóa vẫn là bản hiện hành cho tới khi một phiên bản mới hơn được duyệt. Lý do: nếu chỉ coi bản Published là hiện hành, việc vô hiệu hóa Course làm mọi Certificate của chuỗi bị báo cáo là thuộc phiên bản cũ, sai căn cứ phân công học lại tại BR-110. |
| **BR-110** | Báo cáo phiên bản cho Organizer nêu rõ danh sách Learner đang giữ Certificate của phiên bản không còn là bản hiện hành — đây là căn cứ để tổ chức quyết định có phân công học lại bản mới hay không. |
| **BR-111** | Trong một chuỗi, tối đa một phiên bản ở trạng thái Published tại một thời điểm. |
| **BR-289** | Trong một chuỗi, tối đa một phiên bản ở trạng thái Draft, Submitted hoặc Rejected tại một thời điểm. Lý do: nếu hai phiên bản được biên soạn song song, việc duyệt phiên bản thứ hai theo BR-106 sẽ chuyển ngay phiên bản vừa được duyệt trước đó sang Archived. |

# **7\. ENROLLMENT**

## **7.1. Hai dạng Enrollment**

| ID | Rule Definition |
| ----- | ----- |
| **BR-112** | Enrollment có hai dạng: Required (do Organizer phân công) và Optional (do Learner tự đăng ký). |
| **BR-113** | Chỉ Organizer được phân công đào tạo bắt buộc. Instructor không có quyền này, kể cả với Course do chính mình phụ trách. |
| **BR-114** | Hệ quả cần nói rõ: Instructor không bị bịt đường đưa người vào khóa của mình. Kênh của Instructor là để Course ở dạng Public rồi Learner tự đăng ký thành Enrollment Optional — tức là lời mời, không hạn, không nghĩa vụ. Xem nguyên tắc 22.8. |
| **BR-115** | Bảy trạng thái của một Enrollment, tên định danh dùng trong tài liệu và cơ sở dữ liệu: NotStarted, InProgress, Completed, Overdue, Exempted, Withdrawn, Halted. Nhãn hiển thị cho người dùng vẫn bằng tiếng Việt, theo thứ tự tương ứng: Chưa bắt đầu, Đang học, Hoàn thành, Quá hạn, Miễn, Đã rút, Tạm dừng. |
| **BR-307** | Enrollment ở trạng thái NotStarted khi chưa phát sinh dữ liệu học tập theo định nghĩa tại mục 2 của bảng Use Case, và chuyển sang InProgress ngay khi phát sinh dữ liệu học tập đầu tiên: hoàn thành một học liệu, có lượt làm Quiz đầu tiên, hoặc có bài nộp Assignment đầu tiên. Việc mở xem học liệu mà chưa hoàn thành không làm Enrollment chuyển sang InProgress. Lý do: dùng chung một định nghĩa với điều kiện hủy phân công tại BR-119, để không có Enrollment nào vừa ở InProgress vừa hủy phân công được. |
| **BR-116** | Completed là trạng thái cuối của Enrollment. Không có đường chuyển từ Completed sang bất kỳ trạng thái nào khác. |
| **BR-117** | Hệ thống không có trạng thái "rớt". Xem thêm BR-152. |

## **7.2. Luồng Required — phân công**

| BR-118 | Organizer chọn một Course đã Published và một hoặc nhiều Learner để giao đào tạo bắt buộc. Hệ thống tự động tạo Enrollment và thông báo cho từng Learner được chọn. |
| :---- | :---- |
| **BR-308** | Khi Organizer phân công một Course cho nhiều Learner trong một lần, hệ thống kiểm tra toàn bộ danh sách trước khi tạo Enrollment. Nếu có Learner không hợp lệ thì chặn toàn bộ lần phân công và hiển thị từng Learner lỗi kèm lý do; không phân công một phần. Learner đang có Enrollment dạng Optional hoặc ở trạng thái Withdrawn trên chính phiên bản đó không bị tính là lỗi: Enrollment đó được chuyển sang Required theo BR-133 và BR-305. Tài khoản Learner đã được tạo nhưng chưa kích hoạt vẫn được phân công; hạn hoàn thành tính từ ngày phân công theo BR-136 và trạng thái quá hạn tính như mọi Enrollment khác. |
| **BR-119** | Hủy phân công chỉ thực hiện được khi Enrollment chưa phát sinh dữ liệu học tập, tức chưa hoàn thành học liệu nào, chưa có lượt làm Quiz và chưa có bài nộp. |
| **BR-120** | Khi Enrollment đã phát sinh dữ liệu học tập mà Organizer muốn bỏ nghĩa vụ cho Learner đó, cơ chế dùng là đánh dấu Exempted kèm lý do, không phải hủy phân công. |
| **BR-121** | Enrollment ở trạng thái Exempted không được tính vào thống kê quá hạn, nhưng Learner vẫn học tiếp được nếu muốn. Trạng thái Halted tại BR-249 khác ở chỗ này: Halted cũng không tính quá hạn nhưng Learner không truy cập được nội dung. |
| **BR-122** | Hệ thống không có đường chuyển Enrollment từ Required về Optional. Muốn bỏ nghĩa vụ thì dùng trạng thái Exempted. |
| **BR-123** | Organizer đương nhiệm gỡ được trạng thái Exempted do Organizer đặt, kể cả khi do Organizer tiền nhiệm đặt. Khi gỡ, hệ thống tính lại trạng thái theo tiến độ thực tế của Learner tại thời điểm đó: chưa phát sinh dữ liệu học tập thì NotStarted; đang dở thì InProgress; đã hoàn thành toàn bộ thành phần bắt buộc thì Completed và cấp Certificate theo BR-211. |
| **BR-301** | Learner ở trạng thái Exempted hoàn thành toàn bộ thành phần bắt buộc thì Enrollment chuyển sang Completed và được cấp Certificate như bình thường, không cần chờ Organizer gỡ Exempted. Lý do: BR-121 cho Learner ở Exempted học tiếp; bắt họ chờ Organizer gỡ Exempted mới được cấp Certificate là để Learner chịu hậu quả từ quyết định ở cấp trên, trái nguyên tắc 20.1. |
| **BR-124** | Hạn hoàn thành được dời thêm đúng khoảng thời gian Enrollment ở trạng thái Exempted hoặc Halted. Organizer vẫn kéo dài thêm được theo BR-139. |
| **BR-125** | Trạng thái Halted do hệ thống tự ghi nhận khi Course bị vô hiệu hóa thì không gỡ theo cách tại BR-123. Xem BR-250. |
| **BR-126** | Learner không tự rút khỏi Course được phân công. Chỉ Organizer hủy phân công (khi chưa phát sinh dữ liệu) hoặc đánh dấu Exempted (khi đã phát sinh dữ liệu). |

## **7.3. Luồng Optional — tự đăng ký**

| BR-127 | Learner tự đăng ký vào một Course loại Public đã Published trong danh mục, không cần Organizer phân công và không cần ai duyệt. |
| :---- | :---- |
| **BR-128** | Không giới hạn số Course tự chọn học đồng thời. Nhân viên muốn học khóa nào thì học, học bao nhiêu khóa cùng lúc tùy ý. |
| **BR-129** | Enrollment dạng Optional không có hạn hoàn thành, do đó không bao giờ phát sinh trạng thái Quá hạn. |

## **7.4. Rút khỏi Course tự chọn**

| BR-130 | Learner rút khỏi Course Optional bất cứ lúc nào, có bước xác nhận trước khi thực hiện. |
| :---- | :---- |
| **BR-131** | Nếu chưa phát sinh kết quả đánh giá nào — chưa làm Quiz, chưa nộp bài, chưa chấm chéo cho ai — thì toàn bộ dữ liệu Enrollment bị xóa. |
| **BR-132** | Nếu đã có kết quả đánh giá thì dữ liệu được giữ lại, Enrollment chuyển sang trạng thái Withdrawn. Learner đăng ký lại thì hệ thống khôi phục tiến độ cũ, không phải học lại từ đầu. |
| **BR-305** | Việc khôi phục tiến độ theo BR-132 chỉ áp dụng trên cùng phiên bản Course. Khi Organizer phân công đúng phiên bản mà Learner đang có Enrollment ở trạng thái Withdrawn, Enrollment đó được khôi phục tiến độ và chuyển sang Required theo BR-133. Khi phiên bản Learner đã rút không còn ở trạng thái Published, Learner tham gia phiên bản hiện hành bằng một Enrollment mới và tiến độ cũ không chuyển sang. Lý do: học liệu của hai phiên bản là hai bản ghi khác nhau nên không có cách chuyển tiến độ đúng nghĩa. |

## **7.5. Chuyển từ Optional sang Required**

| BR-133 | Nếu Learner đã tự đăng ký một Course từ trước rồi sau đó được Organizer phân công chính Course đó, Enrollment hiện có chuyển từ Optional sang Required; tiến độ và kết quả đã có giữ nguyên, không tạo Enrollment thứ hai. |
| :---- | :---- |
| **BR-298** | Mỗi Learner có tối đa một Enrollment trên mỗi phiên bản Course. Learner đang có Enrollment chưa hoàn thành trên một phiên bản vẫn được phân công hoặc tự đăng ký phiên bản khác trong cùng chuỗi; hai Enrollment độc lập với nhau. Việc chuyển Optional sang Required theo BR-133 chỉ áp dụng khi Organizer phân công đúng phiên bản mà Learner đang có Enrollment. Lý do: phiên bản cũ đã Archived không phân công được theo BR-70; nếu chặn thì Organizer phải xử lý Enrollment ở phiên bản cũ trước khi phân công phiên bản mới. |
| **BR-134** | Hạn hoàn thành trong trường hợp này tính lại từ ngày phân công, không tính từ ngày Learner tự đăng ký. |
| **BR-135** | Nếu tại thời điểm được phân công, Learner đã hoàn thành 100% Course đó thì hệ thống ghi nhận hoàn thành ngay và không cấp Certificate thứ hai. |

# **8\. THỜI HẠN HOÀN THÀNH**

## **8.1. Mô hình**

| ID | Rule Definition |
| ----- | ----- |
| **BR-136** | Hạn hoàn thành được tính riêng cho từng Enrollment, theo công thức: ngày phân công \+ số ngày hoàn thành dự kiến của Course. |
| **BR-300** | Hạn hoàn thành tại BR-136 là thời điểm kết thúc ngày thứ N tính từ ngày phân công, theo lịch và múi giờ của Organization tại thời điểm phân công, với N là số ngày hoàn thành dự kiến. Lý do: BR-44 lấy múi giờ làm căn cứ xác định thời điểm kết thúc, tức hạn tính theo ngày lịch chứ không theo số giờ. |
| **BR-137** | Hệ thống không có khái niệm "đợt phân công". Không có thực thể trung gian, không có quy tắc "một Learner chỉ thuộc một đợt trên mỗi Course". |
| **BR-138** | Hạn hoàn thành chỉ áp dụng cho Enrollment dạng Required. |

## **8.2. Điều chỉnh hạn**

| BR-139 | Organizer điều chỉnh được hạn hoàn thành của từng Learner trên từng Course khi có lý do chính đáng. |
| :---- | :---- |
| **BR-140** | Hạn chỉ được kéo dài, không được rút ngắn sau khi đã công bố. Tình trạng quá hạn của Learner đó được tính lại sau khi điều chỉnh. |
| **BR-141** | Phân chia trách nhiệm: số ngày hoàn thành dự kiến ở cấp Course do Instructor khai; điều chỉnh hạn của từng Learner do Organizer thực hiện. |

## **8.3. Trạng thái Quá hạn**

| BR-142 | Trạng thái Quá hạn chỉ để Organizer biết ai đang chậm tiến độ. Nó không chặn Learner tiếp tục học và hoàn thành Course. |
| :---- | :---- |
| **BR-143** | Learner hoàn thành muộn hơn hạn vẫn được cấp Certificate, nhưng Certificate ghi dấu hiệu hoàn thành sau hạn. |
| **BR-144** | Các trường hợp không tính vào thống kê quá hạn: Enrollment ở trạng thái Exempted; Enrollment ở trạng thái Halted; Enrollment của tài khoản đang bị vô hiệu hóa; Enrollment dạng Optional (vốn không có hạn); và khoảng thời gian Organization bị tạm khóa. |

# **9\. HỌC TẬP VÀ TIẾN ĐỘ**

| ID | Rule Definition |
| ----- | ----- |
| **BR-145** | Cấu trúc chương trình của một Course là cây hai cấp: Module chứa Lesson. Học liệu thuộc về Lesson. |
| **BR-146** | Học liệu có hai dạng: Video và Reading. |
| **BR-147** | Cờ bắt buộc chỉ đặt ở cấp học liệu. Module và Lesson không có cờ riêng; trạng thái bắt buộc của chúng được suy ra: một Lesson là bắt buộc khi chứa ít nhất một học liệu bắt buộc, và một Module là bắt buộc khi chứa ít nhất một Lesson bắt buộc. Module hoặc Lesson không chứa thành phần bắt buộc nào được coi là không bắt buộc. Chỉ học liệu bắt buộc mới tính vào điều kiện cấp Certificate. |
| **BR-292** | Nội dung của Lesson là phần văn bản giới thiệu, không phải học liệu. Nó không mang cờ bắt buộc, không tính vào điều kiện cấp Certificate và không tính vào thời lượng ước tính (BR-51). Tài liệu đọc mà Learner bắt buộc phải hoàn thành được thêm dưới dạng học liệu Reading. |
| **BR-148** | Học liệu Video: hệ thống ghi nhận tiến trình xem và tự đánh dấu hoàn thành khi Learner xem đủ tỉ lệ thời lượng theo ngưỡng cấu hình cấp nền tảng. |
| **BR-299** | Tiến trình xem học liệu Video được đo bằng tổng thời lượng các đoạn đã phát, không tính trùng đoạn xem lại và không tính đoạn bị tua qua, ở bất kỳ tốc độ phát nào. Học liệu Video hoàn thành theo BR-148 khi tổng này đạt tỉ lệ tối thiểu theo tham số cấp nền tảng. Tỉ lệ được chép vào Enrollment tại thời điểm tạo; thay đổi tham số chỉ áp dụng cho Enrollment tạo sau đó theo BR-269. |
| **BR-149** | Học liệu Reading: Learner tự đánh dấu đã hoàn thành. |
| **BR-309** | Học liệu đã được ghi nhận hoàn thành thì giữ nguyên trạng thái hoàn thành: Learner không bỏ đánh dấu được học liệu Reading, và việc thay tệp lỗi kỹ thuật theo BR-87 không làm học liệu Video mất trạng thái hoàn thành. Sau khi Enrollment chuyển sang Completed, hệ thống không ghi nhận thêm tiến trình xem. Lý do: hoàn thành học liệu là dữ liệu học tập dùng cho BR-95, BR-119 và BR-131; cho bỏ đánh dấu thì Learner đổi được kết quả của các quy tắc đó. |
| **BR-150** | Một Lesson được xem là hoàn thành khi toàn bộ học liệu bắt buộc thuộc Lesson đó đã hoàn thành. |
| **BR-306** | Lesson không chứa học liệu bắt buộc được coi là hoàn thành đối với một Learner khi Learner đó đã hoàn thành mọi học liệu của Lesson; Lesson không có học liệu nào không bao giờ được coi là hoàn thành. Quy tắc này dùng cho hiển thị tại UC27 và cho kiểm tra tại BR-95. Lý do: đọc BR-150 theo nghĩa đen thì Lesson không có học liệu bắt buộc hoàn thành với mọi Learner ngay khi có Enrollment đầu tiên, làm BR-95 khóa nội dung Lesson đó. |
| **BR-151** | Khi upload học liệu, hệ thống kiểm tra đồng thời hai nhóm ràng buộc: giới hạn kỹ thuật cấp nền tảng (thời lượng, dung lượng, định dạng) và dung lượng lưu trữ còn lại của Subscription. |
| **BR-288** | Dung lượng lưu trữ tính vào giới hạn của Subscription gồm tệp học liệu và ảnh bìa Course. Tệp dùng chung giữa các phiên bản theo BR-102 chỉ tính một lần. Tệp bài nộp của Learner, ảnh đại diện người dùng, logo Organization, tệp Certificate và tệp báo cáo kết xuất không tính. Lý do không tính bài nộp: nếu tính, học liệu do Instructor tải lên có thể dùng hết dung lượng và chặn Learner nộp bài, trái nguyên tắc tại 20.1. Ảnh đại diện và logo có kích thước không đáng kể; tệp Certificate và tệp báo cáo do hệ thống sinh ra, không do Organization chủ động tải lên. |
| **BR-320** | Tệp đính kèm đề bài Assignment không tính vào giới hạn dung lượng của Subscription, như tệp bài nộp tại BR-288; mỗi Assignment có tối đa một tệp đề bài, cùng giới hạn kích thước và định dạng với tệp bài nộp. Lý do: dung lượng chỉ được đếm ở Course Service (kiến trúc mục 5); tính cả tệp này sẽ buộc Assessment Service giữ chỗ dung lượng qua một service khác, trong khi giới hạn một tệp mỗi Assignment đã chặn được việc lạm dụng. |
| **BR-152** | Hệ thống không gán nhãn "Failed" cho ai và không chặn ai vì điểm kém. Ai chưa đủ điều kiện thì đơn giản là chưa có Certificate. Việc xử lý người chưa đạt là chuyện nội bộ của doanh nghiệp, không thuộc phạm vi hệ thống. |
| **BR-153** | Learner chưa nộp bài thì được ghi nhận là chưa hoàn thành Assessment, không có trạng thái rớt. |

# **10\. QUIZ**

| ID | Rule Definition |
| ----- | ----- |
| **BR-154** | Quiz gắn vào Module hoặc gắn vào Course. |
| **BR-291** | Trong cây chương trình, Quiz gắn vào Module hiển thị sau toàn bộ Lesson của Module đó; Quiz gắn vào Course và các Assignment hiển thị ở cuối cây chương trình. Instructor sắp thứ tự giữa các Quiz và Assignment trong cùng một vị trí gắn, nhưng không đặt được Quiz xen giữa hai Lesson. Lý do: Quiz và Assignment thuộc một service khác với cấu trúc chương trình; cho xen kẽ sẽ đòi một thứ tự chung giữa hai service. |
| **BR-155** | Câu hỏi Quiz có ba dạng, đều được chấm tự động: trắc nghiệm một đáp án, trắc nghiệm nhiều đáp án, và đúng/sai. |
| **BR-156** | Cấu hình một Quiz gồm: thời gian giới hạn, điểm đạt tối thiểu, số lượt liên tiếp tối đa (n), thời gian tạm khóa (m giờ), và cờ bắt buộc / không bắt buộc. |
| **BR-157** | Quiz giữ cờ bắt buộc, khác với Assignment. Lý do: Quiz có thể được dùng làm bài tự kiểm tra kiến thức giữa các Module, không nhất thiết tính vào điều kiện cấp Certificate. Phải nêu lý do này trong tài liệu, nếu không hệ thống sẽ có hai quy tắc khác nhau cho hai loại Assessment mà không giải thích được. |
| **BR-158** | Hệ thống chấm tự động và trả kết quả ngay sau khi Learner nộp. |
| **BR-159** | Điểm ghi nhận của một Quiz là điểm của lượt làm bài cao nhất. |
| **BR-160** | Màn hình Quiz của Learner hiển thị nổi bật điểm ghi nhận hiện tại theo BR-159 cùng kết quả đạt hay chưa đạt; số lượt còn lại trước khi bị tạm khóa; và thời điểm được làm lại nếu đang bị tạm khóa. Lịch sử điểm từng lượt vẫn phải tra cứu được nhưng không cần hiển thị mặc định. |
| **BR-161** | Khi hết thời gian giới hạn, hệ thống tự động nộp bài với các câu đã trả lời và chấm theo BR-158. Lượt đó được tính vào số lượt liên tiếp (n) tại BR-176. Đồng hồ đếm theo thời gian thực và không dừng khi Learner thoát khỏi màn hình hoặc mất kết nối. |
| **BR-314** | Một lượt làm Quiz được tính là đã phát sinh ngay khi Learner bắt đầu lượt đó: nó được tính vào số lượt liên tiếp tại BR-176 và là dữ liệu học tập theo BR-119, BR-131 và BR-307. Mỗi Learner có tối đa một lượt đang làm trên mỗi Quiz. Tạm khóa bắt đầu tại thời điểm nộp lượt thứ n, kể cả khi lượt đó tự nộp vì hết giờ. Lý do: lượt đã bắt đầu thì chắc chắn kết thúc theo BR-161; nếu chỉ tính khi nộp thì Learner có thể mở nhiều lượt cùng lúc để vượt quá n. |
| **BR-315** | Điểm Quiz, điểm Assignment và điểm đạt tối thiểu dùng thang 0–100, làm tròn 2 chữ số thập phân. Quiz: mọi câu có trọng số bằng nhau; một câu được tính đúng khi tập đáp án đã chọn trùng khớp tập đáp án đúng, không có điểm từng phần; điểm lượt \= số câu đúng ÷ tổng số câu × 100\. Assignment: mỗi tiêu chí Rubric có điểm tối đa là số nguyên dương; điểm của một lượt đánh giá \= tổng điểm các tiêu chí ÷ tổng điểm tối đa × 100\. |

# **11\. ASSIGNMENT**

| ID | Rule Definition |
| ----- | ----- |
| **BR-162** | Assignment gắn vào Course. |
| **BR-163** | Cấu hình một Assignment gồm: đề bài, Rubric, điểm đạt tối thiểu, thời lượng dự kiến thực hiện, số lượt nộp liên tiếp tối đa (n), thời gian tạm khóa (m giờ), và cấu hình chấm chéo. |
| **BR-164** | Rubric là bắt buộc với mọi Assignment, không phụ thuộc việc có bật chấm chéo hay không. Rubric là căn cứ chấm, không phải công cụ riêng của chấm chéo. |
| **BR-165** | Assignment không có cờ bắt buộc. Mọi Assignment đều là căn cứ đánh giá để cấp Certificate. Lý do: Assignment là sản phẩm nộp có chấm điểm, khác với Quiz vốn có thể chỉ để tự kiểm tra. |
| **BR-166** | Assignment không có thời hạn nộp bài riêng. Việc kiểm soát nộp bài do cặp tham số n lượt / m giờ đảm nhiệm, kết hợp với chu kỳ chấm chéo tại Mục 13\. |
| **BR-167** | Learner nộp bài lúc nào thì bài rơi vào chu kỳ chấm chéo đang mở tại thời điểm đó. |
| **BR-168** | Learner nộp lại bài không giới hạn tổng số lần, cả trước và sau khi có kết quả chấm, cho tới khi Enrollment chuyển sang Completed. |
| **BR-169** | Khi Enrollment chuyển sang Completed, mọi Quiz và Assignment của Course đó chuyển sang chỉ đọc đối với Learner: không nộp lại, không làm lại. |
| **BR-325** | Khi Enrollment chuyển sang Completed, lượt làm Quiz đã bắt đầu trước thời điểm đó được làm tiếp tới hết thời gian giới hạn và được chấm bình thường, nhưng không làm thay đổi bản chốt điểm theo BR-219. Learner không bắt đầu được lượt mới và không nộp được bài mới (BR-169), nhưng vẫn hoàn thành được các lượt chấm chéo đã được phân công. Lý do: cắt ngang lượt đang làm thì Learner mất bài làm; và bài của những Learner khác đang chờ các lượt chấm này, nếu chặn thì bài của họ phải chuyển cho Instructor. |
| **BR-170** | Điểm ghi nhận của một Assignment là điểm của lượt nộp gần nhất. |
| **BR-171** | Bài nộp lại thay thế bài nộp trước trong cùng một chu kỳ, nếu chu kỳ đó chưa tới mốc chốt. Nếu chu kỳ chứa bài nộp trước đã qua mốc chốt, bài nộp lại không đi vào bất kỳ chu kỳ chấm chéo nào; Instructor chấm trực tiếp. Ngoại lệ: bài nộp lại của Learner đang nợ nghĩa vụ chấm chéo theo BR-313. |
| **BR-172** | Thời lượng dự kiến thực hiện của Assignment dùng vào hai việc: hiển thị cho Learner ước lượng công sức trước khi bắt tay vào làm, và cộng vào thời lượng ước tính của Course theo công thức tại BR-51. |
| **BR-173** | Thuộc tính này luôn sửa được, kể cả khi Course đã Locked, vì nó chỉ phục vụ hiển thị và ước tính, không phải căn cứ tính kết quả học tập. Đây là ngoại lệ so với các thuộc tính khác của Assignment tại BR-98. |
| **BR-174** | Đơn vị lưu là phút, hiển thị quy đổi ra giờ, để đồng đơn vị với thời lượng video khi cộng vào công thức. |

# **12\. CƠ CHẾ n LƯỢT / m GIỜ**

| ID | Rule Definition |
| ----- | ----- |
| **BR-175** | Mỗi Quiz và mỗi Assignment có hai tham số: n là số lượt liên tiếp tối đa, m là thời gian tạm khóa tính bằng giờ. |
| **BR-176** | Learner làm hoặc nộp đủ n lượt liên tiếp thì Assessment đó chuyển sang trạng thái tạm khóa trong m giờ, không phụ thuộc việc đã đạt điểm tối thiểu hay chưa. Hết m giờ thì mở lại và đếm lại từ đầu. |
| **BR-177** | Không giới hạn tổng số lượt. Learner cứ làm lại đến khi đạt. |
| **BR-178** | Tạm khóa áp dụng cho riêng từng Learner, không phải khóa cả Assessment với mọi người. |
| **BR-179** | Màn hình của Learner phải hiển thị thời điểm được làm lại. Thiếu thông tin này, Learner sẽ tưởng hệ thống bị lỗi. |
| **BR-180** | Hệ thống bỏ hẳn tham số "số lần làm lại tối đa". Giữ cả hai cơ chế cùng lúc sẽ mâu thuẫn. |
| **BR-181** | Cơ chế này cũng thay thế Use Case "Mở lượt nộp lại" của Instructor trong bản cũ: Learner tự nộp lại được, Instructor không phải mở từng lượt cho từng người. |

# **13\. CHU KỲ CHẤM CHÉO (PEER REVIEW)**

## **13.1. Ai thiết lập và dựa vào đâu**

| ID | Rule Definition |
| ----- | ----- |
| **BR-182** | Instructor là người bật chấm chéo và cấu hình chu kỳ, thực hiện cùng lúc khi cấu hình Assignment. Đây là quyết định về cách vận hành lớp học, thuộc người phụ trách chuyên môn, không thuộc Organizer. |
| **BR-183** | Cấu hình chấm chéo gồm bốn tham số: số người đánh giá mỗi bài, độ dài chu kỳ, thời hạn hoàn thành đánh giá, và ngưỡng chênh lệch điểm để chuyển bài cho Instructor xem xét lại. |
| **BR-184** | Căn cứ chọn độ dài chu kỳ là tần suất nộp bài dự kiến. Nguyên tắc: chu kỳ phải đủ dài để gom được ít nhất (số người đánh giá \+ 1\) bài nộp. |
| **BR-185** | Bật hoặc tắt chấm chéo chỉ thực hiện được khi Course chưa Locked. |

## **13.2. Ba mốc thời gian của một chu kỳ**

| BR-186 | Mỗi chu kỳ có đúng ba mốc: (1) ngày mở chu kỳ, (2) ngày chốt chu kỳ và phân công bài chấm, (3) hạn hoàn thành đánh giá. |
| :---- | :---- |
| **BR-187** | Hạn hoàn thành đánh giá đếm từ ngày chốt chu kỳ, không đếm từ lúc Learner nộp bài. |
| **BR-188** | Chu kỳ chạy theo lịch định kỳ, độc lập với thời điểm nộp bài của từng Learner. Chu kỳ mới mở ngay sau khi chu kỳ trước kết thúc. |
| **BR-312** | Chu kỳ chấm chéo đầu tiên của một Assignment mở tại thời điểm bắt đầu ngày, theo múi giờ Organization, của bài nộp đầu tiên đi vào chấm chéo. Mốc chốt là thời điểm kết thúc ngày thứ L tính từ ngày mở, với L là độ dài chu kỳ. Hạn hoàn thành đánh giá là thời điểm kết thúc ngày thứ D sau ngày chốt, với D là thời hạn hoàn thành đánh giá. Cả hai mốc tính theo lịch và múi giờ của Organization tại thời điểm tạo chu kỳ. Chu kỳ kế tiếp mở đúng tại mốc chốt của chu kỳ trước. Khoảng thời gian không có bài nộp không sinh chu kỳ; bài nộp tiếp theo rơi vào chu kỳ nào của lưới lịch trên chứa thời điểm nộp. Lý do: nếu "kết thúc" tại BR-188 là hạn đánh giá thì bài nộp giữa mốc chốt và hạn đánh giá không thuộc chu kỳ nào, trái BR-167. |

## **13.4. Cách Learner biết mình được phân công chấm**

| BR-189 | Hệ thống dùng đồng thời ba kênh, không chỉ một: thông báo trong hệ thống và email tại thời điểm chốt chu kỳ, ghi rõ số bài cần chấm và hạn chót; nhắc lại khi còn 24 giờ mà chưa chấm xong; và chỉ báo số bài đang chờ trên màn hình "Xem bài cần chấm" để Learner vào hệ thống là thấy ngay. |
| :---- | :---- |

## **13.5. Ẩn danh**

| BR-190 | Trong chấm chéo, danh tính tác giả bài làm không hiển thị cho người đánh giá. |
| :---- | :---- |
| **BR-191** | Danh tính người đánh giá không hiển thị cho tác giả bài làm khi xem kết quả chấm. |
| **BR-192** | Instructor thấy đầy đủ danh tính của cả hai phía. Ẩn danh là để tránh thiên vị giữa người học với nhau, không phải để che thông tin khỏi người chịu trách nhiệm chuyên môn. |

## **13.6. Ba tầng xử lý người bỏ chấm**

| BR-193 | Tầng 1 — hệ quả với chính người bỏ chấm. Hoàn thành nghĩa vụ chấm chéo là một phần điều kiện hoàn thành Assessment. Không chấm thì bản thân họ chưa hoàn thành Assessment đó, dù bài nộp của họ được điểm cao. Đây là cơ chế răn đe tự nhiên và đủ mạnh, không cần thêm hình phạt. |
| :---- | :---- |
| **BR-194** | Tầng 2 — hệ quả với bài bị bỏ rơi. Hết hạn đánh giá, Instructor chấm thay phần còn thiếu. |
| **BR-195** | Tầng 3 — cơ hội sửa sai. Người bỏ chấm ở chu kỳ trước, nếu nộp lại bài, được đưa vào chu kỳ đang mở theo BR-313 và bù nghĩa vụ bằng cách chấm đủ các bài được phân công ở chu kỳ đó. Việc bù nghĩa vụ nằm trong tập tại BR-202, không phải ngoại lệ của tập đó. Người không nộp lại bài thì đường bù nghĩa vụ là BR-196 và BR-316. |
| **BR-313** | Learner đang nợ nghĩa vụ chấm chéo của một Assignment (đã bỏ chấm ở chu kỳ trước và chưa được miễn) nộp lại bài thì bài nộp lại đi vào chu kỳ đang mở; đây là ngoại lệ của vế sau BR-171. Nghĩa vụ đã bỏ lỡ được coi là hoàn thành khi Learner chấm đủ các bài được phân công ở chu kỳ đó. Bỏ cụm "được xếp vào vị trí nhận bài sớm" tại BR-195, vì theo BR-203 mọi vị trí đều nhận đúng N bài. Lý do: không có ngoại lệ này thì BR-195 không bao giờ xảy ra, và đường ra duy nhất của người bỏ chấm là được Instructor miễn nghĩa vụ. |
| **BR-196** | Nếu Assignment không còn chu kỳ nào đủ điều kiện chấm chéo để bù nghĩa vụ, Instructor miễn nghĩa vụ chấm chéo cho trường hợp đó. Điều kiện "không còn chu kỳ nào đủ điều kiện" được thay bằng BR-316. |
| **BR-316** | Instructor miễn được nghĩa vụ chấm chéo cho một Learner đang nợ nghĩa vụ trên một Assignment vào bất kỳ lúc nào; quy tắc này thay cho điều kiện "không còn chu kỳ nào đủ điều kiện" tại BR-196. Lý do: chu kỳ chạy theo lịch không có điểm dừng nên hệ thống không xác định được điều kiện đó; và Learner có thể lỡ hạn đánh giá vì Organization bị tạm khóa, Subscription Suspended hoặc Course bị vô hiệu hóa, là những việc ngoài tầm kiểm soát của họ (nguyên tắc 20.1), nên cần một đường ra không phụ thuộc việc nộp lại bài theo BR-313. |

## **13.7. Ba trường hợp bài thiếu lượt chấm**

| BR-197 | Trường hợp 1 — chu kỳ không đủ bài nộp, tức ít hơn (số người đánh giá \+ 1). Hệ thống không phân công chấm chéo; Instructor chấm toàn bộ chu kỳ đó. |
| :---- | :---- |
| **BR-198** | Trường hợp 2 — đủ bài nhưng một số người bỏ chấm. Hết hạn, Instructor chấm bù phần còn thiếu. Điểm tổng hợp tính trên các điểm hợp lệ đã có cộng điểm của Instructor. |
| **BR-199** | Trường hợp 3 — người chấm bị vô hiệu hóa tài khoản giữa chu kỳ. Hệ thống loại phân công của người đó và chuyển bài sang Instructor. |
| **BR-317** | Phân công chấm bị loại theo BR-39 không tính là bỏ chấm đối với người được phân công. Lý do: vô hiệu hóa tài khoản là quyết định của Organizer (nguyên tắc 20.1); nếu tính là bỏ chấm thì Learner được kích hoạt lại phải bù một nghĩa vụ không do họ bỏ. |

## **13.8. Theo dõi chu kỳ**

| BR-200 | Instructor xem được danh sách các chu kỳ của một Assignment, mỗi chu kỳ kèm ba mốc thời gian, số bài nộp trong chu kỳ và tình trạng xử lý. |
| :---- | :---- |
| **BR-201** | Instructor xem được tiến độ chấm của một chu kỳ: số bài đã được chấm đủ, số bài còn thiếu người đánh giá, và số người đánh giá chưa hoàn thành nghĩa vụ. |

## **13.9. Tập người đánh giá và thuật toán phân công**

| BR-202 | Tập người đánh giá của một chu kỳ là những Learner đã nộp bài trong chính chu kỳ đó. Người không nộp bài trong chu kỳ không được phân công chấm ở chu kỳ đó. |
| :---- | :---- |
| **BR-203** | Tại thời điểm chốt chu kỳ, hệ thống sinh một hoán vị ngẫu nhiên của tập người đánh giá tại BR-202 và lưu hoán vị đó cùng bản ghi chu kỳ. Vòng gán được lập theo hoán vị này, không theo thứ tự nộp bài: bài của người ở vị trí i trong hoán vị được gán cho người ở vị trí (i+1), (i+2), …, (i+N) tính theo vòng, với N là số người đánh giá mỗi bài. |

# **14\. CHẤM ĐIỂM VÀ CHỐT KẾT QUẢ**

| ID | Rule Definition |
| ----- | ----- |
| **BR-204** | Instructor là người chốt điểm cuối cùng trong mọi trường hợp, kể cả khi bài đã được chấm chéo đầy đủ. |
| **BR-205** | Điểm tổng hợp từ chấm chéo là trung bình các điểm đánh giá hợp lệ. |
| **BR-206** | Instructor chấm trực tiếp một bài nộp trong năm tình huống: chấm chéo không được bật; số bài nộp trong chu kỳ nhỏ hơn (số người đánh giá \+ 1); người đánh giá không hoàn thành trong thời hạn; người đánh giá bị vô hiệu hóa tài khoản giữa chu kỳ; và chênh lệch điểm giữa các người đánh giá vượt ngưỡng cấu hình. |
| **BR-321** | Chênh lệch điểm tại BR-206 là hiệu giữa điểm cao nhất và điểm thấp nhất trong các điểm đánh giá hợp lệ của một bài nộp, tính trên thang 0–100 theo BR-315. Bài nộp chuyển cho Instructor xem xét lại khi hiệu này lớn hơn ngưỡng đã cấu hình. Lý do: BR-206 chưa định nghĩa "chênh lệch" khi có từ ba người đánh giá trở lên. |
| **BR-207** | Khi chốt điểm, Instructor xác nhận hoặc điều chỉnh điểm tổng hợp rồi công bố kết quả cho Learner. Hệ thống thông báo cho Learner. |
| **BR-322** | Khi chốt điểm một bài nộp, Instructor nhập điểm cuối cùng trên thang 0–100; giá trị gợi ý là điểm tổng hợp theo BR-205, trong đó lượt Instructor chấm trực tiếp được tính như một điểm đánh giá hợp lệ (BR-198). Điểm theo tiêu chí hiển thị cho Learner là trung bình theo từng tiêu chí của các lượt đánh giá hợp lệ. Nếu điểm cuối cùng khác điểm tổng hợp, Instructor bắt buộc ghi nhận xét giải thích. Lý do: BR-207 cho phép điều chỉnh nhưng không nói điều chỉnh ở mức nào; ghi nhận xét bắt buộc để Learner hiểu vì sao điểm khác các tiêu chí, giảm khiếu nại. |
| **BR-208** | Learner xem được điểm cuối cùng, điểm theo từng tiêu chí của Rubric và nhận xét của người chấm. |
| **BR-324** | Một lượt đánh giá, của Learner hay của Instructor, chỉ được ghi nhận khi có điểm cho mọi tiêu chí của Rubric và một nhận xét chung không rỗng. Điểm mỗi tiêu chí là số nguyên từ 0 đến điểm tối đa của tiêu chí đó. Lý do: BR-208 cam kết Learner xem được điểm theo tiêu chí và nhận xét; một lượt chấm thiếu tiêu chí thì không tính được điểm theo BR-315. |
| **BR-209** | Instructor xem được nội dung bài làm, tệp đính kèm, thời điểm nộp, và toàn bộ điểm cùng nhận xét của từng người đánh giá — không chỉ điểm tổng hợp. |
| **BR-210** | Màn hình danh sách bài nộp đánh dấu rõ các bài cần can thiệp, để Instructor không phải tự rà từng bài. |

# **15\. CHỨNG NHẬN HOÀN THÀNH (CERTIFICATE)**

| ID | Rule Definition |
| ----- | ----- |
| **BR-211** | Điều kiện cấp Certificate: hoàn thành toàn bộ thành phần bắt buộc của Course, gồm học liệu bắt buộc, Quiz bắt buộc đạt điểm tối thiểu, và mọi Assignment đạt điểm tối thiểu. |
| **BR-212** | Khi Assignment có bật chấm chéo, điều kiện hoàn thành Assessment đó bao gồm cả việc hoàn thành nghĩa vụ chấm chéo được phân công. |
| **BR-213** | Mỗi Learner có nhiều nhất một Certificate trên mỗi phiên bản Course. |
| **BR-214** | Certificate ghi: người được cấp, Course và phiên bản, ngày cấp, và mã định danh. |
| **BR-331** | Mã định danh Certificate là 12 ký tự ngẫu nhiên thuộc bảng chữ Crockford Base32, hiển thị dạng XXXX-XXXX-XXXX, duy nhất trên toàn nền tảng và không suy ra được từ Learner, Course hay thứ tự cấp. MVP không có trang tra cứu công khai; Organizer xác minh một Certificate bằng bộ lọc mã định danh tại BR-230. Lý do: mã ngẫu nhiên không đoán được mã của người khác như mã tăng dần; duy nhất toàn nền tảng để bổ sung tra cứu công khai về sau mà không phải cấp lại mã. |
| **BR-215** | Certificate ghi dấu hiệu hoàn thành sau hạn nếu Learner hoàn thành muộn hơn hạn được phân công. |
| **BR-216** | Learner tải được bản PDF của Certificate để lưu trữ hoặc xuất trình ngoài hệ thống. |
| **BR-217** | Certificate đã cấp được giữ lại ngay cả khi tài khoản Learner bị xóa, phục vụ lưu vết đào tạo của doanh nghiệp. |
| **BR-218** | Phiếu đánh giá hiệu quả đào tạo không ảnh hưởng tới việc cấp Certificate. |
| **BR-219** | Điểm dùng để xét điều kiện tại BR-211 được chốt tại thời điểm Enrollment chuyển sang Completed. Certificate tham chiếu bản chốt đó, không tham chiếu điểm hiện hành. |
| **BR-220** | Certificate là bản ghi bất biến. Mọi thông tin hiển thị trên Certificate — tên Learner, tên Course, số hiệu phiên bản, ngày cấp, mã định danh và dấu hiệu hoàn thành sau hạn — được chốt tại thời điểm cấp và không thay đổi theo bất kỳ chỉnh sửa nào phát sinh sau đó trên Course, học liệu hoặc Assessment. Bản PDF tại BR-216 được kết xuất từ bản ghi đã chốt này. |
| **BR-326** | Ngày cấp Certificate là thời điểm Enrollment chuyển sang Completed, không phải thời điểm hệ thống tạo xong bản ghi Certificate. Lý do: việc tạo Certificate có thể phải thử lại khi service khác tạm thời không phản hồi; lấy thời điểm hoàn thành làm ngày cấp để ngày trên Certificate không phụ thuộc độ trễ kỹ thuật và nhất quán với dấu hiệu hoàn thành sau hạn tại BR-215. |

# **16\. BÁO CÁO ĐÀO TẠO**

## **16.1. Phạm vi theo vai trò**

| ID | Rule Definition |
| ----- | ----- |
| **BR-221** | Organizer xem báo cáo trên phạm vi toàn Organization. |
| **BR-222** | Instructor xem báo cáo trong phạm vi các Course mình phụ trách. |
| **BR-223** | Admin xem thống kê ở cấp nền tảng, không đi vào dữ liệu học tập của từng Organization. |

## **16.2. Tách bạch tuân thủ và tự nguyện**

| BR-224 | Chỉ số tuân thủ đào tạo chỉ tính trên các Enrollment dạng Required. |
| :---- | :---- |
| **BR-225** | Enrollment dạng Optional được thống kê riêng như học tập tự nguyện, không làm ảnh hưởng số liệu tuân thủ. |

## **16.3. Nội dung báo cáo**

| BR-226 | Báo cáo tổng quan cho Organizer gồm: số Learner, số Course đang triển khai, tỉ lệ hoàn thành, số Certificate đã cấp và số trường hợp quá hạn. |
| :---- | :---- |
| **BR-333** | Tỉ lệ hoàn thành trong báo cáo được tính riêng cho Enrollment dạng Required (chỉ số tuân thủ) và dạng Optional (học tập tự nguyện), bằng số Enrollment Completed chia cho số Enrollment không ở trạng thái Withdrawn, Exempted hoặc Halted. Lý do: Withdrawn không còn nghĩa vụ; Exempted do Organizer miễn; Halted do Course bị vô hiệu hóa, không do Learner (nguyên tắc 20.1); đưa ba nhóm này vào mẫu số làm tỉ lệ tuân thủ thấp sai. Enrollment Exempted đã hoàn thành chuyển sang Completed theo BR-301 nên vẫn được tính ở tử số. |
| **BR-334** | Trong báo cáo tổng quan tại BR-226: "số Learner" là số tài khoản Learner chưa bị xóa của Organization; "số Course đang triển khai" là số chuỗi Course có phiên bản ở trạng thái Published. Hai chỉ số này phản ánh thời điểm xem và không chịu bộ lọc khoảng thời gian. |
| **BR-227** | Báo cáo theo Course gồm: số Learner đang học, số hoàn thành đúng hạn, số hoàn thành sau hạn, số quá hạn, số ở trạng thái Exempted, số ở trạng thái Halted và số đã rút. |
| **BR-228** | Báo cáo theo Learner gồm: các Course đang tham gia, tiến độ, kết quả Assessment và các Certificate đã nhận. |
| **BR-229** | Báo cáo theo phiên bản gồm: số Certificate đã cấp theo từng phiên bản trong một chuỗi Course, và danh sách Learner đang giữ Certificate của phiên bản không còn là bản hiện hành. |
| **BR-335** | Danh sách "Learner đang giữ Certificate của phiên bản không còn là bản hiện hành" tại BR-229 và BR-110 gồm những Learner có Certificate trong chuỗi nhưng chưa có Certificate của phiên bản hiện hành, và tài khoản chưa bị xóa. Mỗi Learner xuất hiện một lần, kèm phiên bản mới nhất mà họ đã hoàn thành. Lý do: danh sách là căn cứ quyết định phân công học lại (BR-110); người đã hoàn thành bản hiện hành hoặc đã rời tổ chức không cần phân công. |
| **BR-230** | Bộ lọc báo cáo gồm: khoảng thời gian, Course, loại Enrollment, đơn vị công tác, tình trạng hoàn thành và mã định danh Certificate. |
| **BR-329** | Bộ lọc khoảng thời gian tại BR-230 xét số liệu Enrollment theo ngày phân công với Enrollment dạng Required (kể cả Enrollment chuyển từ Optional) và theo ngày đăng ký với Enrollment dạng Optional; trạng thái được tính tại thời điểm xem. Số liệu Certificate xét theo ngày cấp. Ngày được hiểu theo múi giờ của Organization. Lý do: mọi số liệu Enrollment tính trên cùng một tập nên cộng lại khớp nhau; nghĩa vụ tuân thủ bắt đầu từ ngày phân công, không phải ngày tự đăng ký. |
| **BR-231** | Báo cáo kết xuất được ra tệp Excel hoặc PDF phục vụ lưu trữ và báo cáo nội bộ của doanh nghiệp. |
| **BR-330** | Tệp báo cáo kết xuất được lưu 7 ngày kể từ khi tạo xong rồi bị xóa; người dùng kết xuất lại khi cần. Tệp kết xuất không tính vào giới hạn dung lượng (BR-288). Lý do: tệp chứa dữ liệu cá nhân của người học, không nên nằm lâu trong kho lưu trữ; dữ liệu gốc vẫn còn nên kết xuất lại luôn được. |
| **BR-232** | Organizer vẫn kết xuất được báo cáo khi Subscription ở trạng thái Suspended, trong thời hạn quy định tại BR-17. |

# **17\. KIỂM DUYỆT NỘI DUNG VÀ CHẾ TÀI**

## **17.1. Gửi report**

| ID | Rule Definition |
| ----- | ----- |
| **BR-233** | Learner và Organizer gửi được report về một Lesson, học liệu, nội dung Quiz hoặc đề bài Assignment mà họ cho là vi phạm, kèm lý do. Instructor không thuộc nhóm này vì theo BR-79, Instructor không có đường tiếp cận nội dung của Course do người khác phụ trách. Organizer gửi report cả khi tự phát hiện vi phạm, vì việc vô hiệu hóa nội dung tại BR-239 chỉ thực hiện được trên nội dung đã có report được xác nhận vi phạm. |
| **BR-234** | Instructor tham gia luồng report với tư cách chủ nội dung bị xử lý, không phải người gửi. Đường khiếu nại của Instructor khi cho rằng quyết định của Organizer là sai là chuyển report lên Admin theo BR-254. Việc gửi yêu cầu xem xét lại theo BR-241 chỉ dùng khi Instructor đã chỉnh sửa xong nội dung và muốn được kích hoạt lại, không phải để phản đối quyết định. |
| **BR-235** | Report được tạo ở trạng thái Pending và có thời hạn xử lý theo tham số cấp nền tảng. |
| **BR-296** | Một người chỉ có tối đa một report đang chờ xử lý trên cùng một thành phần nội dung, tính cả report đã chuyển lên Admin mà Admin chưa quyết định. Người khác vẫn gửi được report của riêng mình về thành phần đó. Lý do: chặn việc gửi lặp để gây áp lực lên Instructor (BR-252), nhưng vẫn giữ được việc nhiều người cùng phản ánh một nội dung. |
| **BR-236** | Người gửi xem được các report do chính mình gửi kèm trạng thái xử lý và kết quả. |

## **17.2. Xử lý ở cấp Organization**

| BR-237 | Organizer ra quyết định trên một report: xác nhận vi phạm kèm mức độ Nhẹ hoặc Nghiêm trọng thì report chuyển Resolved; bác bỏ thì report chuyển Dismissed. |
| :---- | :---- |
| **BR-238** | Hệ thống thông báo kết quả cho cả người gửi và Instructor sở hữu nội dung, kèm lý do. |
| **BR-239** | Organizer vô hiệu hóa nội dung — một Lesson, học liệu, Quiz hoặc Assignment — đã được xác nhận vi phạm. |
| **BR-240** | Organizer gửi yêu cầu chỉnh sửa tới Instructor sở hữu nội dung, kèm nội dung cần khắc phục. |
| **BR-241** | Sau khi chỉnh sửa, Instructor gửi yêu cầu xem xét lại tới người đã ra quyết định. |
| **BR-242** | Organizer hoặc Admin kích hoạt lại nội dung hoặc Course bị vô hiệu hóa sau khi xác nhận vi phạm đã được khắc phục. |
| **BR-243** | Thành phần bị vô hiệu hóa theo BR-239 được loại khỏi điều kiện cấp Certificate tại BR-211 cho tới khi được kích hoạt lại theo BR-242. Thành phần bị loại không được đánh dấu là đã hoàn thành. Tiến độ hiển thị tính trên phần còn lại. Điểm đã ghi nhận của Quiz hoặc Assignment bị vô hiệu hóa vẫn được giữ nhưng không còn là điều kiện. |
| **BR-310** | Khi một thành phần bị vô hiệu hóa theo BR-239 làm một Enrollment chưa hoàn thành trở nên đủ điều kiện tại BR-211 trên phần còn lại, Enrollment đó chuyển sang Completed và được cấp Certificate ngay, không chờ Learner thao tác thêm. Áp dụng cho Enrollment ở NotStarted, InProgress và Exempted; Enrollment ở Halted được xét khi Organizer khôi phục theo BR-250. |
| **BR-244** | Khi thành phần được kích hoạt lại, nó quay lại điều kiện cấp Certificate đối với các Enrollment chưa hoàn thành. Enrollment đã hoàn thành và Certificate đã cấp trong thời gian thành phần bị vô hiệu hóa được giữ nguyên, theo BR-219. |
| **BR-245** | Nếu việc vô hiệu hóa làm Course không còn thành phần bắt buộc nào hoạt động, Course chuyển sang Disabled theo BR-248 thay vì tiếp tục cấp Certificate. Thành phần bắt buộc ở đây hiểu theo BR-211: học liệu bắt buộc, Quiz bắt buộc và mọi Assignment. |
| **BR-246** | Đường khắc phục nội dung vi phạm phân theo phạm vi Locked. Nếu nội dung vi phạm nằm trong nhóm thao tác luôn cho phép tại Mục 5.2, hoặc là Lesson chưa Learner nào hoàn thành theo BR-95, Instructor sửa tại chỗ rồi gửi yêu cầu xem xét lại theo BR-241. Nếu nội dung vi phạm nằm trong nhóm bị chặn tại Mục 5.3, đường duy nhất là tạo phiên bản mới theo BR-100. |
| **BR-247** | Khi khắc phục bằng phiên bản mới, việc phê duyệt phiên bản mới theo BR-105 thay thế luôn bước xem xét lại tại BR-241; không thực hiện hai vòng duyệt. Nội dung vi phạm trên phiên bản cũ vẫn bị vô hiệu hóa và vẫn được loại khỏi điều kiện cấp Certificate theo BR-243. |

## **17.3. Vô hiệu hóa Course và hệ quả với Learner**

| BR-248 | Organizer chuyển một Course sang trạng thái Disabled khi vi phạm ở mức Nghiêm trọng hoặc khi Instructor tái phạm. Learner không truy cập được nội dung. |
| :---- | :---- |
| **BR-249** | Toàn bộ Enrollment đang dở của Course đó tự động chuyển sang Halted, áp dụng cho cả Required lẫn Optional. Enrollment ở Halted không tính vào thống kê quá hạn và không truy cập được nội dung. |
| **BR-302** | "Enrollment đang dở" tại BR-249 gồm NotStarted, InProgress và Overdue. Enrollment ở Exempted giữ nguyên Exempted khi Course bị vô hiệu hóa; nếu Organizer gỡ Exempted trong lúc Course còn Disabled thì Enrollment chuyển sang Halted thay vì tính lại theo BR-123. |
| **BR-250** | Enrollment ở Halted không tự động khôi phục khi Course được kích hoạt lại. Organizer quyết định có khôi phục hay không; khi khôi phục, trạng thái được tính lại theo tiến độ thực tế và hạn được dời theo BR-124. |
| **BR-303** | Organizer khôi phục Enrollment ở Halted theo BR-250 chỉ khi phiên bản Course đã quay lại Published. Nếu phiên bản đó giữ Disabled vì đã có phiên bản mới được duyệt theo BR-106, Organizer chuyển Enrollment ở Halted sang Withdrawn; Learner muốn học tiếp thì được phân công hoặc tự đăng ký phiên bản hiện hành. Hai thao tác thực hiện qua UC24.8. Lý do: không có đường ra này thì Enrollment kẹt ở Halted vĩnh viễn và chặn việc giải phóng học liệu theo BR-75, trái nguyên tắc 20.2. |

## **17.4. Theo dõi vi phạm**

| BR-251 | Hệ thống hiển thị số vi phạm đã được xác nhận của từng Instructor kèm mức độ và thời điểm, và cảnh báo khi vượt ngưỡng cấu hình. |
| :---- | :---- |
| **BR-297** | Vi phạm được tính cho Instructor phụ trách Course tại thời điểm report được tạo, không phải tại thời điểm ra quyết định. Nếu quyền phụ trách được chuyển theo BR-76 trong lúc report còn chờ xử lý, thông báo kết quả theo BR-238 gửi tới cả Instructor đã được ghi nhận lúc tạo report và Instructor đang phụ trách; yêu cầu chỉnh sửa theo BR-240 chỉ gửi tới Instructor đang phụ trách, vì chỉ người này còn quyền sửa nội dung. |
| **BR-252** | Số liệu vi phạm chỉ hỗ trợ ra quyết định; hệ thống không tự động áp dụng chế tài. Lý do: report là dữ liệu do người dùng tạo ra, có thể bị lạm dụng để công kích một Instructor. Quyết định chế tài phải qua người. |

## **17.5. Chuyển lên cấp nền tảng**

| BR-253 | Escalate nghĩa là chuyển một vụ việc lên cấp có thẩm quyền cao hơn khi cấp hiện tại không xử lý được hoặc không được phép xử lý. |
| :---- | :---- |
| **BR-254** | Ba trường hợp report lên tới Admin: người gửi không đồng ý với quyết định của Organizer và chủ động chuyển cấp; Instructor sở hữu nội dung bị xử lý không đồng ý với quyết định của Organizer và chủ động chuyển cấp; và report quá thời hạn xử lý mà Organization chưa giải quyết. |
| **BR-295** | Việc chuyển report lên Admin theo hai trường hợp đầu của BR-254 chỉ thực hiện được sau khi Organizer đã ra quyết định, và mỗi report chỉ được chuyển lên Admin một lần. Khi người gửi hoặc Instructor sở hữu nội dung đã chuyển cấp, bên còn lại không chuyển cấp thêm được. Report đã lên Admin do quá thời hạn xử lý không có bước khiếu nại. Việc chuyển cấp không giới hạn thời gian. Quyết định của Admin là quyết định cuối cùng theo BR-255. |
| **BR-255** | Admin ra quyết định cuối cùng: xác nhận vi phạm và vô hiệu hóa nội dung hoặc Course thì report chuyển Resolved; xác định không vi phạm thì chuyển Dismissed. Hệ thống thông báo cho người gửi và Instructor sở hữu nội dung. |
| **BR-294** | Khi Admin xác định không vi phạm trên một report mà Organizer đã xác nhận vi phạm, mọi thành phần nội dung đã bị vô hiệu hóa theo report đó được kích hoạt lại ngay trong thao tác ra quyết định của Admin, và vi phạm không còn được tính cho Instructor theo BR-251. Course đã chuyển sang Disabled không tự kích hoạt lại; Admin xét kích hoạt lại Course theo BR-242. Enrollment ở trạng thái Halted xử lý theo BR-250. |
| **BR-256** | Admin xem được quyết định trước đó của Organizer khi xử lý một report đã qua cấp Organization. |

# **18\. ĐÁNH GIÁ HIỆU QUẢ ĐÀO TẠO**

| ID | Rule Definition |
| ----- | ----- |
| **BR-257** | Phiếu đánh giá tự động mở sau khi Learner hoàn thành Course. |
| **BR-258** | Phiếu có thời hạn thực hiện theo tham số cấp nền tảng. |
| **BR-259** | Bộ tiêu chí cố định của hệ thống, gồm ba tiêu chí: mức độ hữu ích của nội dung, độ khó phù hợp, chất lượng học liệu; kèm một phần nhận xét tự do. |
| **BR-332** | Mỗi tiêu chí tại BR-259 chấm theo thang số nguyên 1–5 và bắt buộc cả ba tiêu chí; nhận xét tự do không bắt buộc, tối đa 2000 ký tự. Lý do: BR-259 chưa quy định thang điểm; thang 5 mức đủ phân biệt mà không làm Learner mất thời gian cân nhắc. |
| **BR-260** | Learner được bỏ qua phiếu đánh giá. Phiếu không ảnh hưởng tới việc cấp Certificate. |
| **BR-261** | Phiếu là ẩn danh: hệ thống chỉ ghi nhận Learner đã thực hiện để tránh gửi trùng, không gắn danh tính vào nội dung phiếu. |
| **BR-262** | Learner xem lại và chỉnh sửa được phiếu của mình trong thời hạn phiếu còn mở. Hết hạn thì phiếu chốt lại, không sửa được nữa. Quy tắc này được thay bằng BR-327. |
| **BR-327** | Sau khi gửi, Learner không xem lại và không chỉnh sửa được nội dung phiếu đánh giá; hệ thống chỉ cho Learner biết phiếu đã được gửi. Quy tắc này thay cho BR-262. Lý do: xem lại hoặc chỉnh sửa đòi hỏi hệ thống biết nội dung nào thuộc về Learner nào, tức là giữ đúng liên kết giữa danh tính và nội dung mà BR-261 cấm và BR-263 đã dùng làm lý do từ chối chức năng xóa phiếu. |
| **BR-263** | Hệ thống không hỗ trợ xóa phiếu. Lý do: xóa đòi hỏi giữ liên kết giữa danh tính và nội dung, làm mất chính tính ẩn danh tại BR-261. |
| **BR-264** | Organizer và Instructor xem được: điểm trung bình theo từng tiêu chí, số lượt đánh giá, và tỉ lệ Learner đã hoàn thành phiếu. |
| **BR-328** | Kết quả đánh giá của một phiên bản Course — điểm trung bình, phân bố điểm và nhận xét tự do — chỉ hiển thị và chỉ được kết xuất khi phiên bản đó có từ 5 phiếu đã gửi trở lên; dưới ngưỡng, hệ thống chỉ hiển thị tỉ lệ Learner đã hoàn thành phiếu. Khi đối chiếu giữa các phiên bản, ngưỡng áp dụng cho từng phiên bản. Kết quả đánh giá không lọc được theo đơn vị công tác, theo Learner hay theo khoảng thời gian, và nhận xét không hiển thị theo thứ tự gửi. Lý do: với ít phiếu, người xem đối chiếu được nội dung với số ít Learner đã hoàn thành Course, phá tính ẩn danh tại BR-261 và nguyên tắc 20.6. |
| **BR-265** | Kết quả xem được theo từng phiên bản Course và đối chiếu giữa các phiên bản trong cùng chuỗi. Đây là cách doanh nghiệp biết phiên bản mới có thực sự tốt hơn phiên bản cũ hay không. |
| **BR-266** | Nhận xét tự do hiển thị đã tách hoàn toàn khỏi danh tính người gửi. |
| **BR-267** | Kết quả đánh giá kết xuất được ra tệp Excel hoặc PDF. |

# **19\. THAM SỐ CẤP NỀN TẢNG**

| ID | Rule Definition |
| ----- | ----- |
| **BR-268** | Các tham số dưới đây do Admin quản lý và áp dụng cho mọi Organization. Đây là những giá trị mà nhóm cố ý không hard-code, để điều chỉnh được khi vận hành mà không phải sửa mã nguồn. |

| Tham số | Ghi chú |
| ----- | ----- |
| Thời hạn hiệu lực đăng ký chờ thanh toán | Đã chốt mặc định 7 ngày, đủ cho quy trình duyệt thanh toán nội bộ của doanh nghiệp. Quá hạn thì hủy cả đăng ký lẫn tài khoản Organizer chưa kích hoạt |
| Thời gian ân hạn Subscription | Đã chốt 7 ngày. Trong thời gian này Learner vẫn học tiếp |
| Thời hạn Organizer còn kết xuất được báo cáo sau khi Suspended | Đã chốt 30 ngày. Learner và Instructor mất quyền truy cập ngay; Organizer còn chế độ chỉ xem và kết xuất báo cáo. Đây không phải lịch xóa dữ liệu |
| Ngưỡng cảnh báo mức sử dụng | Đã chốt mặc định 80% mức giới hạn. Áp dụng cho cả bốn giới hạn của gói |
| Tốc độ đọc chuẩn | Đã chốt mặc định 200 từ mỗi phút, sẽ hiệu chỉnh sau khi thử trên tài liệu thật. Quy đổi số từ của tài liệu Reading ra thời lượng ước tính |
| Số giờ học quy ước mỗi ngày | Đã chốt mặc định 1 giờ. Quy đổi số ngày hoàn thành dự kiến ra sức chứa tính bằng giờ, để đối chiếu được với thời lượng ước tính (BR-54) |
| Ngưỡng chênh lệch thời lượng | Đã chốt mặc định 20%. Mốc kích hoạt cảnh báo tại BR-55 |
| Tỉ lệ xem video tối thiểu | Đã chốt mặc định 90% thời lượng video. Mốc hệ thống tự đánh dấu hoàn thành học liệu Video |
| Thời hạn xử lý report | Đã chốt mặc định 7 ngày. Quá hạn thì report được chuyển lên Admin |
| Ngưỡng số vi phạm của Instructor | Đã chốt mặc định 3 vi phạm. Chỉ dùng để cảnh báo, không tự động áp chế tài |
| Thời hạn thực hiện phiếu đánh giá | Đã chốt mặc định 14 ngày. Hết hạn thì phiếu đóng, Learner không gửi được nữa (BR-327) |
| Độ dài chu kỳ chấm chéo mặc định | Đã chốt mặc định 7 ngày. Instructor ghi đè được cho từng Assignment |
| Thời hạn hoàn thành đánh giá mặc định | Đã chốt mặc định 3 ngày, đếm từ ngày chốt chu kỳ |
| Mốc nhắc trước hạn đánh giá | Đã chốt 24 giờ |
| Số lượt liên tiếp tối đa (n) mặc định | Đã chốt mặc định 3 lượt. Giá trị mặc định cho Assessment. Instructor ghi đè được |
| Thời gian tạm khóa (m giờ) mặc định | Đã chốt mặc định 24 giờ. Giá trị mặc định cho Assessment. Instructor ghi đè được |
| Giới hạn kỹ thuật khi upload học liệu | Tách theo loại học liệu. Video: dung lượng tối đa 2 GB, thời lượng tối đa 120 phút, định dạng MP4. Reading: dung lượng tối đa 50 MB, định dạng PDF. Các giá trị trên là mặc định đã chốt |
| Số lần gửi lại thư đăng ký tối đa | Đã chốt mặc định 5 lần. Giới hạn chung cho BR-32 và BR-276, đếm theo email trong 24 giờ gần nhất, chống lạm dụng gửi thư hàng loạt |
| Thời hạn hiệu lực mã xác thực email | Đã chốt mặc định 10 phút. Đủ để mở hộp thư và nhập mã ngay trong phiên đăng ký; ngắn để một mã bị lộ không dùng được lâu (BR-337) |
| Số lần nhập sai mã xác thực tối đa | Đã chốt mặc định 5 lần cho mỗi mã. Cùng giới hạn gửi lại, giữ xác suất dò trúng mã trong 24 giờ không quá 0,003% (BR-337) |
| Thời hạn hiệu lực lời mời | Đã chốt mặc định 7 ngày. Áp cho lời mời Instructor, Learner và Organizer thay thế (BR-278) |
| Các mốc nhắc trước khi Subscription hết hạn | Đã chốt mặc định 7 ngày và 1 ngày trước ngày hết hạn. Chỉ áp cho thông báo tới Organizer; Learner được nhắc tải Certificate khi Subscription chuyển sang thời gian ân hạn (BR-18) |

| BR-269 | Thay đổi tham số chỉ áp dụng cho dữ liệu phát sinh sau đó. Hệ thống không tính lại các kết quả, trạng thái và thời hạn đã ghi nhận. |
| :---- | :---- |

# **19A. GHI NHẬN HÀNH ĐỘNG**

| ID | Rule Definition |
| ----- | ----- |
| **BR-270** | Hệ thống ghi nhận các hành động trong danh sách dưới đây. Mỗi bản ghi gồm: người thực hiện, loại hành động, đối tượng tác động, thời điểm, và lý do khi quy tắc tương ứng yêu cầu. |

Danh sách hành động phải ghi nhận:

* Chỉnh sửa và ngừng cung cấp Plan (BR-2, BR-3)  
* Tạm khóa và gỡ tạm khóa Organization (BR-45, BR-47)  
* Thay Organizer (BR-40)  
* Vô hiệu hóa và xóa tài khoản, kèm việc chuyển quyền phụ trách đi kèm (BR-36, BR-37, BR-41)  
* Phê duyệt và từ chối Course (BR-68)  
* Đổi courseType (BR-60)  
* Chuyển quyền phụ trách Course (BR-76)  
* Thay tệp học liệu bị lỗi kỹ thuật (BR-87, BR-104)  
* Giải phóng học liệu của phiên bản Archived (BR-75)  
* Đánh dấu và gỡ trạng thái Exempted (BR-120, BR-123)  
* Điều chỉnh hạn hoàn thành (BR-139)  
* Quyết định trên report (BR-237, BR-255)  
* Vô hiệu hóa và kích hoạt lại nội dung hoặc Course (BR-239, BR-242, BR-248)  
* Chốt điểm và điều chỉnh điểm tổng hợp (BR-207)

| BR-271 | Lý do là bắt buộc với các hành động mà bên bị ảnh hưởng nhận được thông báo: tạm khóa Organization, vô hiệu hóa nội dung hoặc Course, từ chối Course, đánh dấu Exempted, thay Organizer. Với các hành động còn lại, lý do là tùy chọn. |
| :---- | :---- |
| **BR-272** | MVP chỉ thực hiện việc ghi nhận và một màn hình xem danh sách có lọc theo đối tượng tác động và khoảng thời gian. Không kết xuất tệp, không so sánh giá trị trước và sau. |
| **BR-273** | Phạm vi xem nhật ký theo vai trò: Organizer xem các hành động phát sinh trong Organization của mình; Admin xem các hành động ở cấp nền tảng và các hành động tác động lên Organization. Instructor và Learner không xem nhật ký. |

# **20\. NGUYÊN TẮC XUYÊN SUỐT**

Bảy nguyên tắc dưới đây không phải quy tắc của một chức năng cụ thể. Chúng là các quyết định thiết kế lặp lại ở nhiều chỗ, và là thứ nhóm nên thuộc để trả lời khi bị hỏi "tại sao lại làm như vậy".

## **20.1. Learner không chịu hậu quả từ quyết định ở cấp trên họ**

Learner không gây ra và không kiểm soát được các quyết định ở cấp tổ chức hay cấp nền tảng, nên hệ thống không để những quyết định đó làm xấu hồ sơ học tập của họ. Nguyên tắc này được áp dụng ở năm chỗ: Course bị vô hiệu hóa thì Enrollment chuyển sang Halted và không tính quá hạn (BR-249); Organization bị tạm khóa thì hạn hoàn thành được dời tương ứng (BR-47); thời gian Enrollment ở Exempted hoặc Halted cũng được dời vào hạn (BR-124); Subscription hết hạn thì có ân hạn truy cập trước khi cắt (BR-15); tài khoản bị vô hiệu hóa thì Enrollment không tính vào thống kê quá hạn (BR-38).

## **20.2. Có đường vào thì phải có đường ra**

Mỗi khi tài liệu đặt ra một trạng thái, phải trả lời được ai đưa vào, ai đưa ra, và sau khi ra thì về trạng thái nào. Nhóm đã bắt được bốn lỗi cùng loại này khi rà Report 1: Organization bị tạm khóa mà không có thao tác gỡ; Course bị vô hiệu hóa mà không có đường kích hoạt lại; Enrollment bị đánh dấu Miễn mà không gỡ được; Learner bỏ chấm chéo mà không có cách hoàn thành nghĩa vụ ở chu kỳ sau. Cả bốn đều đã được bổ sung đường ra.

Đợt rà v2 bắt thêm bốn lỗi cùng dạng, lần này đều sinh ra từ tương tác giữa hai mục cách xa nhau: BR-123 ghép BR-40 làm Exempted kẹt vĩnh viễn sau khi thay Organizer; BR-239 ghép BR-90 làm Learner không bao giờ nhận được Certificate; BR-240 ghép Mục 5.3 tạo ra yêu cầu chỉnh sửa không thực hiện được; và BR-74 trỏ tới một thao tác xóa mà BR-73 đã chặn.

Khuyến nghị khi rà tiếp. Với mỗi trạng thái mới, hỏi ba câu ai đưa vào, ai đưa ra, ra thì về đâu — vế thứ ba là vế hay sót nhất. Với mỗi quy tắc có chứa con số hoặc điều kiện, hỏi con số đó từ đâu ra. Với mỗi quy tắc nhắc tới một thao tác hoặc một dữ liệu, hỏi quy tắc nào tạo ra thứ đó. Khi bảng Use Case giải thích một quyết định bằng một lý do, hỏi lý do đó đã là quy tắc nghiệp vụ chưa. Riêng dạng lỗi tương tác giữa hai mục thì không bắt được bằng cách đọc tuần tự: cách duy nhất là lập danh sách các cặp mục có chung một thực thể rồi đọc chéo theo thực thể.

## **20.3. Tách bạch quyền nhìn thấy và nghĩa vụ phải học**

courseType (Public/Private) quyết định ai nhìn thấy Course trong danh mục tự học. Enrollment (Required/Optional) quyết định ai có nghĩa vụ học. Hai thứ độc lập, không suy ra nhau. Lẫn lộn hai khái niệm này chính là nguồn gốc của hàng loạt mâu thuẫn mà nhóm đã mất nhiều vòng trao đổi mới gỡ ra.

## **20.4. Chế tài phải qua người, không tự động**

Report là dữ liệu do người dùng tạo ra nên có thể bị lạm dụng. Hệ thống đếm và cảnh báo, nhưng quyết định vô hiệu hóa nội dung hay tạm khóa tổ chức luôn do người có thẩm quyền ra (BR-252).

## **20.5. Khách hàng luôn lấy được dữ liệu của chính mình**

Kể cả khi Subscription đã Suspended, Organizer vẫn kết xuất được báo cáo đào tạo (BR-17). Với một sản phẩm B2B, việc khóa dữ liệu của khách hàng khi họ ngưng dịch vụ là điều không chấp nhận được.

## **20.6. Ẩn danh giữa người học, minh bạch với người chịu trách nhiệm**

Trong chấm chéo và trong phiếu đánh giá, danh tính được che giữa những người học với nhau để tránh thiên vị và để người học dám nhận xét thật. Nhưng Instructor — người chịu trách nhiệm chuyên môn — vẫn thấy đầy đủ danh tính trong chấm chéo để xử lý tranh chấp điểm (BR-192). Riêng phiếu đánh giá thì ẩn danh tuyệt đối với cả Instructor lẫn Organizer, vì mục đích của nó là lấy phản hồi thật về chính Instructor.

Nhóm đã cân nhắc cho Organizer thấy danh tính người đánh giá để đối chứng với Instructor, và đã bác. Lý do: nó phá cùng lúc nguyên tắc này, phá BR-261 và BR-266, và phá cả lý do từ chối chức năng xóa phiếu tại BR-263 vốn dựa trên việc không lưu liên kết giữa danh tính và nội dung. Về vận hành, Organizer là cấp quản lý của Learner, nên biết ai chấm thấp sẽ khiến Learner chấm cao hết và dữ liệu thu về thành vô dụng. Kênh chính thức để nêu vấn đề về một Instructor là report tại Mục 17, vốn có danh tính người gửi và có quy trình xử lý. Nếu cần phát hiện đánh giá bất thường mà không phá ẩn danh thì hiển thị phân bố điểm bên cạnh điểm trung bình, bổ sung cho BR-264.

## **20.7. Khóa theo căn cứ tính kết quả, không khóa theo hiển thị**

Cơ chế Locked chỉ chặn những thao tác làm thay đổi căn cứ tính kết quả học tập. Mọi thao tác chỉ ảnh hưởng cách hiển thị — sửa tiêu đề, sửa mô tả, thay ảnh bìa, thay tệp lỗi kỹ thuật, đổi courseType, sửa thời lượng dự kiến của Assignment — đều luôn cho phép. Đây là câu trả lời cho phản hồi của nhóm rằng khóa toàn bộ Course sau Enrollment đầu tiên là "hơi gò bó".

## **20.8. Instructor có quyền mời, Organizer có quyền bắt buộc**

Hệ thống có đúng hai kênh đưa người vào một Course, và ranh giới giữa chúng trùng khớp với ranh giới thẩm quyền thật ngoài đời.

Kênh của Instructor là để Course ở dạng Public rồi Learner tự đăng ký, tạo ra Enrollment Optional: không hạn hoàn thành, không nghĩa vụ, không vào chỉ số tuân thủ. Đây là lời mời. Instructor hoàn toàn chủ động — muốn ai học thì mở khóa ra và nói với họ.

Kênh của Organizer là phân công, tạo ra Enrollment Required kèm hạn hoàn thành và trách nhiệm tuân thủ. Đây là nghĩa vụ.

Nói gọn: Instructor mời, Organizer bắt buộc. Nguyên tắc này là lý do BR-113 giữ quyền phân công cho riêng Organizer mà không làm Instructor mất đường xoay xở.

# **21\. NGOÀI PHẠM VI MVP**

Các nội dung dưới đây đã được nhóm chốt là không thực hiện trong MVP. Ghi lại để tránh việc một thành viên tự bổ sung vào thiết kế.

Tính năng AI — gợi ý lộ trình học, chấm tự động bài tự luận, sinh câu hỏi. Đã chốt đưa sang giai đoạn 2\.

SSO cấp doanh nghiệp — hệ thống chỉ có đăng nhập bằng tài khoản Google cá nhân, không tích hợp SSO của doanh nghiệp.

Cổng thanh toán thật và nghiệp vụ hóa đơn — đề tài dùng dịch vụ thanh toán mô phỏng. Mã số thuế chỉ là thông tin định danh, không kéo theo xuất hóa đơn.

Hạ cấp gói dịch vụ — chỉ hỗ trợ gia hạn và nâng cấp.

Chấm dứt vĩnh viễn Organization và xử lý dữ liệu sau chấm dứt — MVP chỉ hỗ trợ tạm khóa có thể gỡ bỏ. Nhóm đã phác thảo một chính sách lưu trữ ba giai đoạn (giữ nguyên 100% trong 90 ngày, sau đó giải phóng dữ liệu nặng và giữ dữ liệu nhẹ, xóa hoàn toàn chỉ khi Organizer chủ động yêu cầu) nhưng chốt tạm thời không đưa vào danh sách Use Case, chỉ ghi nhận để tham khảo nếu còn thời gian.

Actor Staff — không bổ sung vai trò trung gian để giảm tải cho Organizer trong MVP.

Nâng một thành viên có sẵn trong Organization lên làm Organizer khi thay Organizer — MVP chỉ mời Organizer mới bằng email chưa gắn với tài khoản nào theo BR-40. Nâng vai trò kéo theo các câu hỏi chưa có quy tắc: Enrollment và Course của người đó xử lý thế nào, chỗ theo giới hạn gói có được giải phóng hay không. Ghi nhận để xét ở giai đoạn 2\.

Khái niệm Project — đã bỏ hẳn, hệ thống chỉ còn Assignment.

Báo cáo bài nộp của Learner có nội dung vi phạm — đối tượng report tại BR-233 chỉ gồm nội dung do Instructor soạn: Lesson, học liệu, nội dung Quiz và đề bài Assignment. Bài nộp của Learner không nằm trong danh sách. Nhóm ghi nhận đây là chỗ trống có chủ đích: làm nó sẽ kéo theo một loại đối tượng report mới, một luồng xử lý mới, và đưa Instructor trở lại làm actor gửi report với lý do khác hẳn.

Chức năng tra cứu nhật ký nâng cao — kết xuất tệp và so sánh giá trị trước sau nằm ngoài phạm vi theo BR-272. MVP chỉ ghi nhận và một màn hình danh sách có lọc.