'use strict';

const path = require('path');
const crypto = require('crypto');
require('dotenv').config();
const express = require('express');

const app = express();
app.disable('x-powered-by');

const PORT = Number(process.env.PORT) || 3000;
const OPENLP_BASE_URL = (process.env.OPENLP_BASE_URL || 'http://openlp-host:4316').replace(/\/+$/, '');
const OPENLP_USERNAME = process.env.OPENLP_USERNAME || '';
const OPENLP_PASSWORD = process.env.OPENLP_PASSWORD || '';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

app.use(express.json());

const sessions = new Map();

function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { expires: Date.now() + SESSION_TTL_MS });
  return token;
}

function parseCookie(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    if (key) out[key] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function hasAppSession(req) {
  if (!APP_PASSWORD) return true;
  const s = sessions.get(parseCookie(req).openlp_session);
  return !!s && Date.now() <= s.expires;
}

app.post('/api/login', (req, res) => {
  if (!APP_PASSWORD) return res.status(400).json({ error: 'no-app-password' });
  const password = (req.body && req.body.password) || '';
  if (password !== APP_PASSWORD) return res.status(401).json({ error: 'invalid-password' });
  const token = createSession();
  res.setHeader(
    'Set-Cookie',
    `openlp_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
  );
  res.json({ ok: true });
});

app.get('/api/config', (req, res) => {
  res.json({ pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 1500 });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

let openlpToken = null;
let loginRunning = null;

async function loginOpenLP() {
  const res = await fetch(OPENLP_BASE_URL + '/api/v2/core/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: OPENLP_USERNAME, password: OPENLP_PASSWORD }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('OpenLP login failed: ' + res.status);
  openlpToken = (await res.json()).token;
}

async function getOpenLPToken() {
  if (openlpToken) return openlpToken;
  if (!loginRunning) {
    loginRunning = loginOpenLP().finally(() => {
      loginRunning = null;
    });
  }
  return loginRunning;
}

app.use('/api/openlp', (req, res) => {
  if (!hasAppSession(req)) return res.status(401).json({ error: 'unauthorized' });

  const target = OPENLP_BASE_URL + '/api/v2' + req.path;
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };

  const send = async () => {
    let up;
    try {
      if (OPENLP_USERNAME && OPENLP_PASSWORD) {
        const token = await getOpenLPToken();
        headers.Authorization = token;
      }
      const init = { method: req.method, headers, signal: AbortSignal.timeout(15000) };
      if (req.method === 'POST' && req.body) init.body = JSON.stringify(req.body);
      up = await fetch(target, init);
    } catch (err) {
      return res.status(502).json({ error: 'openlp-unreachable', detail: String(err.message || err) });
    }

    if (up.status === 401 && OPENLP_USERNAME && OPENLP_PASSWORD) {
      openlpToken = null;
      try {
        await loginOpenLP();
        headers.Authorization = openlpToken;
        const init = {
          method: req.method,
          headers,
          signal: AbortSignal.timeout(15000),
        };
        if (req.method === 'POST' && req.body) init.body = JSON.stringify(req.body);
        up = await fetch(target, init);
      } catch (err) {
        return res.status(502).json({ error: 'openlp-auth-failed', detail: String(err.message || err) });
      }
    }

    if (up.status === 401) return res.status(502).json({ error: 'openlp-auth-failed' });

    res.status(up.status);
    res.setHeader('Content-Type', 'application/json');
    const text = await up.text();
    res.send(text);
  };

  send().catch((err) => {
    res.status(500).json({ error: 'proxy-error', detail: String(err.message || err) });
  });
});

app.use(express.static(path.join(__dirname, '..', 'static')));

app.listen(PORT, () => {
  console.log(`[openlp-simple-remote] listening on :${PORT}`);
  console.log(`[openlp-simple-remote] proxying to ${OPENLP_BASE_URL}`);
});