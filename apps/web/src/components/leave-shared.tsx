import { cn } from "@/lib/utils";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";
export type MonthSplit = { month: string; days: number; paid: number; unpaid: number };
export type LeaveItem = {
  id: string;
  staff?: { id: string; name: string };
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  totalDays: number;
  paidDays: number;
  unpaidDays: number;
  months: MonthSplit[];
  estimated: boolean;
};

export const STATUS_LABEL: Record<LeaveStatus, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };
const STATUS_TONE: Record<LeaveStatus, string> = { PENDING: "bg-warning-soft text-warning", APPROVED: "bg-success-soft text-success", REJECTED: "bg-red-50 text-danger" };

const parse = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`);
const short = (value: string) => parse(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export const longDate = (value: string) => parse(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const rangeLabel = (start: string, end: string) => (start === end ? longDate(start) : `${short(start)} – ${longDate(end)}`);
export const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export async function leaveApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/leave${path}`, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data ? (data as { message: unknown }).message : null;
    throw new Error(Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "Something went wrong. Please try again.");
  }
  return data as T;
}
export const jsonInit = (method: string, body?: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export function StatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

// Paid days in green, unpaid (salary deduction) in amber. A pending request shows what would happen if it were approved today.
export function PaySplit({ item }: { item: Pick<LeaveItem, "status" | "paidDays" | "unpaidDays" | "estimated" | "totalDays"> }) {
  if (item.status === "REJECTED") return <span className="text-xs text-subtle">—</span>;
  return <div className="flex flex-wrap items-center gap-1.5">
    {item.estimated && <span className="text-[11px] text-muted">If approved:</span>}
    {item.paidDays > 0 && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">{item.paidDays} paid</span>}
    {item.unpaidDays > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">{item.unpaidDays} unpaid</span>}
    {item.paidDays === 0 && item.unpaidDays === 0 && <span className="text-xs text-subtle">—</span>}
  </div>;
}
