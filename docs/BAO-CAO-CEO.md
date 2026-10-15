# AccountingX — Báo cáo cho Ban Giám đốc (bản 1.0.1)

15/10/2026

## Tóm tắt điều hành

AccountingX đã có bộ cài Windows (mã nguồn đã đặt số bản 1.0.1, cần build lại bộ cài để mang số này) và gần sẵn sàng cho khách dùng thử nội bộ, nhưng chưa nên dùng cho việc ghi sổ thật cho đến khi qua thử nghiệm trên máy sạch và công ty mẫu.

- **Là gì:** ứng dụng AI cho kế toán SME Việt Nam. Kế toán nhắn Zalo, AI lấy báo cáo từ MISA AMIS qua Chrome, lưu bằng chứng và trả lời tóm tắt.
- **Đã chứng minh:** một báo cáo tồn kho thật trên MISA (công ty Trí Nhân, 48 mặt hàng, tồn cuối kỳ 429.878.419 đồng), bot Zalo trả lời trong nhóm, và gửi email thành công qua Gmail.
- **Nguyên tắc cứng:** AI không tự ký, không tự ghi sổ. Việc ghi vào MISA và gửi email đều đi qua phiếu duyệt do người có thẩm quyền xác nhận trên Zalo hoặc trong ứng dụng.
- **Chưa chứng minh:** luồng ghi MISA bằng phiếu duyệt chưa chạy thử trên MISA thật; bộ cài chưa được thử trên một máy sạch.
- **Cần CEO quyết:** có cho thử với dữ liệu khách thật không, có đầu tư chữ ký số cho bộ cài không, và chọn mức tài khoản ChatGPT cho khách (xem phần cuối).

## Sản phẩm và giá trị cho khách hàng

Khách giao việc cho AI như nhắn tin cho đồng nghiệp, không phải học phần mềm mới và không phải ngồi trước máy.

- **Hỏi qua Zalo:** nhắn riêng hoặc trong nhóm. Mỗi nhóm gắn với một công ty; bot chỉ trả lời người đã được ghi tên và khi được @nhắc.
- **Lấy số từ MISA AMIS:** AI mở MISA trong Chrome của khách, đối chiếu mã số thuế đúng công ty và sổ, đọc báo cáo, lưu bảng chi tiết (CSV) và ghi chú bằng chứng.
- **Nhiều công ty, chạy song song:** mỗi công ty có thư mục và lịch sử riêng, không lẫn dữ liệu; công ty dùng profile Chrome khác nhau có thể làm cùng lúc.
- **Gửi email:** soạn và gửi qua Gmail sau khi có người duyệt.
- **Dữ liệu nằm trên máy khách** (thư mục `.accountingx`), không có máy chủ riêng của chúng ta lưu dữ liệu kế toán. Nội dung đi qua dịch vụ AI của tài khoản ChatGPT mà khách đăng nhập.

## Hiện trạng: đã làm và đã kiểm chứng gì

Sản phẩm có đủ các mảng chính; hai mảng có rủi ro cao nhất (ghi MISA, cài máy sạch) là hai mảng chưa kiểm chứng thật.

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Báo cáo tồn kho trên MISA | Đã chạy thật | Công ty Trí Nhân, Sổ 1, kỳ 01–15/10/2026: 48 mặt hàng, tồn cuối kỳ 429.878.419 đồng; mã số thuế trên MISA khớp. Có 11 dòng âm cần kế toán xem lại. |
| Zalo: kết nối, ghép người duyệt, nhóm | Đã chạy thật | Bot trả lời trong nhóm khi được @nhắc. Nhiều công ty trong một nhóm: chưa thử. |
| Gửi email qua Gmail | Đã gửi thành công | Dùng plugin Gmail có sẵn. Quy trình phiếu duyệt cho email mới viết, chưa thử. |
| Ghi vào MISA bằng phiếu duyệt | Mới viết, chưa thử thật | Một khuôn hai pha cho mọi loại chứng từ: soạn và dừng trước nút Lưu, duyệt, rồi mới lưu và đối chiếu. Kiểm bằng test tự động, chưa chạy trên MISA. |
| Cổng phiếu duyệt | Đã kiểm bằng test | Phiếu dùng một lần, hết hạn sau 24 giờ, nội dung ghi phải khớp đúng nội dung đã duyệt. |
| Tự kiểm tra sau cài | Hoàn thành | Màn Kiểm tra hệ thống chỉ lỗi (Codex, đăng nhập, Zalo, Chrome, kỹ năng) và hướng dẫn sửa. |
| Bộ cài Windows (NSIS, MSI) | Đã build (ghi 0.1.0, cần build lại thành 1.0.1) | NSIS 136 MB. Đã đóng gói sẵn Codex, Node.js và thành phần Zalo. **Chưa cài thử trên máy sạch.** |
| Kiểm thử mã | Xanh | Test giao diện và test Rust đều qua, không còn cảnh báo biên dịch. |
| Tài liệu khách hàng | Có | Hướng dẫn dùng thử (Word và Markdown) và checklist cài máy sạch. |

## Kiểm soát rủi ro: AI không tự ký, không tự ghi sổ

Mọi việc có tác dụng phụ đi qua một phiếu duyệt; AI có thể soạn, nhưng chỉ thực hiện khi có người đồng ý đúng nội dung đó.

1. AI soạn thay đổi (điền form MISA hoặc viết email) và **dừng trước nút Lưu/Gửi**, chụp bằng chứng.
2. Hệ thống tạo phiếu ghi đủ nội dung (công ty, sổ, ngày, số tiền, tài khoản, diễn giải) và nhắn người duyệt trên Zalo.
3. Người duyệt trả lời `ok` trên điện thoại hoặc bấm trong ứng dụng. Không cần ngồi trước máy.
4. AI được đánh thức, dùng phiếu (**một lần**, trong **24 giờ**, nội dung phải khớp đúng) rồi mới lưu/gửi.
5. AI chụp lại kết quả và đối chiếu với phiếu; khác thì báo ngay.

Các ràng buộc khác:

- **Không bao giờ** ký, nộp tờ khai, ghi sổ hoặc xóa bản ghi. Đây là quy tắc cứng trong kỹ năng của AI.
- **Mật khẩu MISA** do khách tự đăng nhập trong Chrome; AI không nhập và không giữ.
- **Chỉ người đã được ghép** (người duyệt) mới giao việc được cho bot. Bot nhắn Zalo được cho người đã đăng ký, không nhắn được cho người lạ.
- **Chế độ “Quyền của AI”:** khi bật tự động cho phép, AI không hỏi lệnh thông thường, truy cập mạng và tệp ngoài thư mục công ty. Phiếu duyệt ghi MISA và email không đổi theo cài đặt này.

**Giới hạn cần biết:** vì AI điều khiển Chrome bằng cách bấm nút, hệ thống **không khóa cứng được nút Lưu của MISA**; độ an toàn dựa vào quy trình bắt buộc, nội dung phiếu phải khớp và ảnh chụp trước/sau. Email gửi qua plugin Gmail bên ngoài cũng chỉ được chặn theo cách này, chưa phải khóa kỹ thuật.

## Chi phí và điều kiện triển khai cho khách

Khách tự trả phí AI cho OpenAI qua tài khoản của họ; AccountingX hiện không thu thêm và chưa có mô hình giá.

| Khách cần có | Chi tiết |
| --- | --- |
| Tài khoản ChatGPT gói Plus | Khoảng 20 USD/tháng, khách tự đăng ký và thanh toán. Chưa kiểm được gói Plus có đủ giới hạn sử dụng khi chạy nhiều báo cáo; ứng dụng có màn hình xem mức đã dùng theo cửa sổ 5 giờ và theo tuần. |
| Tài khoản MISA AMIS | Có quyền xem báo cáo của công ty. Khách tự đăng nhập MISA trên Chrome. |
| Google Chrome | Cài tiện ích Codex trong profile dùng cho MISA. |
| Zalo | Một tài khoản Zalo riêng cho bot (số điện thoại phụ) và Zalo của người duyệt. |
| Windows 10 hoặc 11 | Bộ cài đã gói sẵn Codex và Node.js nên không cần cài thêm. |
| Gmail (nếu gửi email) | Cài plugin Gmail và đăng nhập Google. |

Chưa có chi phí hạ tầng riêng: không máy chủ, không lưu dữ liệu khách trên đám mây của chúng ta. Chi phí phát sinh của chúng ta hiện là thời gian phát triển và hỗ trợ khách.

## Rủi ro và hạn chế hiện tại

Rủi ro lớn nhất là ghi sai số liệu vào MISA; phần này mới được viết, chưa chạy thật.

| Rủi ro | Mức | Hiện đang xử lý |
| --- | --- | --- |
| Ghi sai vào MISA | Cao | Phiếu duyệt, đối chiếu trước/sau, ảnh chụp. Không khóa cứng được nút Lưu. Chưa thử trên MISA thật. |
| Email gửi không qua phiếu | Trung bình | Plugin Gmail có sẵn do bên ngoài cung cấp, đọc được hộp thư và có thể gửi mà không qua phiếu. Quy trình bắt buộc nằm trong kỹ năng của AI. |
| Bộ cài chưa ký số | Trung bình | Windows hiện cảnh báo “Unknown publisher”; khách phải bấm “More info, Run anyway”. Ảnh hưởng đến niềm tin của khách. |
| Chưa cài thử trên máy sạch | Trung bình | Có checklist cài thử; cần làm trước khi gửi khách. |
| Giới hạn sử dụng gói ChatGPT Plus | Trung bình | Chưa đo được mức tiêu thụ thực; AI chạy MISA tốn nhiều lượt đọc màn hình. |
| Phụ thuộc MISA và Chrome | Trung bình | AI điều khiển giao diện web; MISA đổi giao diện có thể làm kỹ năng lỗi. Chưa có API chính thức. |
| Chạy song song nhiều profile Chrome | Thấp | Đã thiết kế, chưa ai kiểm chứng. |
| Độ chính xác số liệu | Cần rà | Báo cáo tồn kho đầu tiên có 11 dòng âm và 6 dòng trống số lượng; cần kế toán xác nhận đây là dữ liệu thật hay lỗi đọc. |

Lưu ý về Zalo: bot kết nối bằng thư viện mã nguồn mở không phải API chính thức của Zalo, nên có rủi ro Zalo đổi giao thức hoặc hạn chế tài khoản bot. Nên dùng số phụ cho bot, không dùng Zalo cá nhân của khách.

## Mở rộng: tích hợp thêm tài khoản Google Antigravity

Đề xuất cho giai đoạn sau: cho phép khách dùng thêm tài khoản Google Antigravity làm nguồn AI bổ sung bên cạnh ChatGPT; **hiện chưa làm, chưa thử và chưa nằm trong bản 1.0.1**.

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Giảm phụ thuộc vào một nhà cung cấp AI, có thêm lựa chọn khi tài khoản ChatGPT chạm giới hạn sử dụng. |
| Cách làm dự kiến | Dùng một cổng AI chạy trên máy khách (mã `api_ai_hub` đang nằm trong thư mục dự án, chưa đưa vào sản phẩm) để nối tài khoản Antigravity, rồi khai báo làm nhà cung cấp thêm trong danh sách nhà cung cấp của Codex. Giao diện chọn mô hình sẽ tự hiện nhà cung cấp mới. |
| Việc cần làm | Nối cổng AI vào ứng dụng; màn hình thêm và chọn tài khoản; kiểm tra cấp quyền đăng nhập Google; kiểm chứng chất lượng khi AI điều khiển MISA trên mô hình khác; đóng gói cổng AI vào bộ cài. |
| Rủi ro chính sách | Phần tích hợp Antigravity trong cổng AI là không chính thức; tài liệu của chính cổng này cảnh báo có thể trái điều khoản của nhà cung cấp và có thể hỏng khi nhà cung cấp thay đổi. Cần rà điều khoản trước khi cho khách dùng. |
| Điều kiện dùng | Chỉ tài khoản của chính khách hoặc được ủy quyền. Không dùng để gộp nhiều tài khoản nhằm vượt giới hạn mức dùng; tài liệu của cổng AI cũng nêu rõ điều này. |

Quyết định để mở: có đưa Antigravity vào sản phẩm hay không, sau khi rà điều khoản và thử chất lượng trên một công ty mẫu.
