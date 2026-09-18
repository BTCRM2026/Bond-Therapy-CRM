"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Plus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { StatRow } from "@/components/ui/stat-row";

export type RoleOption = { id: string; key: string; name: string; isActive: boolean };
export type UserRow = {
  id: string;
  loginId: string;
  email: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ key: string; name: string }>;
};

const statusTone = { ACTIVE: "success", INACTIVE: "neutral", LOCKED: "danger" } as const;

const createSchema = z.object({
  loginId: z.string().trim().min(2, "Login ID is required."),
  email: z.string().trim().email("Enter a valid email."),
  name: z.string().trim().min(2, "Name is required."),
  roleKey: z.string().min(1, "Select a role."),
});
type CreateValues = z.infer<typeof createSchema>;

export function TeamManagementClient({ initialUsers, roles }: { initialUsers: UserRow[]; roles: RoleOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { loginId: "", email: "", name: "", roleKey: roles[0]?.key ?? "" } });

  const stats = useMemo(
    () => [
      { label: "Total accounts", value: initialUsers.length },
      { label: "Active", value: initialUsers.filter((u) => u.status === "ACTIVE").length },
      { label: "Locked", value: initialUsers.filter((u) => u.status === "LOCKED").length },
    ],
    [initialUsers],
  );

  const onCreate = async (values: CreateValues) => {
    setBanner(null);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json().catch(() => null)) as { message?: string; temporaryPassword?: string } | null;
    if (!response.ok) {
      setBanner({ tone: "danger", message: data?.message ?? "Could not create the account." });
      return;
    }
    setBanner({
      tone: "success",
      message: data?.temporaryPassword
        ? `Account created. Temporary password: ${data.temporaryPassword}`
        : "Account created.",
    });
    reset();
    setOpen(false);
    router.refresh();
  };

  const onResetPassword = async (id: string) => {
    setBanner(null);
    const response = await fetch(`/api/users/${id}/reset-password`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as { message?: string; temporaryPassword?: string } | null;
    if (!response.ok) {
      setBanner({ tone: "danger", message: data?.message ?? "Could not reset the password." });
      return;
    }
    setBanner({ tone: "success", message: `Password reset. New temporary password: ${data?.temporaryPassword}` });
    router.refresh();
  };

  const onToggleStatus = async (user: UserRow) => {
    const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) router.refresh();
  };

  return (
    <div className="space-y-5">
      <StatRow stats={stats} />

      {banner && (
        <div
          role="status"
          className={`rounded-lg border px-3.5 py-2.5 text-[13px] ${banner.tone === "success" ? "border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]" : "border-red-200 bg-red-50 text-danger"}`}
        >
          {banner.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Accounts</h2>
        <Button onClick={() => setOpen(true)}>
          <UserPlus size={16} /> New account
        </Button>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Login ID</TH>
            <TH>Role</TH>
            <TH>Status</TH>
            <TH>Last login</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {initialUsers.map((user) => (
            <TR key={user.id}>
              <TD>
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted">{user.email}</p>
              </TD>
              <TD className="text-muted">{user.loginId}</TD>
              <TD>
                {user.roles.map((role) => (
                  <Badge key={role.key} tone="brand" className="mr-1">{role.name}</Badge>
                ))}
              </TD>
              <TD>
                <Badge tone={statusTone[user.status]}>{user.status}</Badge>
              </TD>
              <TD className="text-muted">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</TD>
              <TD>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" className="h-8 rounded-full px-3 text-xs" onClick={() => onResetPassword(user.id)}>
                    <KeyRound size={13} /> Reset password
                  </Button>
                  <Button variant="secondary" className="h-8 rounded-full px-3 text-xs" onClick={() => onToggleStatus(user)}>
                    {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {initialUsers.length === 0 && <EmptyState message="Create the first team account to get started." />}

      <Drawer open={open} onClose={() => setOpen(false)} title="New account" description="Create a login for a team member and assign their role.">
        <form className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="name">Full name</label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="loginId">Login ID</label>
            <Input id="loginId" {...register("loginId")} />
            {errors.loginId && <p className="text-xs text-danger">{errors.loginId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="email">Email</label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="roleKey">Role</label>
            <Select id="roleKey" {...register("roleKey")}>
              {roles.map((role) => (
                <option key={role.id} value={role.key}>{role.name}</option>
              ))}
            </Select>
            {errors.roleKey && <p className="text-xs text-danger">{errors.roleKey.message}</p>}
          </div>
          <p className="text-xs text-muted">A temporary password will be generated automatically and shown once.</p>
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            <Plus size={16} /> {isSubmitting ? "Creating..." : "Create account"}
          </Button>
        </form>
      </Drawer>
    </div>
  );
}
