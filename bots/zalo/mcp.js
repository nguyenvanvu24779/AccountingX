// Zalo tools for the AI (an MCP server over stdio, registered in Codex's config
// by the app). It is a thin client of AccountingX's own local API — it holds no
// Zalo session itself — and only exposes what the app lets an agent do:
//   zalo_status        who the bot is logged in as and who is on the approver list
//   zalo_send_message  a message to someone ON that list, never anyone else
// The limits (whitelist, length, rate) are enforced by the app, not here.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const api = process.env.ACCOUNTINGX_API_URL ?? 'http://127.0.0.1:7419';

async function call(path, body = {}) {
  const response = await fetch(`${api}/api/zalo/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `AccountingX returned ${response.status}`);
  return data;
}

const text = (value) => ({ content: [{ type: 'text', text: value }] });
const failure = (error) => ({ isError: true, content: [{ type: 'text', text: String(error.message ?? error) }] });

const server = new McpServer({ name: 'accountingx-zalo', version: '0.1.0' });

server.registerTool(
  'zalo_status',
  {
    title: 'Zalo status',
    description:
      'Shows whether the Zalo bot is connected, which account it is, and the people registered to receive messages (name, Zalo ID, whether they can approve tickets or give commands). Read-only.',
    inputSchema: {},
  },
  async () => {
    try {
      const [status, approvers] = await Promise.all([call('status'), call('approvers/list')]);
      const lines = [
        status.connected
          ? `Connected as ${status.account?.displayName ?? 'unknown'} (Zalo ID ${status.account?.userId ?? '?'}).`
          : status.connecting
            ? 'Zalo is connecting (waiting for the QR code to be scanned).'
            : 'Zalo is not connected. A person must connect it in Settings > Zalo.',
        approvers.length === 0
          ? 'No approvers are registered.'
          : 'Registered people:\n' +
            approvers
              .map(
                (a) =>
                  `- ${a.displayName} (ID ${a.zaloUserId})${a.canApprove ? ', can approve' : ''}${a.canCommand ? ', can give commands' : ''}`
              )
              .join('\n'),
      ];
      return text(lines.join('\n'));
    } catch (error) {
      return failure(error);
    }
  }
);

server.registerTool(
  'zalo_send_message',
  {
    title: 'Send a Zalo message',
    description:
      'Sends a short Zalo message to a person registered in AccountingX (by name or Zalo ID). It cannot message anyone else, is limited to 1500 characters and rate-limited. ' +
      'Use it to report results or ask a person to act. To get something approved, create an approval ticket instead: approvers are notified on Zalo automatically. ' +
      'Never include passwords, OTP codes or secrets.',
    inputSchema: {
      to: z.string().describe('Name or Zalo ID of a registered person'),
      text: z.string().describe('Message text, Vietnamese preferred'),
    },
  },
  async ({ to, text: message }) => {
    try {
      const result = await call('send', { to, text: message });
      return text(`Sent to ${result.sentTo}.`);
    } catch (error) {
      return failure(error);
    }
  }
);

await server.connect(new StdioServerTransport());
