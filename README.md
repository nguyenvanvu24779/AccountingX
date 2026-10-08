# AccountingX

Ứng dụng desktop **AI-first cho kế toán doanh nghiệp SME Việt Nam** — trải nghiệm như Codex / ChatGPT / Claude desktop,
nhưng chuyên cho nghiệp vụ kế toán trên **MISA AMIS** (thao tác qua trình duyệt), giao việc và duyệt qua **Zalo**.

- Nền tảng: Windows (bản đầu) · Tauri v2 (Rust) + React/TypeScript
- Động cơ AI: Codex CLI qua **Codex App Server** (đăng nhập ChatGPT chính chủ của khách — BYO)
- Nguyên tắc: AI **không tự ký / không ghi sổ**; mọi thao tác ghi đều qua **phiếu duyệt + bằng chứng**
- Dữ liệu ứng dụng: `~/.accountingx/`

> Dự án fork từ [Codexia](https://github.com/milisp/codexia) (MIT). Xem `NOTICE.md` và `LICENSE`.

## Phát triển (Windows)

Yêu cầu: Rust (MSVC toolchain), Visual Studio Build Tools (C++), WebView2 Runtime, Bun, Codex CLI.

```powershell
bun install
bun tauri dev        # chạy app ở chế độ dev
bunx tsc --noEmit    # kiểm tra frontend
cargo check -p codexia   # kiểm tra Rust (tên crate nội bộ giữ nguyên tạm thời)
```

Kế hoạch giữ/bỏ/thêm module: `docs/ACCOUNTINGX_PLAN.md`.
