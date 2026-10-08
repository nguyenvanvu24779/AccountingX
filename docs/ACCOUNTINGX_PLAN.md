# AccountingX — Kế hoạch fork từ Codexia

Nguyên tắc: **tuần 1–2 ẩn (feature flag / bỏ khỏi menu), chưa xoá code** — chỉ xoá khi app đã build và chạy ổn trên Windows,
để giảm rủi ro vỡ build và dễ so sánh với upstream.

## Đã làm (tuần 1)
- Đổi tên hiển thị → AccountingX; `identifier` = `vn.accountingx.desktop`; tên file chạy `AccountingX.exe` (`mainBinaryName`)
- Deep link `codexia://` → `accountingx://`
- Thư mục dữ liệu `~/.codexia` → `~/.accountingx` (tránh dùng chung dữ liệu với Codexia nếu máy có cài)
- `clientInfo.name` gửi cho Codex App Server / ACP → `accountingx` (hiện trong OpenAI Compliance Logs)
- **Tắt updater** (endpoint cũ trỏ về bản phát hành Codexia, ký bằng khoá của upstream). Cần tạo khoá ký + kênh phát hành riêng trước khi bật lại.
- Telemetry: chỉ gửi khi build có biến `CODEXIA_TELEMETRY_URL` → build của ta không đặt biến này ⇒ không gửi gì. Sẽ gỡ hẳn ở tuần 2.
- Version về `0.1.0`

## GIỮ (lõi)
| Module | Lý do |
|---|---|
| `crates/codex` (app_server, protocol, accounts) | Kết nối Codex App Server, đăng nhập ChatGPT, luồng sự kiện, approval |
| `src/components/codex` | Khung chat, composer, stream, hiển thị bước làm của agent |
| `src/components/bot` + `crates/acp/bots` | Mô hình "trợ lý thường trực" + timeline + routines → **Trợ lý kế toán** theo công ty |
| `crates/automation` + `src/features/automations` | Việc định kỳ (vd. báo cáo tồn kho 8h sáng) |
| `crates/db`, `crates/shared` | Lưu trữ cục bộ (SQLite) |
| `src/features/files` | Xem nhanh XLSX/PDF/CSV → **xem bằng chứng** |
| `src/features/skills`, `src/features/mcp` | Skill kế toán, MCP Playwright/MISA |
| `src-tauri/src/usage_tray.rs`, `src/features/insight` | Nền cho **đồng hồ token/hạn mức** (cần đánh giá `agent-insights`) |
| `src/components/settings`, `src/locales` | Cài đặt; **thêm `vi`** làm mặc định |

## ẨN → XOÁ SAU
| Module | Lý do |
|---|---|
| `crates/cc`, `src/components/cc`, `claude-agent-sdk-rs` | Claude Code — để Phase 4 (Claude add-on) |
| `crates/git`, `src/features/git`, `branch`, worktree | Tính năng lập trình |
| `src/features/terminal`, `project-run`, `web-preview` | Tính năng lập trình |
| `src/features/publish` (productship) | Không liên quan |
| `src-tauri/src/commands/keke_mcp.rs`, `PluxPromo`, `tauri.keke.conf.json`, plugins marketplace | Quảng bá / sản phẩm bên thứ ba |
| `web/` (Axum remote), `commands/remote.rs`, `pairing`, `mobile`, barcode-scanner | Điều khiển từ xa mở cổng mạng → **rủi ro bảo mật**; Zalo thay vai trò này |
| `src-tauri/src/dictation` | Không cần ở MVP |
| `crates/telemetry`, `telemetry/`, `TelemetryConsentDialog` | Gỡ hẳn |
| `bots/discord`, `bots/telegram` | Thay bằng kênh Zalo (tham khảo mẫu telegram) |
| `tauri.ios.conf.json`, `Info.plist`, `entitlements.plist` | Chỉ làm Windows |

## THÊM (AccountingX)
1. **Công ty & Sổ** (thay `ProjectSelector`): mỗi công ty = 1 workspace riêng (`~/.accountingx/companies/<mst>/`) chứa AGENTS.md + skill + dữ liệu tải về ⇒ agent luôn đứng đúng công ty.
2. **Chờ duyệt**: phiếu duyệt + bằng chứng (file Excel gốc, ảnh chụp, số chứng từ, hash), Duyệt/Từ chối trên app hoặc Zalo (mã duyệt + whitelist người duyệt).
3. **Playbook MISA**: các case chạy bằng Playwright cố định (0 token), AI chỉ dự phòng khi playbook lỗi; đèn xanh/đỏ theo lần chạy gần nhất.
4. **Token & hạn mức**: theo việc / ngày / gói.
5. **Kênh Zalo**: sidecar Node (zca-js) **kết nối ra ngoài**, không mở cổng vào máy.
6. **Onboard**: đăng nhập ChatGPT (Codex) → nối MISA (Chrome profile riêng) → chọn người duyệt → đèn xanh.

## Việc cần làm trên máy Windows (dev)
- [ ] Cài Rust MSVC, VS Build Tools (C++), WebView2, Bun, Codex CLI
- [ ] `bun install && bun tauri dev` — app mở được, chat được với Codex
- [ ] Sau khi chạy ổn: ẩn các module ở bảng "ẨN"
- [ ] Đổi icon (`src-tauri/icons/`) sang logo AccountingX
