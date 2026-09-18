"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { EmptyState, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";

export type AuditLogRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; name: string; loginId: string } | null;
};

const ENTITIES = ["", "USER", "DISTRIBUTOR", "AGREEMENT"];

export function AuditLogClient({ initialEntries, activeEntity }: { initialEntries: AuditLogRow[]; activeEntity: string }) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Activity</h2>
        <Select
          className="h-9 w-[180px] text-xs"
          value={activeEntity}
          onChange={(event) => router.push(event.target.value ? `/dashboard/audit-log?entity=${event.target.value}` : "/dashboard/audit-log")}
        >
          {ENTITIES.map((entity) => (
            <option key={entity || "all"} value={entity}>{entity || "All entities"}</option>
          ))}
        </Select>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Action</TH>
            <TH>Entity</TH>
            <TH>Actor</TH>
            <TH>IP</TH>
            <TH>When</TH>
          </TR>
        </THead>
        <TBody>
          {initialEntries.map((entry) => (
            <TR key={entry.id}>
              <TD className="font-medium text-foreground">{entry.action.replaceAll("_", " ")}</TD>
              <TD className="text-muted">{entry.entity}</TD>
              <TD className="text-muted">{entry.actor ? `${entry.actor.name} (${entry.actor.loginId})` : "System"}</TD>
              <TD className="text-muted">{entry.ipAddress ?? "-"}</TD>
              <TD className="text-muted">{new Date(entry.createdAt).toLocaleString()}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {initialEntries.length === 0 && <EmptyState message="Actions taken across the CRM will be recorded here." />}
    </div>
  );
}
