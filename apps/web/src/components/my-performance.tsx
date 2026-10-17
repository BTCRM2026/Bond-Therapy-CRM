"use client";

import { Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FilterMenu } from "@/components/ui/filter-menu";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { cn } from "@/lib/utils";

type PeriodType = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY" | "SEASONAL";
type Season = { name: string; weightagePercent: number; startDate: string; endDate: string };
type Incentive = { eligible: boolean; incentiveAmount: number; calculation: Record<string, unknown> };
type PerformanceResponse =
  | { hasPlan: false; period: { period: PeriodType; year: number } }
  | { hasPlan: true; available: false; period: { period: PeriodType; year: number; index: number } }
  | { hasPlan: true; available: true; plan: { targetYear: number; annualTarget: number; distributionType: "EQUAL" | "SEASONAL"; seasons: Season[] | null }; period: { period: PeriodType; year: number; index: number; start: string; end: string }; target: number; actual: number; remaining: number; achievementPercent: number; incentive: Incentive | null };
type Month = { month: number; target: number; actual: number; achievementPercent: number };
type Trend = { hasPlan: false; year: number } | { hasPlan: true; year: number; annualTarget: number; currentMonth: number; months: Month[] };

const PERIOD_LABELS: Record<PeriodType, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-Yearly", YEARLY: "Yearly", SEASONAL: "Seasonal" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((month) => month.slice(0, 3));
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const compact = (value: number) => value >= 1e7 ? `₹${+(value / 1e7).toFixed(1)}Cr` : value >= 1e5 ? `₹${+(value / 1e5).toFixed(1)}L` : value >= 1e3 ? `₹${+(value / 1e3).toFixed(1)}K` : `₹${Math.round(value)}`;
const DAY = 86_400_000;
// Smallest "round" axis maximum at or above the value (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 or 10 times a power of ten).
const niceCeil = (value: number) => { const unit = Math.pow(10, Math.floor(Math.log10(value))); return unit * ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((step) => step * unit >= value) ?? 10); };

export function MyPerformance() {
  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<PeriodType>("MONTHLY");
  const [year, setYear] = useState(now.getFullYear());
  const [index, setIndex] = useState<number | undefined>(undefined);
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [trend, setTrend] = useState<Trend | null>(null);
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

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`/api/target-incentive/me/trend?year=${year}`, { cache: "no-store" });
        if (response.ok) setTrend(await response.json() as Trend);
      } catch { /* the charts are optional; the headline numbers above still load */ }
    })();
  }, [year]);

  const changePeriod = (value: PeriodType) => { setPeriod(value); setIndex(undefined); };

  if (loading && !data) return <div className="space-y-4"><div className="h-11 animate-pulse rounded-lg bg-white" /><div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]"><div className="h-56 animate-pulse rounded-[10px] bg-white" /><div className="h-56 animate-pulse rounded-[10px] bg-white" /></div><div className="h-72 animate-pulse rounded-[10px] bg-white" /></div>;

  if (data && !data.hasPlan) return <div className="space-y-4">
    <PeriodTabs period={period} onChange={changePeriod} seasonal={false} />
    <EmptyState title="No annual target assigned yet" message="Your admin hasn't set an annual sales target for you. Check back once one is assigned." />
  </div>;

  const seasons = data && data.hasPlan && data.available ? data.plan.seasons : null;
  const isSeasonal = data && data.hasPlan && data.available && data.plan.distributionType === "SEASONAL";

  return <div className="space-y-4">
    <div className="space-y-2">
      <PeriodTabs period={period} onChange={changePeriod} seasonal={Boolean(isSeasonal)} />
      <PeriodIndexSelector period={period} year={year} index={index} seasons={seasons} onYearChange={(y) => { setYear(y); setIndex(undefined); }} onIndexChange={setIndex} />
    </div>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    {data && data.hasPlan && !data.available && <EmptyState title="Not available for this view" message="This period view isn't part of your current annual target plan." />}

    {data && data.hasPlan && data.available && <PeriodOverview data={data} now={now} />}
    {trend && trend.hasPlan && <YearCharts trend={trend} />}
  </div>;
}

function PeriodOverview({ data, now }: { data: Extract<PerformanceResponse, { available: true }>; now: Date }) {
  const { actual, target, remaining, achievementPercent: percent, incentive } = data;
  const end = new Date(data.period.end).getTime();
  const started = new Date(data.period.start).getTime() <= now.getTime();
  const daysLeft = started ? Math.max(0, Math.ceil((end - now.getTime()) / DAY)) : null;
  const perDay = daysLeft && remaining > 0 ? remaining / daysLeft : null;
  const done = percent >= 100;
  const calc = incentive?.calculation ?? {};
  const minPercent = typeof calc.minAchievementPercent === "number" ? calc.minAchievementPercent : null;

  return <>
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <section className="crm-surface p-4 sm:p-5" aria-label={`${PERIOD_LABELS[data.period.period]} target progress`}>
        <p className="text-xs font-medium text-muted">{PERIOD_LABELS[data.period.period]} target</p>
        <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
          <Gauge percent={percent} />
          <div className="w-full min-w-0 flex-1 space-y-3">
            <div><p className="text-xs text-muted">Achieved</p><p className="truncate text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[27px]">{money(actual)}</p></div>
            <div className="h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={Math.min(100, Math.round(percent))} aria-valuemin={0} aria-valuemax={100}><div className={cn("h-full rounded-full transition-[width] duration-300", done ? "bg-success" : "bg-brand")} style={{ width: `${Math.min(100, percent)}%` }} /></div>
            <p className="text-xs text-muted">of <span className="font-semibold text-foreground">{money(target)}</span> target{done ? " · target reached" : ""}</p>
          </div>
        </div>
      </section>

      <section className="crm-surface p-4 sm:p-5" aria-label="Incentive">
        <p className="text-xs font-medium text-muted">Incentive</p>
        {incentive ? <div className="mt-3 space-y-3">
          <p className="text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[27px]">{money(incentive.incentiveAmount)}</p>
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", incentive.eligible ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>{incentive.eligible ? "Unlocked" : "Not yet unlocked"}</span>
          {!incentive.eligible && minPercent != null && <div>
            <div className="relative h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-warning transition-[width] duration-300" style={{ width: `${Math.min(100, (percent / Math.max(minPercent, 1)) * 100)}%` }} /></div>
            <p className="mt-2 text-xs text-muted">Reach <span className="font-semibold text-foreground">{minPercent}%</span> of your target to unlock it. You are at {percent}%.</p>
          </div>}
          {incentive.eligible && <p className="text-xs text-muted">Earned for this period based on your sales.</p>}
        </div> : <div className="mt-3"><p className="text-sm font-medium text-foreground">No incentive on your target</p><p className="mt-1 text-xs text-muted">Your target is tracked without an incentive.</p></div>}
      </section>
    </div>

    <KpiStrip columns={4}>
      <KpiCell label="Achieved" value={compact(actual)} detail={`${percent}% of target`} tone={done ? "success" : "neutral"} />
      <KpiCell label="Target" value={compact(target)} detail={PERIOD_LABELS[data.period.period]} />
      <KpiCell label="Remaining" value={done ? "Done" : compact(remaining)} detail={done ? "Target reached" : "Left to reach target"} tone={done ? "success" : "warning"} />
      <KpiCell label={daysLeft === null ? "Starts later" : daysLeft === 0 ? "Period ended" : "Needed per day"} value={perDay ? compact(perDay) : "—"} detail={daysLeft ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : undefined} />
    </KpiStrip>
  </>;
}

// Semi-circular progress ring; turns green once the target is reached.
function Gauge({ percent }: { percent: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const shown = Math.min(100, Math.max(0, percent));
  return <div className="relative size-36 shrink-0" role="img" aria-label={`${percent}% of target achieved`}>
    <svg viewBox="0 0 128 128" className="size-full -rotate-90">
      <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="11" className="stroke-background" />
      <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="11" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - shown / 100)} className={cn("transition-[stroke-dashoffset] duration-500", percent >= 100 ? "stroke-success" : "stroke-brand")} />
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground">{Math.round(percent)}%</p><p className="mt-1 text-[11px] text-muted">{percent > 100 ? `+${Math.round(percent - 100)}% above` : "achieved"}</p></div></div>
  </div>;
}

function YearCharts({ trend }: { trend: Extract<Trend, { hasPlan: true }> }) {
  const { months, currentMonth, year } = trend;
  const [picked, setPicked] = useState<number | null>(null);
  const selected = months[(picked ?? (currentMonth || 1)) - 1]!;
  const reported = months.slice(0, currentMonth);
  const ytdActual = reported.reduce((sum, month) => sum + month.actual, 0);
  const ytdTarget = reported.reduce((sum, month) => sum + month.target, 0);
  const onTarget = reported.filter((month) => month.target > 0 && month.actual >= month.target).length;
  const gap = ytdActual - ytdTarget;
  const max = Math.max(1, ...months.map((month) => Math.max(month.target, month.actual)));
  const niceMax = niceCeil(max);
  const grid = [1, 0.75, 0.5, 0.25, 0];
  const future = (month: number) => month > currentMonth;

  // Cumulative lines share one coordinate space (x: 0-100 across 12 months, y: 0-50).
  const cumTarget = months.reduce<number[]>((all, month) => [...all, (all.at(-1) ?? 0) + month.target], []);
  const cumActual = reported.reduce<number[]>((all, month) => [...all, (all.at(-1) ?? 0) + month.actual], []);
  const cumMax = Math.max(1, cumTarget.at(-1) ?? 1, cumActual.at(-1) ?? 1);
  const x = (i: number) => (i / 11) * 100;
  const y = (value: number) => 48 - (value / cumMax) * 44;
  const line = (values: number[]) => values.map((value, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(value).toFixed(2)}`).join(" ");
  const area = cumActual.length > 1 ? `${line(cumActual)} L${x(cumActual.length - 1).toFixed(2)} 48 L0 48 Z` : "";

  return <section className="space-y-4" aria-label={`Performance through ${year}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-foreground">Performance in {year}</h2>
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
        <span className="rounded-full bg-background px-2.5 py-1 text-muted">{onTarget} of {Math.max(currentMonth, 0)} months on target</span>
        {currentMonth > 0 && <span className={cn("rounded-full px-2.5 py-1", gap >= 0 ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>{gap >= 0 ? `${compact(gap)} ahead of pace` : `${compact(-gap)} behind pace`}</span>}
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div className="crm-surface p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-foreground">Monthly target vs achieved</h3><p className="mt-0.5 text-xs text-muted">Tap a month for details</p></div>
          <Legend items={[{ label: "Target", className: "bg-brand-soft ring-1 ring-border" }, { label: "Achieved", className: "bg-brand" }]} />
        </div>
        <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-muted" aria-live="polite"><span className="font-semibold text-foreground">{MONTHS[selected.month - 1]}</span> · {future(selected.month) ? `target ${money(selected.target)}` : `${money(selected.actual)} of ${money(selected.target)} (${selected.achievementPercent}%)`}</p>
        <div className="mt-4 flex">
          <div className="relative h-44 w-11 shrink-0 text-[10px] text-subtle sm:h-52" aria-hidden="true">{grid.map((g) => <span key={g} className="absolute right-2 -translate-y-1/2" style={{ top: `${(1 - g) * 100}%` }}>{g === 0 ? "0" : compact(niceMax * g)}</span>)}</div>
          <div className="min-w-0 flex-1">
            <div className="relative flex h-44 items-end gap-[3px] sm:h-52 sm:gap-1.5">
              {grid.map((g) => <span key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border" style={{ top: `${(1 - g) * 100}%` }} aria-hidden="true" />)}
              {months.map((month) => <button key={month.month} type="button" onClick={() => setPicked(month.month)} aria-label={`${MONTHS[month.month - 1]}: ${money(month.actual)} of ${money(month.target)}`} aria-pressed={selected.month === month.month} className={cn("group relative z-10 flex h-full min-w-0 flex-1 items-end justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40", selected.month === month.month && "bg-brand-soft/60")}>
                <span className={cn("absolute bottom-0 w-full rounded-t-[4px] bg-brand-soft ring-1 ring-inset ring-border/70", future(month.month) && "opacity-50")} style={{ height: `${(month.target / niceMax) * 100}%` }} />
                {!future(month.month) && <span className={cn("relative w-[58%] rounded-t-[4px] transition-[height] duration-300", month.target > 0 && month.actual >= month.target ? "bg-success" : "bg-brand")} style={{ height: `${(month.actual / niceMax) * 100}%`, minHeight: month.actual > 0 ? 2 : 0 }} />}
              </button>)}
            </div>
            <div className="mt-1.5 flex gap-[3px] sm:gap-1.5" aria-hidden="true">{months.map((month) => <span key={month.month} className={cn("min-w-0 flex-1 truncate text-center text-[10px]", month.month === currentMonth ? "font-semibold text-foreground" : "text-muted")}>{SHORT[month.month - 1]}</span>)}</div>
          </div>
        </div>
      </div>

      <div className="crm-surface p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-foreground">Progress through the year</h3><p className="mt-0.5 text-xs text-muted">Running total against the target pace</p></div>
          <Legend items={[{ label: "Pace", className: "border-t-2 border-dashed border-subtle h-0 w-4 !bg-transparent" }, { label: "Achieved", className: "bg-brand" }]} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini label="Achieved so far" value={compact(ytdActual)} />
          <Mini label="Pace to date" value={compact(ytdTarget)} />
          <Mini label="Annual target" value={compact(trend.annualTarget)} />
        </div>
        <div className="mt-4 flex">
          <div className="relative h-44 w-11 shrink-0 text-[10px] text-subtle sm:h-52" aria-hidden="true">{grid.map((g) => <span key={g} className="absolute right-2 -translate-y-1/2" style={{ top: `${(1 - g) * 100}%` }}>{g === 0 ? "0" : compact(cumMax * g)}</span>)}</div>
          <div className="min-w-0 flex-1">
            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-44 w-full overflow-visible sm:h-52" role="img" aria-label={`Cumulative sales of ${money(ytdActual)} against a pace of ${money(ytdTarget)}`}>
              {grid.map((g) => <line key={g} x1="0" x2="100" y1={48 - g * 44} y2={48 - g * 44} className="stroke-border" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />)}
              {area && <path d={area} className="fill-brand/10" />}
              <path d={line(cumTarget)} fill="none" className="stroke-subtle" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              {cumActual.length > 0 && <path d={line(cumActual.length > 1 ? cumActual : [cumActual[0]!, cumActual[0]!])} fill="none" className="stroke-brand" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            </svg>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted" aria-hidden="true">{SHORT.map((label, i) => <span key={label} className={cn("w-0 flex-1 text-center", i % 2 && "hidden sm:block")}>{label}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  </section>;
}

function Legend({ items }: { items: Array<{ label: string; className: string }> }) {
  return <div className="flex shrink-0 flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-muted">{items.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><span className={cn("inline-block size-2.5 rounded-sm", item.className)} />{item.label}</span>)}</div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-background px-2 py-2"><p className="truncate text-sm font-semibold text-foreground">{value}</p><p className="truncate text-[10px] text-muted">{label}</p></div>;
}

function PeriodTabs({ period, onChange, seasonal }: { period: PeriodType; onChange: (value: PeriodType) => void; seasonal: boolean }) {
  const options: PeriodType[] = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", ...(seasonal ? (["SEASONAL"] as PeriodType[]) : [])];
  return <div className="flex gap-1 overflow-x-auto rounded-lg border bg-white p-1" role="tablist" aria-label="Performance period">
    {options.map((option) => <button key={option} type="button" role="tab" aria-selected={period === option} onClick={() => onChange(option)} className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${period === option ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>{PERIOD_LABELS[option]}</button>)}
  </div>;
}

function PeriodIndexSelector({ period, year, index, seasons, onYearChange, onIndexChange }: { period: PeriodType; year: number; index: number | undefined; seasons: Season[] | null; onYearChange: (year: number) => void; onIndexChange: (index: number | undefined) => void }) {
  return <div className="flex flex-wrap items-center gap-2">
    <FilterMenu value={String(year)} showLabelOnMobile ariaLabel="Filter performance by year" onSelect={(value) => onYearChange(Number(value))} options={[year - 1, year, year + 1].map((value) => ({ key: String(value), label: String(value) }))} />
    {period === "MONTHLY" && <FilterMenu value={index == null ? "" : String(index)} showLabelOnMobile ariaLabel="Filter performance by month" onSelect={(value) => onIndexChange(value ? Number(value) : undefined)} options={[{ key: "", label: "Current month" }, ...MONTHS.map((label, i) => ({ key: String(i + 1), label }))]} />}
    {period === "QUARTERLY" && <FilterMenu value={index == null ? "" : String(index)} showLabelOnMobile ariaLabel="Filter performance by quarter" onSelect={(value) => onIndexChange(value ? Number(value) : undefined)} options={[{ key: "", label: "Current quarter" }, ...[1, 2, 3, 4].map((value) => ({ key: String(value), label: `Q${value}` }))]} />}
    {period === "HALF_YEARLY" && <FilterMenu value={index == null ? "" : String(index)} showLabelOnMobile ariaLabel="Filter performance by half year" onSelect={(value) => onIndexChange(value ? Number(value) : undefined)} options={[{ key: "", label: "Current half" }, { key: "1", label: "H1 (Jan–Jun)" }, { key: "2", label: "H2 (Jul–Dec)" }]} />}
    {period === "SEASONAL" && seasons && <FilterMenu value={index == null ? "" : String(index)} showLabelOnMobile ariaLabel="Filter performance by season" onSelect={(value) => onIndexChange(value ? Number(value) : undefined)} options={[{ key: "", label: "Select season" }, ...seasons.map((season, i) => ({ key: String(i + 1), label: season.name }))]} />}
  </div>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="crm-surface px-5 py-14 text-center">
    <Target className="mx-auto text-subtle" size={26} />
    <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
    <p className="mt-1 text-xs text-muted">{message}</p>
  </div>;
}
