# AccountingX — Hướng dẫn dùng thử

AccountingX là trợ lý AI cho kế toán: lấy báo cáo từ MISA AMIS, trả lời qua Zalo, và **không bao giờ tự ký hay ghi sổ**. Mọi việc ghi vào MISA hoặc gửi email ra ngoài đều phải có người duyệt.

## Bạn cần có

- Máy Windows 10 hoặc 11.
- Trình duyệt **Google Chrome**.
- Tài khoản **ChatGPT** (để AI hoạt động).
- Tài khoản **MISA AMIS** có quyền xem báo cáo của công ty.
- Một tài khoản **Zalo riêng cho bot** (số điện thoại phụ), và Zalo của người sẽ duyệt.

## 1. Cài đặt

1. Chạy file cài `AccountingX`.
2. Windows có thể hiện cảnh báo **"Windows protected your PC"** vì bản dùng thử chưa có chữ ký số. Bấm **More info** rồi **Run anyway**.
3. Mở AccountingX. Màn **Kiểm tra hệ thống** hiện ra: làm theo hướng dẫn trên từng mục đỏ (đăng nhập, Chrome, tiện ích). Bấm **Kiểm tra lại** sau mỗi bước.

## 2. Đăng nhập AI

Trong màn kiểm tra hoặc **Cài đặt → Mức sử dụng AI**, đăng nhập tài khoản ChatGPT. Màn này cũng cho biết còn bao nhiêu lượt sử dụng.

## 3. Thêm công ty

1. Bấm **Thêm công ty**, nhập **tên** và **mã số thuế** (bắt buộc).
2. Mỗi công ty có thư mục làm việc riêng. Dữ liệu và lịch sử trò chuyện của các công ty không lẫn vào nhau.

## 4. Nối Chrome và MISA

1. Cài tiện ích **Codex** vào profile Chrome bạn dùng cho MISA (màn Kiểm tra hệ thống hướng dẫn).
2. Mở MISA AMIS trong profile đó và đăng nhập **bằng tay**. AI không bao giờ nhập hay giữ mật khẩu MISA của bạn.
3. Mỗi công ty trong MISA nên dùng một profile Chrome. Nhiều profile cho phép các công ty chạy cùng lúc.
4. Lần đầu AI làm việc với một công ty, nó **đối chiếu mã số thuế trên màn hình MISA** và hỏi bạn xác nhận công ty và sổ. Sau đó nó nhớ.

## 5. Kết nối Zalo

1. **Cài đặt → Zalo → Kết nối**, quét mã QR bằng Zalo của bot và xác nhận trên điện thoại.
2. **Thêm người duyệt**: bấm nút, một mã hiện ra. Người duyệt nhắn cho bot đúng dòng đó (`GHEP <mã>`). Người duyệt là người tin cậy: duyệt được và giao việc cho AI.
3. **Nhóm Zalo:** thêm bot vào nhóm. Trong nhóm, bot chỉ trả lời khi được **@nhắc** hoặc tin bắt đầu bằng `bot `, và chỉ nghe người đã ghép. Mỗi nhóm gắn với một công ty (nhắn `công ty 1`, `công ty 2`...).

## 6. Dùng hằng ngày

Nhắn cho bot trên Zalo như nhắn đồng nghiệp:

- "Xem tồn kho công ty Trí Nhân" → AI lấy báo cáo từ MISA, lưu bảng chi tiết và ghi chú bằng chứng, rồi nhắn bạn tóm tắt.
- "Gửi tóm tắt cho anh Vũ" → AI nhắn Zalo cho người đã đăng ký, không cần hỏi lại.
- Khi AI cần quyền, nó hỏi trên Zalo: trả lời `ok`, `ok luôn` hoặc `không`.

Trong app, bạn xem lại toàn bộ cuộc trò chuyện và các tệp bằng chứng của từng công ty.

## 7. Cái gì cần duyệt?

| Việc | AI làm thế nào |
| --- | --- |
| Xem báo cáo MISA, soạn tóm tắt, nhắn Zalo cho người đã đăng ký | Tự làm |
| Gửi email ra ngoài (qua plugin Gmail) | AI **hỏi người duyệt trước** theo quy tắc của công ty. Đây là quy tắc, chưa phải khóa cứng như phiếu duyệt |
| Ghi dữ liệu vào MISA | Như trên |
| Ký, nộp chứng từ hoặc tờ khai | **AI không bao giờ làm** |

Việc ghi vào MISA đi qua **phiếu duyệt** (dùng được **một lần**, hết hạn sau **24 giờ**).

**Gmail:** cài plugin *Gmail* trong mục Plugin của app và đăng nhập Google. Plugin này đọc được hộp thư và do dịch vụ bên ngoài cung cấp. Chỉ kết nối hộp thư bạn sẵn sàng cho AI truy cập. Xem phiếu đang chờ ở **Cài đặt → Chờ duyệt**.

## 8. Quyền của AI

**Cài đặt → Quyền của AI** có công tắc *Tự động cho phép thao tác thông thường*. Bật lên thì AI không hỏi "Cho phép" cho lệnh, sửa tệp, truy cập mạng. Nó vẫn hỏi khi cần bạn nhập thông tin hoặc mở liên kết. Việc ghi MISA **luôn phải qua phiếu duyệt** và AI luôn hỏi trước khi gửi email, bất kể công tắc.

## 9. Dữ liệu nằm ở đâu

Mọi dữ liệu ở trên **máy của bạn**, trong thư mục `C:\Users\<tên>\.accountingx`. AccountingX không có máy chủ riêng lưu dữ liệu kế toán. Nội dung bạn nhờ AI xử lý đi qua dịch vụ AI của tài khoản ChatGPT bạn đăng nhập.

## 10. Gặp sự cố?

- Mở **Cài đặt → Kiểm tra hệ thống** và làm theo hướng dẫn ở mục màu đỏ.
- **Zalo không nhận tin:** vào **Cài đặt → Zalo**, bấm Kết nối lại (mã QR chỉ hiện khi bấm).
- **MISA hết phiên:** đăng nhập lại MISA trong Chrome rồi nhắn "xong".
- Còn lỗi: chụp màn hình và gửi cho người hỗ trợ của bạn.
