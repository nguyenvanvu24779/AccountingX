# Gmail-send MCP server

A minimal MCP server with two tools, `request_email_approval` and
`send_email`, scoped to the `gmail.send` OAuth permission only. It cannot read mail, list messages, or
do anything else — deliberately, since AccountingX's Email skill (V1) is
send-only.

This has **not been run against a real Google account**. The code follows
the Gmail API's and the MCP SDK's documented shapes (see the comments in
`server.js`/`setup.js` for exactly which docs), but the first real run on
your machine is what actually proves it.

## Who does this setup, and when

Everything below is done **once, by whoever builds/maintains AccountingX**
— not by every company or every end user. It's the same shape as any app
with a "Sign in with Google" button (Zoom, Canva, ...): the app's developer
registers one OAuth client with Google; every end user afterwards just sees
an ordinary Google sign-in screen and never touches Google Cloud Console.

An end user (an accountant using the finished app) never runs any of this.
What they'll eventually see is a "Connect Gmail" button in Settings that
opens the normal Google consent screen — step 2 below, nothing before it.

Until AccountingX is actually distributed to other people, "the developer"
is just you, testing on your own machine — so right now steps 1–2 are also
how *you* get this working for yourself.

## One-time setup (for the developer)

1. In [Google Cloud Console](https://console.cloud.google.com/), create or
   pick a project, enable the **Gmail API**, and create an OAuth client of
   type **Desktop app**. Copy its client ID and client secret.
   - While the app is in Google's "Testing" publishing status (the default,
     and fine for now), only Gmail addresses you explicitly add as a "test
     user" on the OAuth consent screen can sign in — add your own address,
     and later each real tester's. Moving beyond ~100 test users means
     submitting the app for Google's verification, a separate, later step.
   - The client ID/secret are set **once** and then shipped with the app
     (or, during development, kept in your own `.env`) — a company created
     in Step C does **not** re-enter them. Only the person connecting their
     Gmail account (step 2) does anything per-account, and that's just a
     normal sign-in, not a credential.
2. In this folder:
   ```bash
   bun install
   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... bun run setup
   ```
   Open the printed URL, sign in, approve. This saves a refresh token to
   `~/.accountingx/gmail/token.json` — nothing else is written anywhere.
3. In AccountingX → Plugins/Connectors → add a **custom** MCP server (the
   generic "add your own MCP server" form, not a one-click preset — this
   server's path is specific to your machine, so there's no portable
   preset for it):
   - Command: `node`
   - Args: the **absolute path** to this folder's `server.js`
   - Env: `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` — the same two values
     from step 1
   - Scope it to the Claude Code agent (`cc`), same as Playwright-MCP would
     have been.

Turning step 3 into an actual "Connect Gmail" button (so nobody has to type
a file path or env vars by hand) is packaging work that hasn't been done
yet — same open gap as not having a bundled Node runtime for the Zalo
sidecar. Right now this is wired for a developer testing it, not for a
real end user.

## The safety contract

The approval is enforced by this server, not left to the model:

1. `request_email_approval(to, subject, body, summary)` files an `emailSend`
   ticket in AccountingX holding the exact email, and returns a 6-digit code.
2. A person approves it in AccountingX (Settings → Chờ duyệt, which shows the
   full recipient, subject and body) or by replying `<code> duyệt` on Zalo.
3. `send_email(to, subject, body, approvalCode)` asks AccountingX to spend the
   approval (`/api/approvals/consume`). It only succeeds when that code was
   approved for exactly this email, within 24 hours, and never used before.
   Otherwise nothing is sent and the error says why.

The agent cannot approve its own request: deciding a ticket is not on the
local HTTP API at all — only the desktop UI (via a Tauri command) and
whitelisted Zalo approvers can do it.

Requires AccountingX running (its local server on `127.0.0.1:7419`; override
with `ACCOUNTINGX_API_URL`).

Known limit: whoever can read the OAuth token in `~/.accountingx/gmail/` could
call the Gmail API directly, bypassing this server. Keep the agent's sandbox
from reading that folder.
