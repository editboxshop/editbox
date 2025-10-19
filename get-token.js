// get-token.js
require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const open = require('open');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.metadata.readonly'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const app = express();
const PORT = 3000;

app.get('/', async (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
  res.send(`<h2>Google OAuth Helper</h2>
    <p>Open the auth URL to continue:</p>
    <a href="${authUrl}" target="_blank">Authorize Google Drive</a>
    <p>Or the app attempted to open it for you. After consenting, Google will redirect to <code>${REDIRECT_URI}</code>.</p>`);
});

app.get('/oauth2callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('No code found in query params');
    }
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save tokens to file (use secure storage in prod)
    fs.writeFileSync('tokens.json', JSON.stringify(tokens, null, 2));
    console.log('Tokens saved to tokens.json');

    res.send('<h3>Success</h3><p>Tokens saved to <code>tokens.json</code>. You can close this window.</p>');
    // optionally shutdown server after success
    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error exchanging code for tokens: ' + err.message);
  }
});

app.listen(PORT, async () => {
  const url = `http://localhost:${PORT}/`;
  console.log('Visit this URL to authorize the app:', url);
  // open default browser automatically (optional)
  try { await open(url); } catch {}
});
