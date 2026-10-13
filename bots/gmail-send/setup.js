// One-time OAuth consent for the Gmail-send MCP server.
//
// Before running this:
//   1. In Google Cloud Console, create a project (or use an existing one)
//      and enable the Gmail API.
//   2. Create an OAuth client of type "Desktop app". Copy its client ID and
//      client secret.
//   3. In the OAuth consent screen, only request the
//      https://www.googleapis.com/auth/gmail.send scope — nothing broader.
//
// Then run:
//   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node setup.js
//
// It prints a Google sign-in URL. Open it, approve, and this script saves a
// refresh token to ~/.accountingx/gmail/token.json. `server.js` (and the
// AccountingX MCP server config for it) needs the SAME client ID/secret at
// runtime — set them as that MCP server's env vars in Settings, not just
// here.
//
// This has not been run against a real Google account — the OAuth flow
// below follows Google's documented loopback redirect for "Desktop app"
// clients, but the first real run is what proves it works end to end.

import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { google } from 'googleapis';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first.');
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}/oauth2callback`;
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // forces a refresh_token even on a re-consent
  scope: ['https://www.googleapis.com/auth/gmail.send'],
});

console.log('\nOpen this URL, sign in, and approve:\n');
console.log(authUrl);
console.log(`\nWaiting for the browser to redirect to ${redirectUri} ...\n`);

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth2callback')) {
    res.writeHead(404).end();
    return;
  }
  const code = new URL(req.url, redirectUri).searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('No authorization code in the callback.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      res.writeHead(200).end(
        'Google did not return a refresh token (it only does on first consent). ' +
          'Revoke this app\'s access at https://myaccount.google.com/permissions and run setup again.'
      );
      server.close();
      return;
    }

    const dir = join(homedir(), '.accountingx', 'gmail');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'token.json'), JSON.stringify({ refresh_token: tokens.refresh_token }, null, 2));

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(
      'Done — you can close this tab. The refresh token was saved.'
    );
    console.log('Saved refresh token to ~/.accountingx/gmail/token.json');
  } catch (err) {
    res.writeHead(500).end(`Could not exchange the code for a token: ${err}`);
    console.error(err);
  } finally {
    server.close();
  }
});

server.listen(PORT);
