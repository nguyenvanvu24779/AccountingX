# Gmail-send MCP server

A minimal MCP server with exactly one tool, `send_email`, scoped to the
`gmail.send` OAuth permission only. It cannot read mail, list messages, or
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

`send_email` has no undo and no confirmation dialog of its own — by design,
MCP tools don't have one. The contract lives one layer up, in how the agent
is instructed to use it: draft the email, create an approval ticket (kind
`emailSend`, via `/api/approvals/create`) with the draft as evidence, and
only call `send_email` after that ticket is approved. This is a prompt-level
rule enforced by the agent's own instructions, not a hard gate in this
server — the same way `AGENTS.md` already asks the agent never to post a
ledger entry on its own. Until a Skill is written and installed for this
(not done yet — see the session's own open items), state this rule directly
in the bot's system prompt if you wire this server into one.
