"use client";

import { CalendarClock, CheckCircle2, Clock3, Flag, ListChecks, NotebookPen, Phone, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Activity = {
  id: string; type: string; status: string; purpose: string | null; personMet: string | null; note: string | null; scheduledAt: string | null; createdAt: string;
  client: { id: string; salonName: string; city: string; primaryContact: string };
  createdBy: { id: string; name: string };
};

const TYPE_ICON: Record<string, typeof Flag> = { VISIT: CalendarClock, FOLLOW_UP: Clock3, DEMO: Flag, SAMPLE: ShoppingBag, NOTE: NotebookPen };
const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
const isOverdue = (value: string | null) => value ? new Date(value).getTime() < Date.now() : false;
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

export function FollowUpsModule({ initial }: { initial: Activity[] | null }) {
  const [items, setItems] = useState(initial ?? []);
  const [scope, setScope] = useState<"open" | "overdue">("open");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Unable to load your follow-ups. Please try again.");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/clients/activities?scope=${scope}`, { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(json, "Unable to load your follow-ups."));
        if (!cancelled) { setItems(json as Activity[]); setError(""); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load your follow-ups."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [scope]);

  const markDone = async (id: string) => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/clients/activities/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "COMPLETED" }) });
      if (!response.ok) throw new Error();
      setItems((current) => current.filter((item) => item.id !== id));
    } catch { setError("Unable to update that item. Try again."); }
    finally { setBusyId(""); }
  };

  return <div className="space-y-4">
    <div className="flex gap-2">
      <button type="button" onClick={() => setScope("open")} className={`h-10 rounded-lg border px-4 text-xs font-semibold transition-colors ${scope === "open" ? "border-brand bg-brand text-white" : "text-muted hover:bg-brand-soft/60"}`}>Open today</button>
      <button type="button" onClick={() => setScope("overdue")} className={`h-10 rounded-lg border px-4 text-xs font-semibold transition-colors ${scope === "overdue" ? "border-brand bg-brand text-white" : "text-muted hover:bg-brand-soft/60"}`}>Overdue</button>
    </div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    <section className="crm-surface overflow-hidden">
      {loading ? <div className="space-y-3 p-4"><div className="h-20 animate-pulse rounded-lg bg-background" /><div className="h-20 animate-pulse rounded-lg bg-background" /></div>
        : items.length ? <div className="divide-y">{items.map((activity) => {
          const Icon = TYPE_ICON[activity.type] ?? Flag;
          const overdue = isOverdue(activity.scheduledAt);
          return <div key={activity.id} className="flex gap-3 p-4 sm:p-5">
            <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${overdue ? "bg-red-50 text-danger" : "bg-brand-soft text-brand"}`}><Icon size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/dashboard/clients/${activity.client.id}`} className="text-sm font-semibold text-foreground hover:text-brand">{activity.client.salonName}</Link>
                <span className={`text-[11px] font-semibold ${overdue ? "text-danger" : "text-muted"}`}>{activity.scheduledAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.scheduledAt)) : "No date set"}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{pretty(activity.type)}{activity.purpose ? ` · ${activity.purpose}` : ""}{activity.personMet ? ` · ${activity.personMet}` : ""}</p>
              {activity.note && <p className="mt-1 text-xs leading-5 text-muted">{activity.note}</p>}
              <div className="mt-3 flex gap-2">
                <a href={`tel:${activity.client.primaryContact}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold text-foreground"><Phone size={13} />Call</a>
                <Button variant="secondary" className="h-9 px-3" disabled={busyId === activity.id} onClick={() => markDone(activity.id)}><CheckCircle2 size={14} />{busyId === activity.id ? "Saving…" : "Mark done"}</Button>
              </div>
            </div>
          </div>;
        })}</div>
        : <div className="px-5 py-14 text-center"><ListChecks className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold text-foreground">{scope === "overdue" ? "Nothing overdue" : "You are all caught up"}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">Visits, follow-ups, demos and samples logged from Salon 360 will show up here.</p></div>}
    </section>
  </div>;
}
