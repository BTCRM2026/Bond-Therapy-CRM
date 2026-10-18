"use client";

import { useEffect, useState } from "react";
import { TeamBoard } from "@/components/team-activity-board";
import { TeamFollowUps, TeamLeads } from "@/components/team-activity-lists";
import { type StaffOption, teamApi } from "@/components/team-activity-shared";
import { cn } from "@/lib/utils";

const TABS = [["board", "Daily board"], ["leads", "Leads"], ["followups", "Follow-ups & demos"]] as const;

// Read-only monitoring of what the sales team did. Each tab loads only the page of rows being looked at.
export function TeamActivity() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("board");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  useEffect(() => { (async () => { try { setStaff(await teamApi<StaffOption[]>("/staff")); } catch { /* the staff filter is optional */ } })(); }, []);

  return <div className="space-y-4">
    <div className="flex gap-1 overflow-x-auto rounded-lg border bg-white p-1" role="tablist" aria-label="Team activity sections">
      {TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("shrink-0 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors", tab === key ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background")}>{label}</button>)}
    </div>
    {tab === "board" && <TeamBoard />}
    {tab === "leads" && <TeamLeads staff={staff} />}
    {tab === "followups" && <TeamFollowUps staff={staff} />}
  </div>;
}
