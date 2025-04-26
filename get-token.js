import fs from 'fs/promises';
import readline from 'readline';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

async function loadCredentials() {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  return JSON.parse(content).installed;
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function main() {
  const { client_id, client_secret, redirect_uris } = await loadCredentials();

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n🧠 Visit this URL to authorize the app:\n', authUrl);

  const code = await askQuestion('\n📝 Paste the code here: ');
  const { tokens } = await oAuth2Client.getToken(code);

  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
  console.log('✅ Token saved to:', TOKEN_PATH);
}

main().catch(console.error);
