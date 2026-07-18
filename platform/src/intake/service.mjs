// Intake service — the privacy-preserving submission path (docs/INTAKE.md).
//
// SECURITY invariants honored here:
//  - submission rows carry NO user_id and only a COARSE period (YYYY-MM).
//  - crowdsourced plan_terms store NO source_url/snippet (no personal docs/PII).
//  - nothing links a submission back to an account or person.
//
// Confidence lifecycle: a single submission is 'reported' (doc/email tier) or
// 'inferred' (unverified). When >= CONSENSUS independent crowdsourced
// submissions agree on a value for an (employer, term_key), those rows are
// promoted to 'verified' — which the valuation engine then prefers.

import { QUESTIONS, QUESTION_BY_KEY } from './questions.mjs';
import { loadTerms } from '../valuation/engine.mjs';

const CONSENSUS = 2; // independent agreeing submissions needed to reach 'verified'

const TIER_CONFIDENCE = {
  doc_verified: 'reported',
  email_domain: 'reported',
  unverified: 'inferred',
};

const coarsePeriod = () => new Date().toISOString().slice(0, 7); // YYYY-MM

/** The confirm/correct list for an employer: each question + our current best value. */
export function prefill(db, employer) {
  const best = loadTerms(db, employer.id);
  const questions = QUESTIONS.map((q) => {
    const cur = best.get(q.term_key);
    return {
      ...q,
      current: cur
        ? { value_num: cur.value_num, value_text: cur.value_text, confidence: cur.confidence, source: cur.source ?? null, plan_year: cur.plan_year }
        : null, // unknown → "help us add this"
    };
  });
  return { employer: { slug: employer.slug, name: employer.display_name }, questions };
}

/**
 * Record an intake submission. items: [{ term_key, action, value_num?, value_text? }],
 * action ∈ confirm | correct | add | skip.
 * Returns { submission_id, written, promoted }.
 */
export function submit(db, employer, { plan_year = null, verification_tier = 'unverified', items = [] }) {
  const confidence = TIER_CONFIDENCE[verification_tier] || 'inferred';
  const period = coarsePeriod();

  const insSub = db.prepare(
    `INSERT INTO submission (employer_id, plan_year, verification_tier, submitted_period) VALUES (?, ?, ?, ?)`,
  );
  const insTerm = db.prepare(`
    INSERT INTO plan_terms (employer_id, term_key, value_num, value_text, unit, plan_year, source, confidence, fetched_period, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'crowdsourced', ?, ?, ?)
  `);

  db.exec('BEGIN');
  const subInfo = insSub.run(employer.id, plan_year, verification_tier, period);
  const submission_id = subInfo.lastInsertRowid;

  const touched = new Set();
  let written = 0;
  for (const it of items) {
    if (!it || it.action === 'skip') continue;
    const q = QUESTION_BY_KEY[it.term_key];
    if (!q) continue;
    const value_num = it.value_num != null && it.value_num !== '' ? Number(it.value_num) : null;
    const value_text = it.value_text ?? null;
    if (value_num == null && value_text == null) continue; // nothing to record
    insTerm.run(employer.id, q.term_key, value_num, value_text, q.unit, plan_year, confidence, period, it.action);
    touched.add(q.term_key);
    written++;
  }
  db.exec('COMMIT');

  const promoted = [];
  for (const key of touched) if (promoteConsensus(db, employer.id, key)) promoted.push(key);

  return { submission_id: Number(submission_id), written, promoted };
}

/** Promote crowdsourced rows to 'verified' when >= CONSENSUS submissions agree on a value. */
export function promoteConsensus(db, employer_id, term_key) {
  const rows = db.prepare(
    `SELECT id, value_num, value_text FROM plan_terms WHERE employer_id = ? AND term_key = ? AND source = 'crowdsourced'`,
  ).all(employer_id, term_key);
  const groups = new Map();
  for (const r of rows) {
    const k = r.value_num != null ? `n:${Math.round(r.value_num)}` : `t:${(r.value_text || '').trim().toLowerCase()}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(r.id);
  }
  let promotedAny = false;
  const upd = db.prepare(`UPDATE plan_terms SET confidence = 'verified' WHERE id = ?`);
  for (const ids of groups.values()) {
    if (ids.length >= CONSENSUS) { for (const id of ids) upd.run(id); promotedAny = true; }
  }
  return promotedAny;
}
