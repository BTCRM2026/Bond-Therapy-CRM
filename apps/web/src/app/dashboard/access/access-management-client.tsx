"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";

export type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  dashboardPath: string;
  priority: number;
  isActive: boolean;
};

export function AccessManagementClient({ initialRoles }: { initialRoles: RoleRow[] }) {
  const router = useRouter();

  const onToggle = async (role: RoleRow) => {
    const response = await fetch(`/api/roles/${role.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !role.isActive }),
    });
    if (response.ok) router.refresh();
  };

  return (
    <div className="space-y-5">
      <div><h2 className="text-base font-semibold text-foreground">Portal roles</h2><p className="mt-1 text-xs text-muted">Control which operational roles are permitted to sign in.</p></div>
      <Table>
        <THead>
          <TR>
            <TH>Role</TH>
            <TH>Dashboard</TH>
            <TH>Priority</TH>
            <TH>Status</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {initialRoles.map((role) => (
            <TR key={role.id}>
              <TD>
                <p className="font-medium text-foreground">{role.name}</p>
                <p className="text-xs text-muted">{role.description ?? role.key}</p>
              </TD>
              <TD className="text-muted">{role.dashboardPath}</TD>
              <TD className="text-muted">{role.priority}</TD>
              <TD><Badge tone={role.isActive ? "success" : "neutral"}>{role.isActive ? "Active" : "Disabled"}</Badge></TD>
              <TD>
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    disabled={role.key === "SUPER_ADMIN"}
                    onClick={() => onToggle(role)}
                  >
                    {role.isActive ? "Disable" : "Enable"}
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {initialRoles.length === 0 && <EmptyState message="Roles will appear here once seeded." />}
    </div>
  );
}
