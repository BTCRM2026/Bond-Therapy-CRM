"use client";

import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type NotificationRow = {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const severityTone = { INFO: "info", WARNING: "warning", CRITICAL: "danger" } as const;
const severityIcon = { INFO: Info, WARNING: AlertTriangle, CRITICAL: AlertTriangle };

export function NotificationsClient({ initialNotifications }: { initialNotifications: NotificationRow[] }) {
  const router = useRouter();

  const onMarkRead = async (id: string) => {
    const response = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    if (response.ok) router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold text-foreground">System alerts</h2><p className="mt-1 text-xs text-muted">Review changes and items that require attention.</p></div>
        <Badge tone="brand"><Bell size={12} /> {initialNotifications.filter((n) => !n.isRead).length} unread</Badge>
      </div>

      <div className="space-y-2.5">
        {initialNotifications.map((notification) => {
          const Icon = severityIcon[notification.severity];
          return (
            <div
              key={notification.id}
              className={cn(
                "flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(23,32,51,0.025)] sm:flex-row sm:items-start sm:justify-between",
                !notification.isRead && "border-brand/30 bg-brand-soft/40",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-background text-muted">
                  <Icon size={16} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{notification.title}</p>
                    <Badge tone={severityTone[notification.severity]}>{notification.severity}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-muted">{notification.message}</p>
                  <p className="mt-1.5 text-[11px] text-subtle">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {!notification.isRead && (
                <Button variant="secondary" className="h-8 shrink-0 px-3 text-xs" onClick={() => onMarkRead(notification.id)}>
                  <CheckCircle2 size={13} /> Mark read
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {initialNotifications.length === 0 && <EmptyState message="You're all caught up. Alerts about expiring agreements and locked accounts will show up here." />}
    </div>
  );
}
