#!/usr/bin/env node

import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

function parseDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const env = {
  ...parseDotEnv(join(ROOT, '.env')),
  ...process.env,
};

const HTTP_PORT = Number(getArg('--http-port') || env.OFFICE_ADDIN_HTTP_PORT || 3300);
const HTTPS_PORT = Number(getArg('--https-port') || env.OFFICE_ADDIN_HTTPS_PORT || 3446);
const SESSION_EXPIRY_HOURS = Number(env.OFFICE_ADDIN_SESSION_EXPIRY_HOURS || 12);
const HERMES_API_BASE_URL = String(env.HERMES_API_BASE_URL || 'http://127.0.0.1:8642').replace(/\/+$/, '');
const HERMES_API_KEY = String(env.HERMES_API_KEY || '');
const HERMES_API_AUTH_HEADER = String(env.HERMES_API_AUTH_HEADER || 'x-api-key');
const HERMES_API_AUTH_SCHEME = String(env.HERMES_API_AUTH_SCHEME || '').trim();
const OFFICE_ADDIN_PASSPHRASE = String(env.OFFICE_ADDIN_PASSPHRASE || '');
const CERT_FILE = resolve(ROOT, env.OFFICE_ADDIN_CERT_FILE || 'certs/localhost.crt');
const KEY_FILE = resolve(ROOT, env.OFFICE_ADDIN_KEY_FILE || 'certs/localhost.key');
const ALLOWED_ORIGINS = Array.from(new Set([
  `http://localhost:${HTTP_PORT}`,
  `https://localhost:${HTTPS_PORT}`,
  ...String(env.OFFICE_ADDIN_ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean),
]));

const sessions = new Map();

function makeAuthHeaderValue() {
  if (!HERMES_API_KEY) return '';
  return HERMES_API_AUTH_SCHEME ? `${HERMES_API_AUTH_SCHEME} ${HERMES_API_KEY}` : HERMES_API_KEY;
}

function nowIso() {
  return new Date().toISOString();
}

function getOrigin(req) {
  return req.headers.origin || '';
}

function writeCors(req, res) {
  const origin = getOrigin(req);
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token, X-Hermes-Session-Id, Idempotency-Key, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-Hermes-Session-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
}

function sendJson(req, res, status, payload) {
  writeCors(req, res);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(req, res, status, html) {
  writeCors(req, res);
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', rejectBody);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  return JSON.parse(body.toString('utf8'));
}

function getNextSessionExpiry() {
  return Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
}

function issueSession() {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = getNextSessionExpiry();
  sessions.set(token, { createdAt: Date.now(), expiresAt });
  return { token, expiresAt };
}

function getSessionToken(req) {
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken) return headerToken;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  return null;
}

function getValidSession(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = getNextSessionExpiry();
  sessions.set(token, session);
  return { token, ...session };
}

function buildAppHtml(appName) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hermes Agent ${appName}</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; }
      main { max-width: 780px; margin: 48px auto; padding: 24px; }
      .card { background: #111827; border: 1px solid #334155; border-radius: 16px; padding: 24px; }
      code { background: #1e293b; padding: 2px 6px; border-radius: 6px; }
      h1 { margin-top: 0; }
      ul { line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>Hermes Agent for ${appName}</h1>
        <p>The bridge is live, but this add-in frontend has not been built yet.</p>
        <ul>
          <li>Health: <code>/health</code></li>
          <li>Login: <code>/auth/login</code></li>
          <li>Session check: <code>/auth/session</code></li>
          <li>Backend proxy: <code>/api/*</code></li>
        </ul>
      </div>
    </main>
  </body>
</html>`;
}

function getDistDir(appName) {
  return join(ROOT, 'packages', appName, 'dist');
}

function getMimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

function tryServeBuiltApp(req, res, appName, pathname) {
  const distDir = getDistDir(appName);
  if (!existsSync(distDir)) return false;

  const appBase = `/${appName}`;
  const relativePath = pathname === appBase || pathname === `${appBase}/`
    ? '/index.html'
    : pathname.startsWith(`${appBase}/`)
      ? pathname.slice(appBase.length)
      : null;

  if (!relativePath) return false;

  const candidatePath = resolve(distDir, `.${relativePath}`);
  if (!candidatePath.startsWith(distDir)) {
    sendJson(req, res, 403, { error: 'Forbidden path' });
    return true;
  }

  if (!existsSync(candidatePath)) return false;

  writeCors(req, res);
  res.writeHead(200, {
    'Content-Type': getMimeType(candidatePath),
    'Cache-Control': candidatePath.endsWith('.html') ? 'no-store' : 'public, max-age=3600',
  });
  res.end(readFileSync(candidatePath));
  return true;
}

async function proxyApiRequest(req, res, url) {
  const session = getValidSession(req);
  if (!session) {
    writeCors(req, res);
    res.writeHead(401, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'x-hermes-office-auth': 'bridge-session-expired',
    });
    res.end(JSON.stringify({ error: 'Not authenticated' }, null, 2));
    return;
  }

  const upstreamBase = new URL(HERMES_API_BASE_URL);
  const upstreamUrl = new URL(upstreamBase.toString());
  upstreamUrl.pathname = `${upstreamBase.pathname.replace(/\/$/, '')}${url.pathname.replace(/^\/api/, '')}` || '/';
  upstreamUrl.search = url.search;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (['host', 'content-length', 'connection', 'origin', 'x-session-token', 'authorization'].includes(lower)) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const authHeaderValue = makeAuthHeaderValue();
  if (authHeaderValue) {
    headers.set(HERMES_API_AUTH_HEADER, authHeaderValue);
  }
  headers.set('x-hermes-office-bridge', 'true');
  headers.set('x-hermes-office-session', session.token);

  const body = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readBody(req);

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    const upstreamBody = Buffer.from(await upstreamRes.arrayBuffer());
    writeCors(req, res);
    const responseHeaders = {
      'Content-Type': upstreamRes.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': upstreamRes.headers.get('cache-control') || 'no-store',
    };
    const hermesSessionId = upstreamRes.headers.get('x-hermes-session-id');
    if (hermesSessionId) {
      responseHeaders['X-Hermes-Session-Id'] = hermesSessionId;
    }
    res.writeHead(upstreamRes.status, responseHeaders);
    res.end(upstreamBody);
  } catch (error) {
    sendJson(req, res, 502, {
      error: 'Upstream Hermes API request failed',
      details: error instanceof Error ? error.message : String(error),
      upstream: upstreamUrl.toString(),
    });
  }
}

async function handleRequest(req, res) {
  const host = req.headers.host || `localhost:${HTTP_PORT}`;
  const proto = req.socket.encrypted ? 'https' : 'http';
  const url = new URL(req.url || '/', `${proto}://${host}`);

  if (req.method === 'OPTIONS') {
    writeCors(req, res);
    res.writeHead(204);
    return res.end();
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    return sendJson(req, res, 200, {
      ok: true,
      service: 'hermes-agent-office-bridge',
      time: nowIso(),
      httpPort: HTTP_PORT,
      httpsPort: HTTPS_PORT,
      httpsEnabled: existsSync(CERT_FILE) && existsSync(KEY_FILE),
      backendBaseUrl: HERMES_API_BASE_URL,
      authHeader: HERMES_API_AUTH_HEADER,
      requiresPassphrase: Boolean(OFFICE_ADDIN_PASSPHRASE),
      sessionExpiryHours: SESSION_EXPIRY_HOURS,
      allowedOrigins: ALLOWED_ORIGINS,
    });
  }

  if (url.pathname === '/auth/login' && req.method === 'POST') {
    if (!OFFICE_ADDIN_PASSPHRASE) {
      return sendJson(req, res, 503, {
        error: 'OFFICE_ADDIN_PASSPHRASE is not configured',
      });
    }

    try {
      const body = await readJson(req);
      if ((body.passphrase || '') !== OFFICE_ADDIN_PASSPHRASE) {
        return sendJson(req, res, 401, { error: 'Invalid passphrase' });
      }
      const session = issueSession();
      return sendJson(req, res, 200, {
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
      });
    } catch (error) {
      return sendJson(req, res, 400, {
        error: 'Invalid JSON request body',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (url.pathname === '/auth/logout' && req.method === 'POST') {
    const token = getSessionToken(req);
    if (token) sessions.delete(token);
    return sendJson(req, res, 200, { ok: true });
  }

  if (url.pathname === '/auth/session' && req.method === 'GET') {
    const session = getValidSession(req);
    return sendJson(req, res, 200, {
      authenticated: Boolean(session),
      expiresAt: session ? new Date(session.expiresAt).toISOString() : null,
    });
  }

  if (url.pathname.startsWith('/api/')) {
    return proxyApiRequest(req, res, url);
  }

  if (url.pathname === '/' && req.method === 'GET') {
    return sendHtml(req, res, 200, buildAppHtml('Office'));
  }

  const appAssetMatch = url.pathname.match(/^\/(word|powerpoint|excel|outlook)(\/.*)?$/);
  if (appAssetMatch && req.method === 'GET') {
    const appName = appAssetMatch[1];
    if (tryServeBuiltApp(req, res, appName, url.pathname)) {
      return;
    }
    if (url.pathname === `/${appName}` || url.pathname === `/${appName}/`) {
      return sendHtml(req, res, 200, buildAppHtml(appName));
    }
  }

  return sendJson(req, res, 404, {
    error: 'Not found',
    path: url.pathname,
  });
}

const httpServer = createHttpServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendJson(req, res, 500, {
      error: 'Unhandled bridge error',
      details: error instanceof Error ? error.message : String(error),
    });
  });
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[hermes-office] HTTP  http://localhost:${HTTP_PORT}`);
  console.log(`[hermes-office] Health http://localhost:${HTTP_PORT}/health`);
});

if (existsSync(CERT_FILE) && existsSync(KEY_FILE)) {
  const httpsServer = createHttpsServer(
    {
      cert: readFileSync(CERT_FILE),
      key: readFileSync(KEY_FILE),
    },
    (req, res) => {
      handleRequest(req, res).catch((error) => {
        sendJson(req, res, 500, {
          error: 'Unhandled bridge error',
          details: error instanceof Error ? error.message : String(error),
        });
      });
    },
  );

  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`[hermes-office] HTTPS https://localhost:${HTTPS_PORT}`);
  });
} else {
  console.log(`[hermes-office] HTTPS disabled — certs not found at ${CERT_FILE} and ${KEY_FILE}`);
}

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) sessions.delete(token);
  }
}, 60_000).unref();
