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

## Nâng phiên bản
Chỉ nâng cùng một bản AccountingX mới, sau khi kiểm thử các tình huống MISA.
