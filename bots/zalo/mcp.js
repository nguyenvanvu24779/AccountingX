// Zalo tools for the AI (an MCP server over stdio, registered in Codex's config
// by the app). It is a thin client of AccountingX's own local API — it holds no
// Zalo session itself — and only exposes what the app lets an agent do:
//   zalo_status        who the bot is logged in as and who is on the approver list
//   zalo_send_message  a message to someone ON that list, never anyone else
//   approval_request  ask the approvers to approve a write (they are told on Zalo)
//   approval_consume  spend an approval a person gave, right before acting on it
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

async function approvals(path, body) {
  const response = await fetch(`${api}/api/approvals/${path}`, {
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
      'Use it to report results or ask a person to act; no approval is needed to message a registered person. To get a write action (email, MISA) approved, create an approval ticket instead: approvers are notified on Zalo automatically. ' +
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

const evidenceSchema = z.object({
  label: z.string().describe('Short name, e.g. "Form đã điền"'),
  path: z.string().describe('Path of a saved file (screenshot, CSV) in the company folder'),
});

server.registerTool(
  'approval_request',
  {
    title: 'Ask for approval of a write',
    description:
      'Creates an approval ticket for a write action (for example saving a voucher in MISA) and tells the approvers on Zalo. ' +
      'Nothing is approved yet: stop here, tell the user the ticket code and that you are waiting, and do not perform the write. ' +
      'When an approver says yes you are woken with the ticket code; then call approval_consume with the SAME payload and only then perform the write.',
    inputSchema: {
      company: z.string().describe('Company MST (the name of its folder)'),
      summary: z.string().describe('One Vietnamese line saying what will be written, shown to the approver'),
      payload: z
        .record(z.string(), z.any())
        .describe('The exact action: company, book, voucher type, date, amounts, accounts, description. Shown in full to the approver.'),
      evidence: z.array(evidenceSchema).optional().describe('Files that back the request, such as a screenshot of the filled form'),
    },
  },
  async ({ company, summary, payload, evidence }) => {
    try {
      const ticket = await approvals('create', {
        kind: 'misaAction',
        companyId: company,
        summary,
        payload,
        evidence: evidence ?? [],
        requestedBy: 'ai',
      });
      return text(
        `Approval ticket ${ticket.shortCode} created and sent to the approvers. Do NOT write yet. Tell the user you are waiting for approval of ticket ${ticket.shortCode}.`
      );
    } catch (error) {
      return failure(error);
    }
  }
);

server.registerTool(
  'approval_consume',
  {
    title: 'Spend an approval',
    description:
      'Spends an approved ticket right before you perform the write. It succeeds only if a person approved this exact payload within 24 hours and nobody used it yet; it works once. ' +
      'If it fails, do not perform the write and tell the user why.',
    inputSchema: {
      shortCode: z.string().describe('The ticket code'),
      payload: z.record(z.string(), z.any()).describe('Exactly the payload that was approved, unchanged'),
    },
  },
  async ({ shortCode, payload }) => {
    try {
      await approvals('consume', { shortCode, kind: 'misaAction', payload });
      return text('Approval spent. You may now perform exactly the approved write, once.');
    } catch (error) {
      return failure(error);
    }
  }
);

await server.connect(new StdioServerTransport());
