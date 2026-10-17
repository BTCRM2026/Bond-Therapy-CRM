"use client";

import { Bell, CheckCheck, CircleAlert, Inbox } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const REFRESH_MS = 60_000;
const stamp = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export function NotificationCenter() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setItems(await response.json() as Notification[]);
      setFailed(false);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);

  // Load now, then keep the badge fresh while the tab is visible; reload whenever the panel opens.
  useEffect(() => {
    (async () => { await load(); })();
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setOpen(false);
      if (event instanceof MouseEvent && root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const unread = items.filter((item) => !item.isRead).length;
  const setRead = (ids: Set<string>, isRead: boolean) => setItems((current) => current.map((value) => ids.has(value.id) ? { ...value, isRead } : value));

  const markRead = async (item: Notification) => {
    if (item.isRead) return;
    setRead(new Set([item.id]), true);
    try {
      const response = await fetch(`/api/notifications/${item.id}`, { method: "PATCH" });
      if (!response.ok) throw new Error();
    } catch { setRead(new Set([item.id]), false); }
  };

  const markAllRead = async () => {
    const ids = new Set(items.filter((item) => !item.isRead).map((item) => item.id));
    if (!ids.size) return;
    setRead(ids, true);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "PATCH" });
      if (!response.ok) throw new Error();
    } catch { setRead(ids, false); }
  };

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        onClick={() => { if (!open) load(); setOpen((value) => !value); }}
        className="relative grid size-11 place-items-center rounded-lg border bg-white text-muted shadow-[0_2px_6px_rgba(15,23,42,0.05)] transition-colors hover:border-brand/25 hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 sm:size-9"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell size={17} strokeWidth={1.8} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {/* On phones the panel is pinned to the screen edges under the header; from sm up it hangs from the bell. */}
      {open && <section className="fixed inset-x-3 top-[68px] z-50 flex max-h-[min(78dvh,520px)] flex-col overflow-hidden rounded-xl border bg-white shadow-[0_18px_48px_rgba(15,23,42,0.15)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]" aria-label="Notifications panel">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3.5">
          <div className="min-w-0"><h2 className="text-sm font-semibold text-foreground">Notifications</h2><p className="mt-0.5 truncate text-[11px] text-muted">{unread > 0 ? `${unread} unread` : "Only alerts assigned to this account"}</p></div>
          {unread > 0 && <button type="button" onClick={markAllRead} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"><CheckCheck size={13} />Mark all read</button>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loading && <p className="px-4 py-8 text-center text-xs text-muted">Loading notifications…</p>}
          {!loading && failed && !items.length && <div className="px-4 py-8 text-center"><CircleAlert className="mx-auto text-danger" size={20} /><p className="mt-2 text-xs text-muted">Notifications could not be loaded.</p><button type="button" onClick={load} className="mt-2 text-xs font-semibold text-brand underline">Try again</button></div>}
          {!loading && !failed && items.length === 0 && <div className="px-4 py-9 text-center"><Inbox className="mx-auto text-subtle" size={22} /><p className="mt-2 text-sm font-medium text-foreground">You’re all caught up</p><p className="mt-1 text-xs text-muted">New alerts for this account will appear here.</p></div>}
          {items.map((item) => <button key={item.id} type="button" onClick={() => markRead(item)} className={cn("flex w-full gap-3 border-b px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-background focus-visible:bg-background focus-visible:outline-none", item.isRead ? "bg-white" : "bg-brand-soft/40")} aria-label={`${item.isRead ? "" : "Unread. "}${item.title}. ${item.message}`}>
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.isRead ? "bg-border" : item.severity === "CRITICAL" ? "bg-danger" : item.severity === "WARNING" ? "bg-warning" : "bg-brand")} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <strong className={cn("block break-words text-xs text-foreground", item.isRead ? "font-medium" : "font-semibold")}>{item.title}</strong>
              <span className="mt-1 block break-words text-xs leading-5 text-muted">{item.message}</span>
              <span className="mt-1.5 block text-[10px] text-subtle">{stamp(item.createdAt)}</span>
            </span>
          </button>)}
        </div>
      </section>}
    </div>
  );
}
