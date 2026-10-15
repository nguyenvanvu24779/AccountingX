---
name: accountingx-misa-ghi
description: Write something into MISA AMIS (create or save a voucher, entry or record) safely — fill the form, stop before saving, get a person's approval, then save and verify. Use for ANY request that changes data in MISA.
---

# MISA AMIS — ghi dữ liệu (cần duyệt)

This is the one playbook for every kind of change in MISA: vouchers (phiếu chi,
phiếu thu, mua hàng, bán hàng...), journal entries, master data. You may
prepare the change, but you **never save it before a person approves it**.

**First read and follow `../accountingx-misa-phien/SKILL.md`** (browser
profile, login, company and book check). Do not touch any form until its
steps 1–3 have passed for the company and book this change belongs to.

Never sign, post, submit a tax declaration, or delete records. If the request
is any of those, refuse and say a person must do it in MISA.

Use `cua_repl`. Be economical: read each screen once, avoid full-page dumps,
give up after 3 failed attempts at the same step and report where you stopped.

## Phase 1 — prepare, do not save

1. **Understand the request.** Work out the company, book, voucher type, date,
   amounts, accounts and description. If anything that changes the numbers is
   missing or ambiguous, ask the person (do not guess amounts, dates, accounts
   or counterparties).
2. **Open the right form** in MISA and fill every field. Menu names change
   between MISA versions; find the form by its title.
3. **Stop before the final button** (Cất, Lưu, Ghi sổ, Hoàn thành...). Leave
   the filled form open in the browser tab. Do not click it.
4. **Evidence.** Take a screenshot of the filled form and save it in the
   company folder under `evidence/misa/<yyyy-mm-dd>/ghi-<hhmmss>.png`.
5. **Ask for approval** with the `approval_request` tool:
   - `company`: the MST (the company folder name).
   - `summary`: one Vietnamese line, e.g. `Phiếu chi 5.000.000đ trả tiền điện T9 — Trí Nhân, Sổ 1`.
   - `payload`: the exact action as flat fields, for example
     `{ "congTy": "Trí Nhân", "so": "Sổ 1", "loai": "Phiếu chi", "ngay": "2026-10-15",
     "soTien": 5000000, "taiKhoanNo": "6427", "taiKhoanCo": "1111", "dienGiai": "..." }`.
     Keep it free of anything you did not actually fill in.
   - `evidence`: the screenshot.
6. **Stop and wait.** Tell the person the ticket code and that you are waiting
   for approval. End your turn. Do not save, and do not close the tab.

## Phase 2 — after approval

You are woken with a message saying ticket `<code>` was approved.

1. Call `approval_consume` with that code and **exactly the same payload** you
   approved. If it fails, do not save; tell the person why.
2. Go back to the filled form. If the form is gone, refill it from the payload
   only — and compare every field against the payload before saving.
3. Check the form still matches the payload (company, book, date, amounts,
   accounts). If anything differs, **do not save**; report the difference.
4. Click the final button **once**.
5. **Verify.** Open the saved record, screenshot it as
   `evidence/misa/<yyyy-mm-dd>/ghi-<hhmmss>-sau.png`, and compare it with the
   payload. Report `Công ty · Sổ`, what was saved, the voucher number MISA
   assigned, and any difference.

If the approval is rejected (or you are told so), discard the form without
saving and say so.

## Reporting

Answer in Vietnamese, short. Say what was prepared or saved, the approval code,
where the screenshots are, and anything that did not match.
