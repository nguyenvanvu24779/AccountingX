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
- Đã kiểm chứng browser-use end-to-end bằng Codex CLI đóng kèm: bản `cua_repl` local điều khiển extension ChatGPT chính thức trong Chrome, dùng profile đang đăng nhập của người dùng và vẫn hoạt động khi Codex Desktop đã đóng. Bài test đã đọc danh sách tab và tạo/reload/xác minh một Google Keep note.

## GIỮ (lõi)
| Module | Lý do |
|---|---|
| `crates/codex` (app_server, protocol, accounts) | Kết nối Codex App Server, đăng nhập ChatGPT, luồng sự kiện, approval |
| `src/components/codex` | Khung chat, composer, stream, hiển thị bước làm của agent |
| `src/components/bot` + `crates/acp/bots` | Mô hình "trợ lý thường trực" + timeline + routines → **Trợ lý kế toán** theo công ty |
| `crates/automation` + `src/features/automations` | Việc định kỳ (vd. báo cáo tồn kho 8h sáng) |
| `crates/db`, `crates/shared` | Lưu trữ cục bộ (SQLite) |
| `src/features/files` | Xem nhanh XLSX/PDF/CSV → **xem bằng chứng** |
| `src/features/skills`, `src/features/mcp` | Skill kế toán và cấu hình browser-use/MISA tương thích `cua_repl` |
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
3. **Playbook MISA**: các case ưu tiên luồng thao tác xác định qua `cua_repl` và extension ChatGPT chính thức trong Chrome; AI xử lý dự phòng khi giao diện thay đổi. Mỗi lần chạy phải có trạng thái và bằng chứng trước/sau.
4. **Token & hạn mức**: theo việc / ngày / gói.
5. **Kênh Zalo**: sidecar Node (zca-js) **kết nối ra ngoài**, không mở cổng vào máy.
6. **Onboard**: đăng nhập ChatGPT (Codex) → phát hiện Chrome → đề xuất người dùng cài extension ChatGPT chính thức nếu thiếu → kiểm tra browser host → người dùng tự đăng nhập MISA trong Chrome profile của họ → chọn người duyệt → đèn xanh.

## Kiến trúc browser-use đã kiểm chứng

```text
AccountingX
  → Codex CLI đóng kèm (`~/.accountingx/codex`)
  → `cua_repl` runtime local
  → browser service/native messaging
  → extension ChatGPT chính thức
  → Chrome profile hiện hữu của người dùng
  → MISA AMIS
```

- Không dùng profile Playwright riêng trong hướng hiện tại; người dùng tiếp tục dùng đúng Chrome profile đã cài extension và đã đăng nhập MISA.
- Codex Desktop không cần mở sau khi môi trường browser-use đã được thiết lập. Điều này đã được kiểm chứng bằng cả tác vụ chỉ đọc và tạo Google Keep note.
- Bản runtime local hiện nằm trong `.dev-vendor/openai-cua/`, bị bỏ qua bởi Git và mới chỉ phục vụ thử nghiệm trên máy phát triển. Cách cài đặt/cập nhật/phân phối browser host cho máy sạch vẫn chưa hoàn tất.
- Người dùng phải tự cài extension từ Chrome Web Store và tự chấp thuận quyền. AccountingX chỉ phát hiện trạng thái, mở trang cài đặt và kiểm tra lại kết nối.
- Không được xem `--dangerously-bypass-approvals-and-sandbox` là cấu hình sản phẩm; cờ này chỉ được dùng trong proof-of-concept. Bản phát hành phải dùng approval gate của AccountingX.

## Việc cần làm trên máy Windows (dev)
- [ ] Cài Rust MSVC, VS Build Tools (C++), WebView2, Bun, Codex CLI
- [ ] `bun install && bun tauri dev` — app mở được, chat được với Codex
- [ ] Sau khi chạy ổn: ẩn các module ở bảng "ẨN"
- [ ] Đổi icon (`src-tauri/icons/`) sang logo AccountingX
