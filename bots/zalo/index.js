// AccountingX Zalo sidecar.
//
// Spawned by the Rust `codexia-zalo` crate as a child process (one line of
// JSON in on stdin, one line of JSON out on stdout — the same shape
// `crates/codex/src/app_server.rs` uses for the Codex CLI). This file is
// never run standalone: it has no .env, no CLI args beyond what Rust passes
// via environment variables.
//
// Protocol
// --------
// In  (stdin,  one JSON object per line):
//   {"id": 1, "method": "start"}
//   {"id": 2, "method": "sendMessage", "params": {"threadId": "...", "threadType": "User"|"Group", "text": "..."}}
// Out (stdout, one JSON object per line):
//   Responses:     {"id": 1, "result": {...}} | {"id": 1, "error": "..."}
//   Notifications: {"method": "qr", "params": {"path": "<png file>"}}
//                  {"method": "loggedIn", "params": {}}
//                  {"method": "loggedOut", "params": {}}
//                  {"method": "message", "params": {"threadId", "threadType", "senderId", "text", "isSelf"}}
//                  {"method": "error", "params": {"message": "..."}}
//
// Session persistence is best-effort: zca-js's documented resume path is
// `zalo.login({cookie, imei, userAgent})`, but its docs only show obtaining
// `imei`/`userAgent` from a browser session, not from the QR-login result.
// We save whatever we can read off the logged-in `api` object after a QR
// login and try `login()` first on the next `start`; if the saved session
// doesn't work (wrong shape, expired), we fall back to `loginQR()` and the
// user scans again. This has not been run against a real account — the
// first real run is what proves (or disproves) the resume path.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Zalo, ThreadType } from 'zca-js';

const sessionDir = process.env.ACCOUNTINGX_ZALO_SESSION_DIR;
if (!sessionDir) {
  process.stderr.write('ACCOUNTINGX_ZALO_SESSION_DIR is not set\n');
  process.exit(1);
}
mkdirSync(sessionDir, { recursive: true });
const sessionFile = join(sessionDir, 'session.json');
const qrPath = join(sessionDir, 'qr.png');

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}
function notify(method, params) {
  send({ method, params });
}
function respond(id, result) {
  send({ id, result });
}
function respondError(id, message) {
  send({ id, error: String(message) });
}

function saveSession(api) {
  try {
    const cookie = typeof api.getCookie === 'function' ? api.getCookie().toJSON() : undefined;
    if (!cookie) return;
    const session = {
      cookie,
      imei: api.imei ?? api.context?.imei ?? null,
      userAgent: api.context?.userAgent ?? process.env.ACCOUNTINGX_ZALO_USER_AGENT ?? null,
    };
    writeFileSync(sessionFile, JSON.stringify(session, null, 2));
  } catch (err) {
    notify('error', { message: `could not save session: ${err}` });
  }
}

function loadSession() {
  if (!existsSync(sessionFile)) return null;
  try {
    const session = JSON.parse(readFileSync(sessionFile, 'utf-8'));
    if (!session.cookie || !session.imei || !session.userAgent) return null;
    return session;
  } catch {
    return null;
  }
}

let api = null;

async function start() {
  const zalo = new Zalo();
  const saved = loadSession();

  if (saved) {
    try {
      api = await zalo.login({ cookie: saved.cookie, imei: saved.imei, userAgent: saved.userAgent });
    } catch (err) {
      notify('error', { message: `saved session did not work, falling back to QR: ${err}` });
      api = null;
    }
  }

  if (!api) {
    mkdirSync(dirname(qrPath), { recursive: true });
    // loginQR() writes the QR image to qrPath and resolves only once it has
    // been scanned — there is no progress callback, so we tell the caller
    // where to look as soon as the call starts, not when the file appears.
    notify('qr', { path: qrPath });
    api = await zalo.loginQR({ qrPath });
    saveSession(api);
  }

  notify('loggedIn', {});

  api.listener.on('message', (message) => {
    if (message.isSelf) return;
    const content = message.data?.content;
    if (typeof content !== 'string') return;
    notify('message', {
      threadId: message.threadId,
      threadType: message.type === ThreadType.Group ? 'Group' : 'User',
      senderId: message.data?.uidFrom,
      text: content,
      isSelf: false,
    });
  });
  api.listener.onConnectionError?.((err) => {
    notify('error', { message: `listener connection error: ${err}` });
  });
  api.listener.start();
}

async function handleSendMessage(params) {
  if (!api) throw new Error('not logged in yet');
  const type = params.threadType === 'Group' ? ThreadType.Group : ThreadType.User;
  return await api.sendMessage({ msg: params.text }, params.threadId, type);
}

process.stdin.setEncoding('utf-8');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newlineAt = buffer.indexOf('\n');
  while (newlineAt !== -1) {
    const line = buffer.slice(0, newlineAt).trim();
    buffer = buffer.slice(newlineAt + 1);
    newlineAt = buffer.indexOf('\n');
    if (!line) continue;

    let request;
    try {
      request = JSON.parse(line);
    } catch (err) {
      notify('error', { message: `could not parse request line: ${err}` });
      continue;
    }

    const { id, method, params } = request;
    (async () => {
      try {
        if (method === 'start') {
          // Respond right away — logging in can take as long as the user
          // needs to scan the QR code. Progress comes through as
          // notifications (`qr`, `loggedIn`, `error`), not this response.
          respond(id, { status: 'starting' });
          start().catch((err) => notify('error', { message: `start failed: ${err}` }));
        } else if (method === 'sendMessage') {
          const result = await handleSendMessage(params ?? {});
          respond(id, result ?? {});
        } else {
          respondError(id, `unknown method "${method}"`);
        }
      } catch (err) {
        respondError(id, err);
      }
    })();
  }
});

process.stdin.on('end', () => process.exit(0));
