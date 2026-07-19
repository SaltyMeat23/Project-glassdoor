export type Dist = { p25: number; p50: number; p75: number; p90: number };
export type BenchLine = { label: string; value: number; confidence: string; data_status: string };
export type Benefits = { employer: string | null; benefits_total: number; lines: BenchLine[]; gaps: string[] };

export type Benchmark = {
  ok: boolean;
  status?: "ok" | "insufficient";
  error?: string;
  employer?: string | null;
  level?: string;
  coarsened?: boolean;
  n?: number;
  approximate?: boolean;
  distribution?: Dist;
  base_percentile?: number | null;
  total_cash_percentile?: number | null;
  verdict?: { band: string; text: string } | null;
  benefits?: Benefits | null;
  // insufficient
  cell?: string;
  have?: number;
  k?: number;
};

export type Meta = {
  role_families: string[];
  metros: string[];
  clearance_tiers: string[];
  yoe_bands: string[];
  customer_sectors: string[];
  prime_sub: string[];
};

export type Employer = { slug: string; display_name: string };
