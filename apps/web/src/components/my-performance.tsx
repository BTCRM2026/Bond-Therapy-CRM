"use client";

import { IndianRupee, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PeriodType = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY" | "SEASONAL";
type Season = { name: string; weightagePercent: number; startDate: string; endDate: string };
type Incentive = { eligible: boolean; incentiveAmount: number; calculation: Record<string, unknown> };
type PerformanceResponse =
  | { hasPlan: false; period: { period: PeriodType; year: number } }
  | { hasPlan: true; available: false; period: { period: PeriodType; year: number; index: number } }
  | { hasPlan: true; available: true; plan: { targetYear: number; annualTarget: number; distributionType: "EQUAL" | "SEASONAL"; seasons: Season[] | null }; period: { period: PeriodType; year: number; index: number; start: string; end: string }; target: number; actual: number; remaining: number; achievementPercent: number; incentive: Incentive | null };

const PERIOD_LABELS: Record<PeriodType, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-Yearly", YEARLY: "Yearly", SEASONAL: "Seasonal" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export function MyPerformance() {
  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<PeriodType>("MONTHLY");
  const [year, setYear] = useState(now.getFullYear());
  const [index, setIndex] = useState<number | undefined>(undefined);
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ period, year: String(year) });
        if (index != null) params.set("index", String(index));
        const response = await fetch(`/api/target-incentive/me?${params}`, { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Unable to load your performance.");
        setData(json as PerformanceResponse);
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your performance."); }
      finally { setLoading(false); }
    })();
  }, [period, year, index]);

  const changePeriod = (value: PeriodType) => { setPeriod(value); setIndex(undefined); };

  if (loading && !data) return <div className="space-y-3"><div className="h-11 w-full animate-pulse rounded-lg bg-background" /><div className="h-48 animate-pulse rounded-xl bg-background" /></div>;

  if (data && !data.hasPlan) return <div className="space-y-4">
    <PeriodTabs period={period} onChange={changePeriod} seasonal={false} />
    <EmptyState title="No annual target assigned yet" message="Your admin hasn't set an annual sales target for you. Check back once one is assigned." />
  </div>;

  const seasons = data && data.hasPlan && data.available ? data.plan.seasons : null;
  const isSeasonal = data && data.hasPlan && data.available && data.plan.distributionType === "SEASONAL";

  return <div className="space-y-4">
    <PeriodTabs period={period} onChange={changePeriod} seasonal={Boolean(isSeasonal)} />
    <PeriodIndexSelector period={period} year={year} index={index} seasons={seasons} onYearChange={(y) => { setYear(y); setIndex(undefined); }} onIndexChange={setIndex} />

    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}

    {data && data.hasPlan && !data.available && <EmptyState title="Not available for this view" message="This period view isn't part of your current annual target plan." />}

    {data && data.hasPlan && data.available && <>
      <section className="crm-surface p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{PERIOD_LABELS[data.period.period]} target</p>
        <div className="mt-2 flex items-baseline gap-1.5">
          <p className="text-2xl font-bold tracking-[-0.02em] text-foreground">{money(data.actual)}</p>
          <p className="text-sm text-muted">/ {money(data.target)}</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.min(100, data.achievementPercent)}%` }} /></div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted">
          <span>{data.achievementPercent}% achieved</span>
          <span>{money(data.remaining)} remaining</span>
        </div>
      </section>

      <section className="crm-surface p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Incentive</p>
        {data.incentive ? <>
          <div className="mt-2 flex items-center gap-2">
            <IndianRupee size={20} className={data.incentive.eligible ? "text-success" : "text-subtle"} />
            <p className="text-2xl font-bold tracking-[-0.02em] text-foreground">{money(data.incentive.incentiveAmount)}</p>
          </div>
          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${data.incentive.eligible ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{data.incentive.eligible ? "Eligible" : "Not yet eligible"}</span>
          {!data.incentive.eligible && <p className="mt-2 text-xs text-muted">Reach the minimum achievement threshold to unlock your incentive for this period.</p>}
        </> : <p className="mt-2 text-sm text-muted">No incentive rule configured for your target.</p>}
      </section>
    </>}
  </div>;
}

function PeriodTabs({ period, onChange, seasonal }: { period: PeriodType; onChange: (value: PeriodType) => void; seasonal: boolean }) {
  const options: PeriodType[] = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", ...(seasonal ? (["SEASONAL"] as PeriodType[]) : [])];
  return <div className="flex gap-1 overflow-x-auto rounded-lg border bg-white p-1">
    {options.map((option) => <button key={option} type="button" onClick={() => onChange(option)} className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${period === option ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>{PERIOD_LABELS[option]}</button>)}
  </div>;
}

function PeriodIndexSelector({ period, year, index, seasons, onYearChange, onIndexChange }: { period: PeriodType; year: number; index: number | undefined; seasons: Season[] | null; onYearChange: (year: number) => void; onIndexChange: (index: number | undefined) => void }) {
  const selectClass = "h-10 rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10";
  return <div className="flex flex-wrap items-center gap-2">
    <select value={year} onChange={(e) => onYearChange(Number(e.target.value))} className={selectClass}>{[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}</select>
    {period === "MONTHLY" && <select value={index ?? ""} onChange={(e) => onIndexChange(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}><option value="">Current month</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>}
    {period === "QUARTERLY" && <select value={index ?? ""} onChange={(e) => onIndexChange(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}><option value="">Current quarter</option>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</select>}
    {period === "HALF_YEARLY" && <select value={index ?? ""} onChange={(e) => onIndexChange(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}><option value="">Current half</option><option value={1}>H1 (Jan–Jun)</option><option value={2}>H2 (Jul–Dec)</option></select>}
    {period === "SEASONAL" && seasons && <select value={index ?? ""} onChange={(e) => onIndexChange(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}><option value="">Select season</option>{seasons.map((season, i) => <option key={season.name} value={i + 1}>{season.name}</option>)}</select>}
  </div>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="crm-surface px-5 py-14 text-center">
    <Target className="mx-auto text-subtle" size={26} />
    <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
    <p className="mt-1 text-xs text-muted">{message}</p>
  </div>;
}
