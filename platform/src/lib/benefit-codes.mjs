// Form 5500 benefit-code interpretation.
//
// TYPE_PENSION_BNFT_CODE and TYPE_WELFARE_BNFT_CODE are concatenated 2-char
// tokens (digit+letter), e.g. "1A1B1C3F3H" or "2E2G2J2O2S2T". We split into
// tokens and classify the filing into one of our plan_type values.
//
// Code meanings are from the DOL Form 5500 instructions (pension codes begin
// with 1 = defined benefit, 2 = defined contribution, 3 = other characteristics;
// welfare codes begin with 4). Only the codes we act on are documented here;
// the raw string is always preserved on the row so nothing is lost.

/** Split a concatenated benefit-code string into a Set of 2-char tokens. */
export function tokenizeCodes(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tokens = new Set();
  for (let i = 0; i + 1 < s.length; i += 2) tokens.add(s.slice(i, i + 2));
  return tokens;
}

const PENSION_LABELS = {
  '1A': 'DB: cash balance', '1B': 'DB', '1C': 'DB (PBGC-covered)',
  '1D': 'DB', '1E': 'DB', '1F': 'DB', '1G': 'DB', '1H': 'DB', '1I': 'DB (frozen)',
  '2A': 'DC: age/service weighted', '2B': 'DC: target benefit',
  '2C': 'DC: money purchase', '2E': 'DC: profit-sharing',
  '2F': 'DC: ERISA 404(c)', '2G': 'DC: participant-directed',
  '2I': 'DC: stock bonus / ESOP', '2J': 'DC: 401(k) feature',
  '2K': 'DC: 403(b)(1)', '2L': 'DC: 403(b)(7)', '2R': 'DC: brokerage window',
  '2S': 'DC: SIMPLE 401(k)', '2T': 'DC: default investment (QDIA)',
};

const WELFARE_LABELS = {
  '4A': 'Health (medical/rx/dental/vision)', '4B': 'Life insurance',
  '4D': 'Dental', '4E': 'Vision', '4F': 'Short-term disability',
  '4G': 'Long-term disability', '4H': 'Prepaid legal', '4I': 'Long-term care',
  '4Q': 'Other welfare', '4T': 'Temporary disability',
};

/**
 * Classify a filing into a plan_type from its pension & welfare code strings.
 * Pension codes take precedence (a pension filing carries pension codes only).
 * Returns { planType, labels: string[] }.
 */
export function classifyPlan(pensionCode, welfareCode) {
  const p = tokenizeCodes(pensionCode);
  const w = tokenizeCodes(welfareCode);
  const labels = [];

  if (p.size > 0) {
    const hasDB = [...p].some((t) => t.startsWith('1'));
    const has401k = p.has('2J') || p.has('2S');
    const hasESOP = p.has('2I');
    let planType;
    if (hasDB) planType = 'db_pension';
    else if (has401k) planType = '401k';
    else if (hasESOP) planType = 'esop';
    else if ([...p].some((t) => t.startsWith('2'))) planType = 'dc_other';
    else planType = 'pension_other';
    for (const t of p) if (PENSION_LABELS[t]) labels.push(PENSION_LABELS[t]);
    return { planType, labels };
  }

  if (w.size > 0) {
    let planType;
    if (w.has('4A')) planType = 'health_welfare';
    else if (w.has('4G') || w.has('4F') || w.has('4T')) planType = 'disability';
    else if (w.has('4B')) planType = 'life';
    else if (w.has('4D') || w.has('4E')) planType = 'dental_vision';
    else planType = 'welfare_other';
    for (const t of w) if (WELFARE_LABELS[t]) labels.push(WELFARE_LABELS[t]);
    return { planType, labels };
  }

  return { planType: 'other', labels };
}
