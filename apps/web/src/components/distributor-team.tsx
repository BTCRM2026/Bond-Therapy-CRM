"use client";

import { LoaderCircle, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TeamUser = { id: string; loginId: string; email: string; name: string; status: string; lastLoginAt: string | null; createdAt: string; roleKey: string | null; roleName: string | null };
const ROLE_OPTIONS = [
  { value: "DISTRIBUTOR_OWNER", label: "Owner – full access" },
  { value: "DISTRIBUTOR_ACCOUNTS", label: "Accounts – review, approve, bill" },
  { value: "DISTRIBUTOR_WAREHOUSE", label: "Warehouse – fulfill only" },
];
const messageFrom = (data: unknown, fallback: string) => (data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback);

export function DistributorTeam({ initial }: { initial: TeamUser[] }) {
  const [users, setUsers] = useState(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState("DISTRIBUTOR_WAREHOUSE");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const reload = async () => {
    const response = await fetch("/api/distributor/team", { cache: "no-store" });
    if (response.ok) setUsers(await response.json());
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/distributor/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password, roleKey }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to create this login."));
      setName(""); setEmail(""); setPassword(""); setRoleKey("DISTRIBUTOR_WAREHOUSE");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create this login.");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (user: TeamUser) => {
    setBusyId(user.id);
    setError("");
    try {
      const status = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const response = await fetch(`/api/distributor/team/${user.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to update this login."));
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this login.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-5">
      {error && <FormError message={error} />}
      <section className="crm-surface p-4 sm:p-5">
        <form className="space-y-3" onSubmit={createUser}>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><UserPlus size={16} />Add a team login</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required minLength={2} />
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password (min. 8 characters)" required minLength={8} />
            <Select value={roleKey} onChange={setRoleKey} options={ROLE_OPTIONS} />
          </div>
          <Button type="submit" disabled={creating}>{creating ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}{creating ? "Creating…" : "Create login"}</Button>
        </form>
      </section>

      <section className="crm-surface">
        <div className="rounded-t-xl border-b px-5 py-4"><h2 className="text-sm font-semibold text-foreground">Your team</h2><p className="mt-0.5 text-xs text-muted">Everyone with access to this distributor&apos;s portal</p></div>
        <div className="divide-y">
          {users.length ? users.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 p-4 sm:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium text-foreground">{user.name}</p>{user.roleName && <span className="inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">{user.roleName}</span>}</div>
                <p className="truncate text-xs text-muted">{user.loginId} · {user.email}</p>
              </div>
              <Button variant="secondary" disabled={busyId === user.id} onClick={() => toggleStatus(user)}>{user.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button>
            </div>
          )) : <p className="px-5 py-10 text-center text-xs text-muted">No logins yet. Create one above.</p>}
        </div>
      </section>
    </div>
  );
}
