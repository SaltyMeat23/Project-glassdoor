// Name normalization + employer matching for Form 5500 sponsor names.
//
// Sponsor names are filed as messy uppercase legal names. We normalize to
// uppercase alphanumeric + single spaces, strip common legal suffixes, then
// attribute a filing to a curated employer when the normalized sponsor name
// STARTS WITH one of that employer's normalized match prefixes. startsWith
// (rather than substring) avoids false positives like a credit union or an
// unrelated firm that merely contains a company token.

const LEGAL_SUFFIXES = [
  'INCORPORATED', 'INC', 'CORPORATION', 'CORP', 'COMPANY', 'CO',
  'LLC', 'LLP', 'LP', 'LTD', 'PLC', 'NA', 'THE',
];

/** Normalize a name to uppercase, alnum + single spaces, no legal suffixes. */
export function normalizeName(raw) {
  if (!raw) return '';
  let s = String(raw).toUpperCase();
  s = s.replace(/&/g, ' AND ');
  s = s.replace(/[^A-Z0-9]+/g, ' ').trim();      // drop punctuation
  // strip trailing legal suffix tokens repeatedly (e.g. "FOO INC LLC" -> "FOO")
  let tokens = s.split(' ').filter(Boolean);
  while (tokens.length > 1 && LEGAL_SUFFIXES.includes(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  // also drop a leading "THE"
  if (tokens.length > 1 && tokens[0] === 'THE') tokens.shift();
  return tokens.join(' ');
}

/**
 * Build a matcher from the seed employer list.
 * Returns { matchName(normSponsor) -> employerSeed|null, matchEin(ein) -> employerSeed|null }.
 * Prefixes are tested longest-first so the most specific alias wins.
 */
export function buildMatcher(employers) {
  const prefixes = []; // { prefix, employer }
  const eins = new Map(); // ein -> employer
  for (const e of employers) {
    for (const m of e.match || []) {
      const p = normalizeName(m);
      if (p) prefixes.push({ prefix: p, employer: e });
    }
    for (const ein of e.ein || []) {
      eins.set(String(ein).replace(/\D/g, ''), e);
    }
  }
  prefixes.sort((a, b) => b.prefix.length - a.prefix.length);

  return {
    matchName(normSponsor) {
      if (!normSponsor) return null;
      for (const { prefix, employer } of prefixes) {
        if (normSponsor === prefix || normSponsor.startsWith(prefix + ' ')) {
          return employer;
        }
      }
      return null;
    },
    matchEin(rawEin) {
      const ein = String(rawEin || '').replace(/\D/g, '');
      return ein ? eins.get(ein) || null : null;
    },
  };
}
