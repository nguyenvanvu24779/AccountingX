// Gmail-send MCP server: one tool, one scope.
//
// Spawned as a generic stdio MCP server (the same mechanism Codex/Claude
// already use for Playwright-style servers — see src/features/mcp). Not a
// general Gmail integration: it only exposes `send_email`, and the OAuth
// consent it was set up with (see setup.js) only ever requested
// https://www.googleapis.com/auth/gmail.send. It cannot read mail.
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
  'send_email',
  {
    title: 'Send email',
    description:
      'Sends a plain-text email from the connected Gmail account. Call this only after the exact recipient, subject and body have been shown to and approved by a human — it has no undo.',
    inputSchema: {
      to: z.string().describe('Recipient email address'),
      subject: z.string(),
      body: z.string().describe('Plain text body'),
    },
  },
  async ({ to, subject, body }) => {
    const raw = buildRawMessage({ to, subject, body });
    const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return { content: [{ type: 'text', text: `Sent. Gmail message id: ${result.data.id}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
