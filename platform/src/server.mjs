// Minimal intake server (node:http, no deps). Serves the confirm/correct intake
// page and its API against the local SQLite DB. Local dev / demo of
// docs/INTAKE.md. Binds to 127.0.0.1 only.
//
// SECURITY: we deliberately do NOT read or log client IPs (docs/SECURITY §8.1),
// and no auth/identity is attached to submissions.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { openDb } from './lib/db.mjs';
import { resolveEmployer } from './valuation/cli-util.mjs';
import { prefill, submit } from './intake/service.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = resolve(__dirname, '..', 'public-intake', 'intake.html');
const PORT = Number(process.env.PORT) || 8787;

const db = openDb();
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolveBody(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(HTML, 'utf8'));
    }
    if (req.method === 'GET' && url.pathname === '/api/employers') {
      const rows = db.prepare('SELECT slug, display_name FROM employer ORDER BY display_name').all();
      return json(res, 200, rows);
    }
    if (req.method === 'GET' && url.pathname === '/api/intake') {
      const emp = resolveEmployer(db, url.searchParams.get('employer') || '');
      if (!emp) return json(res, 404, { error: 'employer not found' });
      return json(res, 200, prefill(db, emp));
    }
    if (req.method === 'POST' && url.pathname === '/api/intake') {
      const body = await readBody(req);
      const emp = resolveEmployer(db, body.employer || '');
      if (!emp) return json(res, 404, { error: 'employer not found' });
      const result = submit(db, emp, body);
      return json(res, 200, { ok: true, ...result });
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 400, { error: String(e.message || e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ContractIQ intake server: http://127.0.0.1:${PORT}`);
  console.log('SECURITY: submissions carry no user_id, no IP, coarse (YYYY-MM) period only.');
});
