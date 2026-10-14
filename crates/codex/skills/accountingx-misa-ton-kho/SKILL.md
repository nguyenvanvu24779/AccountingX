---
name: accountingx-misa-ton-kho
description: Read the inventory (tồn kho) report of the current company in MISA AMIS through the user's Chrome, save evidence, and summarize in Vietnamese. Read-only — use when the user asks about tồn kho, hàng tồn, inventory or stock levels in MISA.
---

# MISA AMIS — xem tồn kho (read-only)

You are reading data for an accountant. This playbook is **read-only**: it
must never change anything in MISA.

**First read and follow `../accountingx-misa-phien/SKILL.md`** (the shared MISA
session rules: which Chrome profile, login, company and book check, safe
switching, reporting). Its hard rules apply here. Do not read any figure until
its steps 1–3 have passed.

The only inputs you may set in this playbook are report filters (kỳ báo cáo,
từ ngày/đến ngày, kho) and the parameters dialog's view/OK button.

## Steps

Use `cua_repl` (Chrome via the official ChatGPT extension). Be economical: MISA
pages have very large accessibility trees. Read the page state once per screen,
do not re-read it after every click, prefer targeted reads of the table region
over full-page dumps, and give up after 3 failed attempts at the same step,
reporting where it stopped. The browser asks the user for permission the first
time it visits a site; wait for that rather than retrying.

1. **Session**: pick the browser, handle login, verify and if needed switch to
   the right company and book (shared skill, steps 1–3).
2. **Open the inventory summary report.** Menu path verified on this app:
   `Kho` → `Báo cáo`, which lists `Tổng hợp tồn kho` (also `Tổng hợp tồn kho
   theo nhiều đơn vị tính` and `Tổng hợp tồn kho theo nhóm VTHH`). Default to
   `Tổng hợp tồn kho`. Menu names can change with MISA updates; if the path
   differs, look for a report whose title contains "tồn kho". Use the period
   the user asked for; if they did not say, use the current month to date and
   say so.
3. **Read the table**: mã hàng, tên hàng, đơn vị tính, kho, số lượng tồn
   cuối kỳ and giá trị tồn cuối kỳ (plus đầu kỳ / nhập / xuất if shown).
   Note the report title, period and filters exactly as displayed.
4. **Save evidence** in the company workspace (current directory):
   `evidence/misa/<YYYY-MM-DD>/ton-kho-<HHMMSS>.csv` with the rows you read,
   and `…/ton-kho-<HHMMSS>.md` with: time read, page host and path (no query
   string), browser profile, company and book (data file) as seen in MISA, how
   the company was verified (a, b or c), report title, period, filters, row
   count, totals, and the screenshot path if you were able to save one.
5. **Reply in Vietnamese**, short:
   - Công ty · sổ (tệp dữ liệu) và cách đã xác minh
   - Báo cáo, kỳ, bộ lọc
   - Tổng giá trị tồn cuối kỳ và số mặt hàng
   - Điểm cần chú ý: tồn âm, số lượng 0 nhưng còn giá trị, mặt hàng giá trị lớn
     nhất (tối đa 5 dòng)
   - Nếu công ty có sổ khác, nói đã đọc sổ nào và hỏi có muốn xem sổ kia không
   - Đường dẫn file bằng chứng, viết thành liên kết Markdown tới đường dẫn
     tuyệt đối đầy đủ (ví dụ `[Bảng CSV](C:/Users/.../ton-kho-152241.csv)`) để
     người dùng bấm mở được trong ứng dụng
   - Nếu dừng giữa chừng: dừng ở bước nào, vì sao, người dùng cần làm gì
