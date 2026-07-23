// Company directory + profile — async Neon queries backing /companies.
import { q } from './db';
import { loadTerms, type Term } from './valuation';

export type CompanyTileRow = {
  slug: string;
  display_name: string;
  industry: string | null;
  has_about: boolean;
  has_retirement: boolean;
  has_insurance: boolean;
  has_leave: boolean;
  has_pay: boolean;
};

const PAGE = 30;

/** Searchable, data-rich-first directory listing with per-tile availability flags. */
export async function searchCompanies({
  q: query = '',
  page = 0,
}: {
  q?: string;
  page?: number;
}): Promise<{ companies: CompanyTileRow[]; total: number; page: number; pageSize: number }> {
  const like = query.trim();
  const rows = await q<CompanyTileRow>(
    `SELECT e.slug, e.display_name, e.industry,
       (e.about IS NOT NULL) AS has_about,
       EXISTS(SELECT 1 FROM plan_terms t WHERE t.employer_id = e.id
              AND (t.term_key LIKE 'k401%' OR t.term_key LIKE 'pension%' OR t.term_key LIKE 'esop%')) AS has_retirement,
       EXISTS(SELECT 1 FROM plan_terms t WHERE t.employer_id = e.id
              AND (t.term_key LIKE 'hsa%' OR t.term_key LIKE 'medical%')) AS has_insurance,
       EXISTS(SELECT 1 FROM plan_terms t WHERE t.employer_id = e.id
              AND t.term_key IN ('pto','paid_holidays','parental_leave','std_max')) AS has_leave,
       EXISTS(SELECT 1 FROM comp_datapoint c WHERE c.employer_id = e.id) AS has_pay
     FROM employer e
     WHERE ($1 = '' OR e.display_name ILIKE '%' || $1 || '%')
     ORDER BY
       (EXISTS(SELECT 1 FROM plan_terms t WHERE t.employer_id = e.id)
        OR EXISTS(SELECT 1 FROM comp_datapoint c WHERE c.employer_id = e.id)) DESC,
       e.display_name ASC
     LIMIT $2 OFFSET $3`,
    [like, PAGE, page * PAGE]
  );
  const total = (
    await q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM employer e WHERE ($1 = '' OR e.display_name ILIKE '%' || $1 || '%')`,
      [like]
    )
  )[0].c;
  return { companies: rows, total, page, pageSize: PAGE };
}

// Which term_keys belong to each benefit category on the profile.
const GROUPS: {
  key: 'retirement' | 'insurance' | 'leave';
  label: string;
  match: (k: string) => boolean;
}[] = [
  {
    key: 'retirement',
    label: 'Retirement',
    match: (k) => k.startsWith('k401') || k.startsWith('pension') || k.startsWith('esop'),
  },
  {
    key: 'insurance',
    label: 'Insurance',
    match: (k) => k.startsWith('hsa') || k.startsWith('medical'),
  },
  {
    key: 'leave',
    label: 'Leave',
    match: (k) => ['pto', 'paid_holidays', 'parental_leave', 'std_max'].includes(k),
  },
];

export type ProfileTerm = {
  term_key: string;
  value_num: number | null;
  value_text: string | null;
  confidence: string;
  plan_year: number | null;
};
export type OpenRole = {
  title: string;
  clearance_tier: string | null;
  metro: string | null;
  location_raw: string | null;
  remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  source_url: string | null;
};
export type CompTierBand = {
  clearance_tier: string;
  n: number;
  p25: number;
  p50: number;
  p75: number;
};
export type CompanyProfile = {
  slug: string;
  display_name: string;
  sector: string | null;
  ownership: string | null;
  industry: string | null;
  website: string | null;
  about: string | null;
  groups: { key: string; label: string; terms: ProfileTerm[] }[];
  pay_datapoints: number;
  comp_bands: CompTierBand[];
  comp_posting_count: number;
  open_roles: OpenRole[];
  open_roles_total: number;
};

export async function getCompanyProfile(slug: string): Promise<CompanyProfile | null> {
  const rows = await q<{
    id: number;
    slug: string;
    display_name: string;
    sector: string | null;
    ownership: string | null;
    industry: string | null;
    website: string | null;
    about: string | null;
  }>(
    `SELECT id, slug, display_name, sector, ownership, industry, website, about
     FROM employer WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  if (!rows.length) return null;
  const e = rows[0];

  const terms: Map<string, Term> = await loadTerms(e.id);
  const groups = GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    terms: [...terms.entries()]
      .filter(([k]) => g.match(k))
      .map(([term_key, t]) => ({
        term_key,
        value_num: t.value_num,
        value_text: t.value_text,
        confidence: t.confidence,
        plan_year: t.plan_year,
      })),
  }));

  const pay = (
    await q<{ c: number }>(`SELECT COUNT(*)::int AS c FROM comp_datapoint WHERE employer_id = $1`, [
      e.id,
    ])
  )[0].c;

  // Compensation snapshot from this employer's banded postings — per clearance
  // tier, the observed range (lo–hi) and median of midpoints. Employer public
  // data (postings), not person submissions. Require >= 3 postings per tier so a
  // band means something.
  const compBands = await q<CompTierBand>(
    `SELECT clearance_tier,
            COUNT(*)::int AS n,
            percentile_cont(0.25) WITHIN GROUP (ORDER BY mid)::float8 AS p25,
            percentile_cont(0.5)  WITHIN GROUP (ORDER BY mid)::float8 AS p50,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY mid)::float8 AS p75
       FROM (
         SELECT clearance_tier, (salary_min + salary_max) / 2.0 AS mid
           FROM job_posting
          WHERE employer_id = $1 AND is_open AND salary_min IS NOT NULL AND clearance_tier IS NOT NULL
       ) t
      GROUP BY clearance_tier
     HAVING COUNT(*) >= 3
      ORDER BY p50 DESC`,
    [e.id]
  );
  const compPostingCount = (
    await q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM job_posting
        WHERE employer_id = $1 AND is_open AND salary_min IS NOT NULL`,
      [e.id]
    )
  )[0].c;

  // Open cleared roles (employer data — public postings, no PII). Pay-banded
  // roles first, then by clearance depth, so the useful ones lead.
  const openRoles = await q<OpenRole>(
    `SELECT title, clearance_tier, metro, location_raw, remote, salary_min, salary_max, source_url
       FROM job_posting
      WHERE employer_id = $1 AND is_open = TRUE
      ORDER BY (salary_max IS NOT NULL) DESC, salary_max DESC NULLS LAST, title ASC
      LIMIT 40`,
    [e.id]
  );
  const openTotal = (
    await q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM job_posting WHERE employer_id = $1 AND is_open = TRUE`,
      [e.id]
    )
  )[0].c;

  return {
    slug: e.slug,
    display_name: e.display_name,
    sector: e.sector,
    ownership: e.ownership,
    industry: e.industry,
    website: e.website,
    about: e.about,
    groups,
    pay_datapoints: pay,
    comp_bands: compBands,
    comp_posting_count: compPostingCount,
    open_roles: openRoles,
    open_roles_total: openTotal,
  };
}
