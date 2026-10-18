"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

// Shown on My Route while the day cannot be started: the last working day's report is missing and the admin has not approved yet.
export function DayGateBanner() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/attendance/day-gate", { cache: "no-store" });
        const data = await response.json().catch(() => null) as { blocked?: boolean; message?: string | null } | null;
        if (!cancelled && response.ok && data?.blocked) setMessage(data.message ?? "Ask your administrator to approve today’s start.");
      } catch { /* the banner is only a courtesy; the server enforces the rule */ }
    })();
    return () => { cancelled = true; };
  }, []);
  if (!message) return null;
  return <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-red-50 px-4 py-3 text-xs text-danger"><TriangleAlert size={15} className="mt-0.5 shrink-0" /><p>{message}</p></div>;
}
