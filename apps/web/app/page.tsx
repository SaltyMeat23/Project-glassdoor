"use client";
import { useEffect, useState } from "react";
import { PercentileTrack, usd, ord } from "@/components/PercentileTrack";
import type { Benchmark, Meta, Employer } from "@/lib/types";

const CLEAR_LABEL: Record<string, string> = {
  none: "None / Public Trust", secret: "Secret", ts: "Top Secret", ts_sci: "TS/SCI", ts_sci_poly: "TS/SCI + Poly",
};
const titleize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const bandText = (b?: string) => (b === "below" || b === "slightly_below" ? "text-below" : b === "at" ? "text-at" : "text-above");

const emptyForm = { role: "", clearance: "ts_sci", metro: "dc_metro", yoe: "", base: "", bonus: "", employer: "", prime_sub: "", customer: "", lcat: "" };

export default function Page() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [emps, setEmps] = useState<Employer[]>([]);
  const [f, setF] = useState({ ...emptyForm });
  const [res, setRes] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(false);
  const [refine, setRefine] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/comp/meta").then((r) => r.json()).then(setMeta).catch(() => {});
    fetch("/api/employers").then((r) => r.json()).then((d) => Array.isArray(d) && setEmps(d)).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = async () => {
    setErr("");
    if (!f.clearance || !f.yoe || !f.base) { setErr("Add at least clearance, years of experience, and base pay."); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/comp/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) }).then((x) => x.json());
      setRes(r);
    } catch { setRes({ ok: false, error: "Couldn't reach the market data service." }); }
    setLoading(false);
  };

  const L = (t: string) => <span className="block text-[11px] font-mono tracking-[0.14em] text-muted mb-1.5">{t}</span>;
  const inputCls = "w-full bg-inset text-text border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-gold/60 transition-colors";

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24">
      {/* hero header */}
      <header className="pt-12 pb-8">
        <div className="flex items-center gap-2 font-display font-extrabold tracking-tight text-[22px]">
          Contract<span className="text-gold">IQ</span>
        </div>
        <p className="mt-6 font-mono text-[11px] tracking-[0.2em] text-gold/80">TOTAL-COMP INTELLIGENCE&nbsp;//&nbsp;CLEARED WORKFORCE</p>
        <h1 className="mt-2 font-display font-extrabold tracking-tight text-4xl sm:text-5xl leading-[1.02]">How do I compare?</h1>
        <p className="mt-3 max-w-xl text-muted">
          Cleared pay is hidden until you&apos;re already on contract. Enter your profile to <span className="text-text">declassify</span> where
          your total comp sits against the market — anonymously, before you sign.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* ---- profile / dossier form ---- */}
        <section className="rounded-xl bg-panel ring-1 ring-line p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[11px] tracking-[0.18em] text-muted">YOUR PROFILE</span>
            <span className="font-mono text-[10px] tracking-[0.14em] text-faint">FORM&nbsp;IQ-1</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">{L("ROLE / TITLE")}
              <input list="roles" className={inputCls} placeholder="e.g. SIGINT Analyst, Software Engineer"
                value={f.role} onChange={(e) => set("role", e.target.value)} />
              <datalist id="roles">
                {["Software Engineer", "Systems Engineer", "SIGINT Analyst", "All-Source Intelligence Analyst", "Cybersecurity Engineer", "DevOps Engineer", "Data Scientist", "Program Manager", "Systems Administrator", "Network Engineer"].map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div>{L("CLEARANCE")}
              <select className={inputCls} value={f.clearance} onChange={(e) => set("clearance", e.target.value)}>
                {(meta?.clearance_tiers ?? ["ts_sci"]).map((c) => <option key={c} value={c}>{CLEAR_LABEL[c] ?? c}</option>)}
              </select>
            </div>
            <div>{L("METRO")}
              <select className={inputCls} value={f.metro} onChange={(e) => set("metro", e.target.value)}>
                {(meta?.metros ?? ["dc_metro"]).map((m) => <option key={m} value={m}>{titleize(m)}</option>)}
              </select>
            </div>
            <div>{L("YEARS OF EXPERIENCE")}
              <input type="number" min={0} max={45} className={inputCls} placeholder="7" value={f.yoe} onChange={(e) => set("yoe", e.target.value)} />
            </div>
            <div>{L("EMPLOYER (OPTIONAL)")}
              <select className={inputCls} value={f.employer} onChange={(e) => set("employer", e.target.value)}>
                <option value="">— any / not sure —</option>
                {emps.map((e) => <option key={e.slug} value={e.slug}>{e.display_name}</option>)}
              </select>
            </div>
            <div>{L("BASE SALARY ($)")}
              <input type="number" className={`${inputCls} tnum`} placeholder="150000" value={f.base} onChange={(e) => set("base", e.target.value)} />
            </div>
            <div>{L("BONUS ($, OPTIONAL)")}
              <input type="number" className={`${inputCls} tnum`} placeholder="12000" value={f.bonus} onChange={(e) => set("bonus", e.target.value)} />
            </div>
          </div>

          {/* contract refinements */}
          <button type="button" onClick={() => setRefine((v) => !v)} className="mt-4 font-mono text-[11px] tracking-[0.12em] text-muted hover:text-gold transition-colors">
            {refine ? "– " : "+ "}REFINE BY CONTRACT&nbsp;<span className="text-faint">(pay varies most by contract)</span>
          </button>
          {refine && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>{L("PRIME / SUB")}
                <select className={inputCls} value={f.prime_sub} onChange={(e) => set("prime_sub", e.target.value)}>
                  <option value="">—</option><option value="prime">Prime</option><option value="sub">Sub</option>
                </select></div>
              <div>{L("CUSTOMER")}
                <select className={inputCls} value={f.customer} onChange={(e) => set("customer", e.target.value)}>
                  <option value="">—</option><option value="dod">DoD</option><option value="ic">Intel Community</option><option value="civilian">Civilian</option>
                </select></div>
              <div className="col-span-2">{L("LABOR CATEGORY / LEVEL")}
                <input className={inputCls} placeholder="e.g. Engineer III, Senior" value={f.lcat} onChange={(e) => set("lcat", e.target.value)} /></div>
            </div>
          )}

          <button type="button" onClick={submit} disabled={loading}
            className="mt-5 w-full rounded-md bg-gold text-gold-ink font-display font-bold py-3 hover:brightness-105 active:brightness-95 disabled:opacity-60 transition">
            {loading ? "Declassifying…" : "Declassify the market →"}
          </button>
          {err && <p className="mt-2 text-[13px] text-below">{err}</p>}
          <p className="mt-3 text-[11px] text-faint leading-relaxed">
            Your entry joins the anonymous pool that powers everyone&apos;s benchmark — no account, no name, coarse month only.
          </p>
        </section>

        {/* ---- market readout ---- */}
        <section className="rounded-xl bg-panel ring-1 ring-line p-5 min-h-[360px]">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[11px] tracking-[0.18em] text-muted">MARKET READOUT</span>
            <span className={`font-mono text-[10px] tracking-[0.16em] px-2 py-0.5 rounded-sm ${res?.status === "ok" ? "text-above ring-1 ring-above/40" : "text-gold ring-1 ring-gold/40"}`}>
              {res?.status === "ok" ? "DECLASSIFIED" : "CLASSIFIED"}
            </span>
          </div>
          <Readout res={res} you={Number(f.base) || null} bonus={Number(f.bonus) || 0} />
        </section>
      </div>
    </main>
  );
}

function Readout({ res, you, bonus }: { res: Benchmark | null; you: number | null; bonus: number }) {
  // pre-submit: redaction bars
  if (!res) {
    return (
      <div>
        <div className="space-y-3">
          <div className="redact h-14 rounded-md" />
          <div className="flex gap-3">{[38, 22, 30, 18].map((w, i) => <div key={i} className="redact h-4" style={{ width: `${w}%` }} />)}</div>
        </div>
        <p className="mt-6 text-sm text-muted">Enter your profile and declassify the market readout for your cell.</p>
        <p className="mt-2 text-[11px] text-faint font-mono tracking-[0.12em]">▮▮▮▮ WITHHELD — k-ANONYMITY // NEED ≥5 PER CELL</p>
      </div>
    );
  }
  if (!res.ok && res.error) return <p className="text-sm text-below">{res.error}</p>;
  if (res.status === "insufficient") {
    return (
      <div className="declassify">
        <p className="font-display font-bold text-lg">Not enough data yet</p>
        <p className="mt-2 text-sm text-muted">Only <span className="tnum text-text">{res.have}</span> submissions for <span className="text-text">{res.cell}</span> — we need
          {" "}<span className="tnum text-text">{res.k}</span> before showing a figure, so no one is identifiable.</p>
        <p className="mt-3 text-sm text-muted">Your entry was recorded anonymously. Come back as the cell fills — or send ContractIQ to a colleague on your contract.</p>
      </div>
    );
  }

  const v = res.verdict;
  const total = (you ?? 0) + bonus + (res.benefits?.benefits_total ?? 0);
  return (
    <div className="declassify">
      {v && <p className={`font-display font-bold text-xl leading-snug ${bandText(v.band)}`}>{v.text}</p>}

      <div className="mt-6"><PercentileTrack dist={res.distribution!} you={you} band={v?.band} /></div>

      <p className="mt-6 text-sm text-muted">
        You&apos;re at the <span className={`tnum font-semibold ${bandText(v?.band)}`}>{res.base_percentile != null ? ord(res.base_percentile) : "—"} percentile</span> for base pay
        {res.total_cash_percentile != null && <> · <span className="tnum text-text">{ord(res.total_cash_percentile)}</span> for total cash</>}.
      </p>
      <p className="mt-1 text-[11px] text-faint">
        Based on <span className="tnum">{res.n}</span> anonymous datapoints{res.approximate ? " (small sample — approximate)" : ""}
        {res.coarsened ? <> · widened to <span className="text-muted">{res.level}</span> to protect anonymity</> : null}.
      </p>

      {res.benefits && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex justify-between text-sm">
            <span className="font-medium">+ Benefits {res.benefits.employer ? `(${res.benefits.employer})` : "(sector benchmark)"}</span>
            <span className="tnum font-semibold">{usd(res.benefits.benefits_total)}/yr</span>
          </div>
          <div className="mt-2 space-y-1">
            {res.benefits.lines.map((l, i) => (
              <div key={i} className="flex justify-between text-[13px] text-muted">
                <span>{l.label} <span className="text-faint">[{l.confidence}]</span></span>
                <span className="tnum">{usd(l.value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-line pt-3">
            <span className="font-display font-bold">Total-rewards value</span>
            <span className="tnum font-display font-bold text-gold">{usd(total)}/yr</span>
          </div>
        </div>
      )}
    </div>
  );
}
