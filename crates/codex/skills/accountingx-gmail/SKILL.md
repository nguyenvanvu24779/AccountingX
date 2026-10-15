---
name: accountingx-gmail
description: Write and send an email from the user's Gmail (with the Gmail plugin) safely — draft it, get a person's approval, then send exactly what was approved. Use whenever an email must go out, for example sending a report or a reminder.
---

# Gmail — gửi email (cần duyệt)

Sending email is an action that leaves the company, so a person approves every
email **before** it is sent. You may draft freely; you never send first.

Use the Gmail plugin's tools to create drafts and to send. Messaging a
registered person on Zalo is different and needs no approval (use
`zalo_send_message`); this skill is only for email.

## Steps

1. **Work out the email.** Recipient(s), subject, and body, in Vietnamese unless
   asked otherwise. If the recipient or the content is unclear, ask the person
   (never guess an address). Only use addresses the person gave you or that
   clearly belong to the company's own contacts.
2. **Attach evidence from the company folder only** (for example the CSV or the
   evidence note of a report). Never attach files from outside it, and never
   include passwords, OTP codes or secrets.
3. **Show the draft.** Create it as a draft in Gmail or keep the text ready, but
   **do not send**.
4. **Ask for approval** with the `approval_request` tool:
   - `kind`: `emailSend`.
   - `company`: the MST (the company folder name).
   - `summary`: one Vietnamese line, e.g. `Gửi báo cáo tồn kho 15/10 cho a@abc.vn`.
   - `payload`: the exact email as flat fields:
     `{ "to": "a@abc.vn", "subject": "...", "body": "...", "attachments": ["evidence/misa/2026-10-15/ton-kho-092332.csv"] }`
     (one address in `to`; use several tickets for several recipients).
   - `evidence`: the files you would attach.
5. **Stop and wait.** Tell the person the ticket code and that you are waiting
   for approval. End your turn. Do not send.

## After approval

You are woken with a message saying ticket `<code>` was approved.

1. Call `approval_consume` with `kind: emailSend`, that code, and **exactly the
   same payload**. If it fails, do not send; tell the person why.
2. Send exactly that email with the Gmail plugin, **once**. Change nothing.
3. Report in Vietnamese: sent to whom, the subject, and the ticket code.

If the approval is rejected, do not send and say so.

## Never

- Never send without an approved ticket for exactly that email.
- Never read, search or summarize the user's inbox unless the person asked for
  that specific thing.
- Never forward or reply to emails you were not asked about.
