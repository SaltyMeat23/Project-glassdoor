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
import { benchmark, benefitsAddOn } from './comp/benchmark.mjs';
import { submitComp } from './comp/intake-comp.mjs';
import { COMP_META, primeSub, customerSector, lcatLevel, roleFamily, clearanceTier, metroBucket, yoeBand } from './comp/normalize-comp.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHECK_HTML = resolve(__dirname, '..', 'public-intake', 'check.html');
const INTAKE_HTML = resolve(__dirname, '..', 'public-intake', 'intake.html');
const PORT = Number(process.env.PORT) || 8787;
const numOrNull = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && v !== '' && v != null ? n : null; };

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
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/check')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(CHECK_HTML, 'utf8'));
    }
    if (req.method === 'GET' && url.pathname === '/intake') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(INTAKE_HTML, 'utf8'));
    }
    if (req.method === 'GET' && url.pathname === '/api/comp/meta') {
      return json(res, 200, COMP_META);
    }
    // give-to-get: recording your comp (the "give") returns the benchmark (the "get")
    if (req.method === 'POST' && url.pathname === '/api/comp/check') {
      const b = await readBody(req);
      const emp = b.employer ? resolveEmployer(db, b.employer) : null;
      const rec = submitComp(db, {
        role_raw: b.role, clearance: b.clearance, metro: b.metro, yoe: b.yoe,
        base: b.base, bonus: b.bonus, employer_id: emp?.id ?? null,
        prime_sub: b.prime_sub, customer_sector: b.customer, lcat: b.lcat,
        verification_tier: 'unverified',
      });
      if (!rec.ok) return json(res, 400, { error: rec.error });
      const result = benchmark(db, {
        ...rec.cell,
        base: numOrNull(b.base), bonus: numOrNull(b.bonus), employer_id: emp?.id ?? null,
        prime_sub: b.prime_sub ? primeSub(b.prime_sub) : null,
        customer_sector: b.customer ? customerSector(b.customer) : null,
        lcat: b.lcat ? lcatLevel(b.lcat) : null,
        family_status: b.family_status,
      });
      return json(res, 200, { ok: true, employer: emp?.display_name ?? null, ...result });
    }
    // side-by-side: value two offers (same profile) apples-to-apples
    if (req.method === 'POST' && url.pathname === '/api/comp/compare') {
      const b = await readBody(req);
      const cell = {
        role_family: roleFamily(b.role), clearance_tier: clearanceTier(b.clearance),
        metro: metroBucket(b.metro), yoe_band: yoeBand(b.yoe),
        prime_sub: b.prime_sub ? primeSub(b.prime_sub) : null,
        customer_sector: b.customer ? customerSector(b.customer) : null,
        lcat: b.lcat ? lcatLevel(b.lcat) : null,
        family_status: b.family_status,
      };
      let market = null;
      const offers = (b.offers || []).slice(0, 2).map((o) => {
        const emp = o.employer ? resolveEmployer(db, o.employer) : null;
        const base = numOrNull(o.base), bonus = numOrNull(o.bonus) || 0;
        const r = benchmark(db, { ...cell, base, bonus, employer_id: emp?.id ?? null });
        if (r.status === 'ok' && !market) market = { n: r.n, distribution: r.distribution, level: r.level, coarsened: r.coarsened };
        const ben = benefitsAddOn(db, { base, family_status: b.family_status, employer_id: emp?.id ?? null });
        const benefits_total = ben?.benefits_total ?? 0;
        return {
          label: o.label ?? null, employer_name: emp?.display_name ?? null,
          base, bonus, benefits_total, benefits_lines: ben?.lines ?? [],
          total_comp: (base || 0) + bonus + benefits_total,
          base_percentile: r.status === 'ok' ? r.base_percentile : null,
        };
      });
      return json(res, 200, { ok: true, cell: [cell.role_family, cell.clearance_tier, cell.metro, cell.yoe_band].join(' · '), market, offers });
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
  console.log(`ContractIQ dev server:  http://127.0.0.1:${PORT}/         ("How do I compare?" comp hero)`);
  console.log(`                        http://127.0.0.1:${PORT}/intake   (benefits intake)`);
  console.log('SECURITY: submissions carry no user_id, no IP, coarse (YYYY-MM) period only.');
});
