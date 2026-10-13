# Đóng kèm Codex (bản cố định)

AccountingX chạy Codex CLI đi kèm, không dùng bản cài sẵn trên máy.

## Cách đặt file
1. Chạy `powershell -ExecutionPolicy Bypass -File scripts\fetch-codex.ps1` (mặc định `rust-v0.161.0`, tải từ trang Releases của `openai/codex`).

2. Script đặt `codex.exe` cùng hai file hỗ trợ sandbox Windows vào `src-tauri/resources/codex/`.
3. Ghi phiên bản đã kiểm thử vào `NOTICE.md`.
4. `bun tauri build`. Bộ cài sẽ chứa `resources/codex/codex.exe`.

## Thứ tự tìm binary
1. Biến môi trường `ACCOUNTINGX_CODEX_BIN`.
2. `resources/codex/codex.exe` cạnh `AccountingX.exe` (bản cài).
3. `src-tauri/resources/codex/codex.exe` (khi chạy `bun tauri dev`).
4. Codex trên PATH (chỉ khi không có bản đóng kèm).

## Dữ liệu riêng
- `CODEX_HOME` = `~/.accountingx/codex` (đăng nhập ChatGPT, config, lịch sử).
- `config.toml` mặc định: `approval_policy = "on-request"`, `sandbox_mode = "workspace-write"`.
  File đã có sẽ không bị ghi đè.
- Dùng Codex hệ thống để phát triển: đặt `ACCOUNTINGX_USE_SYSTEM_CODEX=1`.

## Browser-use

Luồng đã kiểm chứng trên máy phát triển:

```text
Codex CLI đóng kèm
  → `cua_repl` local
  → browser service/native messaging
  → extension ChatGPT chính thức
  → Chrome profile người dùng
```

- Extension Chrome chính thức: `hehggadaopoacecdllhhajmbjkdcmajg`.
- AccountingX được phép phát hiện trạng thái và mở trang Chrome Web Store; người dùng phải tự cài extension và duyệt quyền.
- `scripts/test-cloned-cua-standalone.ps1` kiểm tra chỉ đọc khi Codex Desktop đã đóng và không dùng native pipe được cấu hình bởi Desktop.
- `.dev-vendor/openai-cua/` hiện là runtime thử nghiệm local, không được Git theo dõi và chưa phải thành phần phát hành.
- Trước khi đóng gói cần có installer/health check cho native messaging host, chính sách cập nhật phiên bản và approval gate. Không dùng `--dangerously-bypass-approvals-and-sandbox` trong sản phẩm.

## Nâng phiên bản
Chỉ nâng cùng một bản AccountingX mới, sau khi kiểm thử các tình huống MISA.
