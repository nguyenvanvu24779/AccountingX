# Checklist cài thử trên máy sạch (nội bộ)

Build: `bun tauri build` (nsis + msi). Bộ cài đã đóng gói: Codex 0.161.0 (`resources/codex`), sidecar Zalo + `node_modules` (`resources/bots/zalo`), skill MISA (nhúng trong binary).

Máy sạch cần có sẵn **Chrome** với tiện ích ChatGPT (https://chromewebstore.google.com/detail/chatgpt/hehggadaopoacecdllhhajmbjkdcmajg). Node.js đã đóng gói trong bộ cài. Màn "Tự kiểm tra" sẽ báo nếu thiếu.

1. Cài bộ cài, mở app lần đầu: màn tự kiểm tra không có mục đỏ không tự sửa được.
2. Đăng nhập tài khoản GPT; kiểm tra Cài đặt → Mức sử dụng AI hiện giới hạn.
3. Cài đặt → Zalo → Kết nối: QR hiện chỉ khi bấm, quét xong hiện tên tài khoản.
4. Ghép một tài khoản Zalo thứ hai bằng `GHEP <mã>`; nhắn một việc và nhận trả lời.
5. Nhóm Zalo: @nhắc bot, đặt "công ty N".
6. Tạo công ty (có MST), chạy báo cáo tồn kho; kiểm tra `misa-binding.json` và bước xác nhận công ty/sổ.
7. Công tắc "Quyền của AI": Hỏi → Tự cho phép; xác nhận phiếu duyệt ghi MISA/email vẫn bắt buộc.
8. Gỡ cài đặt: thư mục `~/.accountingx` giữ nguyên dữ liệu (xác nhận có chủ ý).
