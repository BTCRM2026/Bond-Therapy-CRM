import { cn } from "@/lib/utils";

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number; hasMore: boolean };
export type StaffOption = { id: string; name: string };

export async function teamApi<T>(path: string): Promise<T> {
  const response = await fetch(`/api/team-activity${path}`, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data ? (data as { message: unknown }).message : null;
    throw new Error(Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "Unable to load this information.");
  }
  return data as T;
}

export const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const compactMoney = (value: number) => value >= 1e7 ? `₹${+(value / 1e7).toFixed(1)}Cr` : value >= 1e5 ? `₹${+(value / 1e5).toFixed(1)}L` : value >= 1e3 ? `₹${+(value / 1e3).toFixed(1)}K` : `₹${Math.round(value)}`;
export const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—");
export const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
export const longDay = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
export const shiftDay = (key: string, by: number) => new Date(new Date(`${key}T00:00:00Z`).getTime() + by * 86_400_000).toISOString().slice(0, 10);
export const todayKey = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

const ATTENDANCE_TONE: Record<string, string> = { PRESENT: "bg-success-soft text-success", LATE: "bg-warning-soft text-warning", HALF_DAY: "bg-warning-soft text-warning", ABSENT: "bg-red-50 text-danger", LEAVE: "bg-brand-soft text-brand-dark", HOLIDAY: "bg-info-soft text-info", WEEKLY_OFF: "bg-background text-muted", NOT_PUNCHED: "bg-background text-muted", IN_PROGRESS: "bg-brand-soft text-brand-dark" };
export function AttendanceBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold", ATTENDANCE_TONE[status] ?? "bg-background text-muted")}>{status === "NOT_PUNCHED" ? "No activity" : pretty(status)}</span>;
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "brand" }) {
  const tones = { neutral: "bg-background text-muted", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-red-50 text-danger", brand: "bg-brand-soft text-brand-dark" };
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tones[tone])}>{children}</span>;
}

export function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ key: T; label: string; count?: number }>; onChange: (key: T) => void; label: string }) {
  return <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>{options.map((option) => <button key={option.key} type="button" aria-pressed={value === option.key} onClick={() => onChange(option.key)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", value === option.key ? "border-brand/30 bg-brand-soft text-brand-dark" : "bg-white text-muted hover:bg-background")}>{option.label}{option.count !== undefined && <span className="rounded-full bg-background px-1.5 text-[10px]">{option.count}</span>}</button>)}</div>;
}

export function EmptyBlock({ title, message }: { title: string; message: string }) {
  return <section className="crm-surface px-5 py-14 text-center"><p className="text-sm font-semibold text-foreground">{title}</p><p className="mt-1 text-xs text-muted">{message}</p></section>;
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-2">{Array.from({ length: rows }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-white" />)}</div>;
}
