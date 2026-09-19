"use client";

import { Bell, Check, CircleAlert, Inbox } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Notification = {
  id: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationCenter() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setItems(await response.json() as Notification[]);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setOpen(false);
      if (event instanceof MouseEvent && root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, []);

  const unread = items.filter((item) => !item.isRead).length;
  const markRead = async (item: Notification) => {
    if (item.isRead) return;
    const response = await fetch(`/api/notifications/${item.id}`, { method: "PATCH" });
    if (response.ok) setItems((current) => current.map((value) => value.id === item.id ? { ...value, isRead: true } : value));
  };

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-9 place-items-center rounded-lg border bg-white text-muted shadow-[0_2px_6px_rgba(23,32,51,0.06)] transition-colors hover:border-brand/20 hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell size={17} strokeWidth={1.8} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && <section className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border bg-white shadow-[0_18px_48px_rgba(16,24,40,0.16)]" aria-label="Notifications panel">
        <div className="flex items-center justify-between border-b px-4 py-3.5">
          <div><h2 className="text-sm font-semibold text-foreground">Notifications</h2><p className="mt-0.5 text-[11px] text-muted">Only alerts assigned to this account</p></div>
          {unread > 0 && <span className="rounded-full bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand">{unread} new</span>}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {loading && <p className="px-4 py-8 text-center text-xs text-muted">Loading notifications…</p>}
          {!loading && failed && <div className="px-4 py-8 text-center"><CircleAlert className="mx-auto text-danger" size={20} /><p className="mt-2 text-xs text-muted">Notifications could not be loaded.</p></div>}
          {!loading && !failed && items.length === 0 && <div className="px-4 py-9 text-center"><Inbox className="mx-auto text-subtle" size={22} /><p className="mt-2 text-sm font-medium text-foreground">You’re all caught up</p><p className="mt-1 text-xs text-muted">New alerts for this account will appear here.</p></div>}
          {!loading && !failed && items.map((item) => <button key={item.id} type="button" onClick={() => markRead(item)} className={`flex w-full gap-3 border-b px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-background ${item.isRead ? "bg-white" : "bg-brand-soft/40"}`}>
            <span className={`mt-1 size-2 shrink-0 rounded-full ${item.severity === "CRITICAL" ? "bg-danger" : item.severity === "WARNING" ? "bg-warning" : "bg-info"}`} />
            <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><strong className="text-xs font-semibold text-foreground">{item.title}</strong>{item.isRead && <Check size={13} className="shrink-0 text-subtle" />}</span><span className="mt-1 block text-xs leading-5 text-muted">{item.message}</span><span className="mt-1.5 block text-[10px] text-subtle">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(item.createdAt))}</span></span>
          </button>)}
        </div>
      </section>}
    </div>
  );
}
