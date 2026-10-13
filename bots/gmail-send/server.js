// Gmail-send MCP server: send-only, and only with a person's approval.
//
// Spawned as a generic stdio MCP server (the same mechanism Codex/Claude
// already use for Playwright-style servers — see src/features/mcp). Not a
// general Gmail integration: the OAuth consent it was set up with (see
// setup.js) only ever requested https://www.googleapis.com/auth/gmail.send.
// It cannot read mail.
//
// Two tools, so the approval is enforced here rather than left to the model:
//   request_email_approval  files an approval ticket in AccountingX holding
//                           the exact recipient, subject and body;
//   send_email              sends only if AccountingX confirms a person
//                           approved that exact email, and spends the
//                           approval so it can't be reused.
//
// This has not been run against a real Google account yet. The MCP
// registration/tool API matches the official SDK's documented stdio
// example (@modelcontextprotocol/sdk 1.32.1); the Gmail call matches the
// Gmail API's documented `users.messages.send` shape. The first real
// `send_email` call is what proves the two fit together correctly.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { google } from 'googleapis';
import { z } from 'zod';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  process.stderr.write('GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET are not set for this MCP server.\n');
  process.exit(1);
}

const tokenPath = join(homedir(), '.accountingx', 'gmail', 'token.json');
let refreshToken;
try {
  refreshToken = JSON.parse(readFileSync(tokenPath, 'utf-8')).refresh_token;
} catch {
  process.stderr.write(`No saved Gmail session at ${tokenPath}. Run "bun run setup" in bots/gmail-send first.\n`);
  process.exit(1);
}

// AccountingX's own loopback server (DESKTOP_LOCAL_PORT in the app).
const approvalsApi = process.env.ACCOUNTINGX_API_URL ?? 'http://127.0.0.1:7419';

async function callApprovals(path, body) {
  const response = await fetch(`${approvalsApi}/api/approvals/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `AccountingX approvals API returned ${response.status}`);
  }
  return data;
}

const EMAIL_ADDRESS = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

const emailSchema = {
  to: z.string().regex(EMAIL_ADDRESS, 'one plain email address').describe('Recipient email address'),
  subject: z.string().refine((v) => !/[\r\n]/.test(v), 'subject must be a single line'),
  body: z.string().describe('Plain text body'),
};

function errorResult(text) {
  return { isError: true, content: [{ type: 'text', text }] };
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
oauth2Client.setCredentials({ refresh_token: refreshToken });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

/** A minimal RFC 2822 message, base64url-encoded the way the Gmail API wants `raw`. */
function buildRawMessage({ to, subject, body }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
  const encodedBody = Buffer.from(body, 'utf-8').toString('base64');
  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
  ].join('\r\n');
  return Buffer.from(message, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const server = new McpServer({ name: 'accountingx-gmail-send', version: '0.1.0' });

server.registerTool(
  'request_email_approval',
  {
    title: 'Request approval to send an email',
    description:
      'Files an approval request in AccountingX for this exact email and returns a 6-digit code. ' +
      'Tell the user the code and that a person must approve it in AccountingX (or by Zalo), then stop and wait. ' +
      'Any change to the recipient, subject or body needs a new approval.',
    inputSchema: {
      ...emailSchema,
      summary: z.string().describe('One line for the approver, e.g. "Send March invoice to Trí Nhân"'),
      companyId: z.string().optional().describe('Company MST this email belongs to, if any'),
    },
  },
  async ({ to, subject, body, summary, companyId }) => {
    try {
      const ticket = await callApprovals('create', {
        kind: 'emailSend',
        summary,
        companyId,
        payload: { to, subject, body },
        requestedBy: 'gmail-send',
      });
      return {
        content: [
          {
            type: 'text',
            text: `Approval requested. Code: ${ticket.shortCode}. Waiting for a person to approve it in AccountingX. Do not call send_email until they confirm.`,
          },
        ],
      };
    } catch (error) {
      return errorResult(`Could not request approval: ${error.message}`);
    }
  }
);

server.registerTool(
  'send_email',
  {
    title: 'Send an approved email',
    description:
      'Sends a plain-text email from the connected Gmail account. Requires the code from request_email_approval ' +
      'after a person approved it, and the exact same recipient, subject and body. It has no undo.',
    inputSchema: {
      ...emailSchema,
      approvalCode: z.string().regex(/^\d{6}$/).describe('6-digit code a person approved'),
    },
  },
  async ({ to, subject, body, approvalCode }) => {
    try {
      // Spends the approval first: if Gmail then fails, the user asks again
      // rather than an approval lingering that could be replayed.
      await callApprovals('consume', {
        shortCode: approvalCode,
        kind: 'emailSend',
        payload: { to, subject, body },
      });
    } catch (error) {
      return errorResult(`Not sent. ${error.message}`);
    }

    const raw = buildRawMessage({ to, subject, body });
    const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return { content: [{ type: 'text', text: `Sent. Gmail message id: ${result.data.id}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
