/**
 * AURA Desktop Agent — optional local microservice.
 *
 * Listens on localhost only. Executes a small allowlisted set of actions on
 * your machine, authenticated with a personal API key, with every request
 * logged to ./agent.log.
 *
 * Usage:
 *   cp config.example.json config.json   (edit apiKey + allowlists)
 *   npm start
 *
 * API:
 *   GET  /health
 *   POST /action  { "action": "open_url", "params": { "url": "https://…" } }
 *   Header: x-aura-key: <apiKey>
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { actions } from './actions.js';
import { timingSafeEqual } from './security.js';
import { startCloudConnector } from './cloud.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'config.json');

if (!fs.existsSync(configPath)) {
  console.error('Missing config.json — copy config.example.json and edit it first.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!config.apiKey || config.apiKey.includes('CHANGE-ME')) {
  console.error('Set a real apiKey in config.json (long random string).');
  process.exit(1);
}

const logPath = path.join(root, 'agent.log');
function log(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  fs.appendFileSync(logPath, line + '\n');
  console.log(line);
}

const server = http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (req.method === 'GET' && req.url === '/health') {
    return send(200, { ok: true, actions: Object.keys(actions) });
  }

  if (req.method !== 'POST' || req.url !== '/action') {
    return send(404, { error: 'Not found' });
  }

  if (!timingSafeEqual(req.headers['x-aura-key'] ?? '', config.apiKey)) {
    log({ event: 'auth_failed', ip: req.socket.remoteAddress });
    return send(401, { error: 'Unauthorized' });
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 64 * 1024) req.destroy();
  });
  req.on('end', async () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return send(400, { error: 'Invalid JSON' });
    }

    const { action, params = {} } = payload;
    const handler = actions[action];
    if (!handler) {
      log({ event: 'action_rejected', action, reason: 'unknown action' });
      return send(400, { error: `Unknown action "${action}". Allowed: ${Object.keys(actions).join(', ')}` });
    }

    try {
      const result = await handler(params, config);
      log({ event: 'action_executed', action, params });
      send(200, { ok: true, result });
    } catch (err) {
      log({ event: 'action_failed', action, params, error: err.message });
      send(400, { error: err.message });
    }
  });
});

// localhost only — never expose this to the network directly.
server.listen(config.port ?? 8787, '127.0.0.1', () => {
  log({ event: 'started', port: config.port ?? 8787 });
  console.log(`AURA desktop agent on http://127.0.0.1:${config.port ?? 8787}`);
});

// Fase 4: outbound polling connector to the AURA backend (optional).
// Enable by adding a "backend" block to config.json — see config.example.json.
if (config.backend?.url && config.backend?.agentKey) {
  if (config.backend.agentKey.includes('CHANGE-ME')) {
    console.error('Set a real backend.agentKey in config.json (must match DESKTOP_AGENT_KEY on the server).');
  } else {
    startCloudConnector(config, log);
  }
} else {
  console.log('Cloud connector disabled (no "backend" block in config.json) — local mode only.');
}
