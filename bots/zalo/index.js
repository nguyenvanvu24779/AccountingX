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
//                  {"method": "loggedIn", "params": {"account": {"userId", "displayName", "avatar"}}}
//                  {"method": "qrScanned", "params": {"displayName"}}
//                  {"method": "loginFailed", "params": {"message": "expired" | "declined" | "failed"}}
//                  {"method": "loggedOut", "params": {}}
//                  {"method": "message", "params": {"threadId", "threadType", "senderId", "senderName", "groupName", "mentionedMe", "text", "isSelf"}}
//                  {"method": "error", "params": {"message": "..."}}
//
// Session persistence: after a QR login we save the cookie plus the imei and
// userAgent that zca-js reports through api.getContext(), and try
// `zalo.login({cookie, imei, userAgent})` first on the next start. If the saved
// session is rejected (expired, wrong shape) we fall back to the QR code.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LoginQRCallbackEventType, Zalo, ThreadType } from 'zca-js';

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
    // zca-js exposes the login context (imei, userAgent) through getContext();
    // login({cookie, imei, userAgent}) needs both back to resume this session.
    const context = api.getContext();
    if (!context?.imei || !context?.userAgent) {
      notify('error', { message: 'could not save session: login context has no imei/userAgent' });
      return;
    }
    const session = { cookie, imei: context.imei, userAgent: context.userAgent };
    writeFileSync(sessionFile, JSON.stringify(session, null, 2), { mode: 0o600 });
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

const groupNames = new Map();

/** A group's name, looked up once and remembered. Empty if it cannot be read. */
async function groupName(groupId) {
  if (groupNames.has(groupId)) return groupNames.get(groupId);
  let name = '';
  try {
    const info = await api.getGroupInfo(groupId);
    name = info?.gridInfoMap?.[groupId]?.name ?? '';
  } catch {
    // Not fatal: the app falls back to a generic name.
  }
  groupNames.set(groupId, name);
  return name;
}

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
    // The QR code is only valid for about a minute and a half. We tell the app
    // about it once the image file is really written, and when it expires or is
    // declined we stop and let the user press Connect again for a fresh one.
    let ended = false;
    const endLogin = (event, message) => {
      ended = true;
      event.actions.abort();
      notify('loginFailed', { message });
    };
    api = await zalo.loginQR({ qrPath }, async (event) => {
      switch (event.type) {
        case LoginQRCallbackEventType.QRCodeGenerated:
          await event.actions.saveToFile(qrPath);
          notify('qr', { path: qrPath });
          break;
        case LoginQRCallbackEventType.QRCodeScanned:
          notify('qrScanned', { displayName: event.data.display_name });
          break;
        case LoginQRCallbackEventType.QRCodeExpired:
          endLogin(event, 'expired');
          break;
        case LoginQRCallbackEventType.QRCodeDeclined:
          endLogin(event, 'declined');
          break;
        default:
          break;
      }
    });
    if (ended || !api) return;
    saveSession(api);
  }

  // Who the bot is logged in as, so the app can show it. Best effort: the
  // connection works without it. Phone number and other profile fields are
  // deliberately not forwarded.
  let account;
  try {
    const { profile } = await api.fetchAccountInfo();
    account = {
      userId: String(profile.userId),
      displayName: profile.displayName || profile.zaloName || '',
      avatar: profile.avatar || null,
    };
  } catch (err) {
    notify('error', { message: `could not read account info: ${err}` });
  }
  notify('loggedIn', { account });

  api.listener.on('message', (message) => {
    if (message.isSelf) return;
    const content = message.data?.content;
    if (typeof content !== 'string') return;
    const isGroup = message.type === ThreadType.Group;
    // Was the bot @mentioned? (type 1 is "@all", which does not count.)
    const ownId = String(api.getOwnId());
    const mentionedMe = (message.data?.mentions ?? []).some(
      (m) => m.type !== 1 && String(m.uid) === ownId
    );
    (async () => {
      notify('message', {
        threadId: message.threadId,
        threadType: isGroup ? 'Group' : 'User',
        senderId: message.data?.uidFrom,
        senderName: message.data?.dName ?? '',
        groupName: isGroup ? await groupName(message.threadId) : '',
        mentionedMe,
        text: content,
        isSelf: false,
      });
    })();
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
          start().catch((err) => {
            notify('error', { message: `start failed: ${err}` });
            notify('loginFailed', { message: 'failed' });
          });
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
