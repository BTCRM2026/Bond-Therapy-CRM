"use client";

import { KeyRound, LoaderCircle, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, UserRoundCheck, UsersRound, UserX, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";

type Role = { key: string; name: string; portal: "ADMIN" | "STAFF"; department: string; dataScope: string };
type StaffProfile = {
  employeeCode: string;
  mobile: string;
  jobTitle: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  joiningDate: string;
  dateOfBirth: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  bloodGroup: string | null;
  workLocation: string | null;
  residentialAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactMobile: string | null;
};
type StaffUser = {
  id: string;
  loginId: string;
  email: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  department: string | null;
  dataScope: string;
  managerId: string | null;
  manager: { id: string; name: string } | null;
  lastLoginAt: string | null;
  roles: Array<{ key: string; name: string; portal: "ADMIN" | "STAFF" }>;
  profile: StaffProfile | null;
};
export type StaffDirectory = { users: StaffUser[]; roles: Role[] };

const pretty = (value?: string | null) => value ? value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : "—";
const messageFrom = (data: unknown, fallback: string) => {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string") return message;
  }
  return fallback;
};

export function StaffManagement({ initialDirectory }: { initialDirectory: StaffDirectory | null }) {
  const [directory, setDirectory] = useState(initialDirectory);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; user?: StaffUser } | null>(null);
  const [passwordUser, setPasswordUser] = useState<StaffUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<StaffUser | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(initialDirectory ? "" : "Staff data could not be loaded. Check the API connection and try again.");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHeaderSlot(document.getElementById("page-header-actions")));
    return () => cancelAnimationFrame(frame);
  }, []);

  const reload = async () => {
    const response = await fetch("/api/staff", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(messageFrom(data, "Unable to refresh staff data."));
    setDirectory(data as StaffDirectory);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (directory?.users ?? []).filter((user) => {
      const role = user.roles[0];
      return (roleFilter === "ALL" || role?.key === roleFilter) && (!term || `${user.name} ${user.loginId} ${user.email} ${user.profile?.employeeCode ?? ""} ${role?.name ?? ""}`.toLowerCase().includes(term));
    });
  }, [directory, roleFilter, search]);

  const toggleStatus = async (user: StaffUser) => {
    setBusyId(user.id); setError(""); setNotice("");
    try {
      const status = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const response = await fetch(`/api/staff/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to update account status."));
      await reload();
      setNotice(`${user.name} is now ${status.toLowerCase()}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update account status."); }
    finally { setBusyId(""); }
  };

  const active = directory?.users.filter((user) => user.status === "ACTIVE").length ?? 0;
  const managers = directory?.users.filter((user) => user.status === "ACTIVE" && user.roles.some((role) => role.key === "SALES_MANAGER")) ?? [];

  return (
    <>
      {headerSlot && createPortal(<Button onClick={() => setEditor({ mode: "create" })}><Plus size={16} /><span className="hidden sm:inline">Add staff</span><span className="sr-only sm:hidden">Add staff</span></Button>, headerSlot)}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <KpiCard icon={UsersRound} label="Managed accounts" value={directory?.users.length ?? 0} />
        <KpiCard icon={UserRoundCheck} label="Active accounts" value={active} />
        <KpiCard icon={ShieldCheck} label="Approved roles" value={directory?.roles.length ?? 0} />
      </div>

      <section className="relative rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search name, employee code, login ID or email" aria-label="Search staff" />
          </label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-11 rounded-lg border bg-white px-3 text-[13px] text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10" aria-label="Filter by role">
            <option value="ALL">All roles</option>
            {directory?.roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
          </select>
        </div>

        {(notice || error) && <div className={`mx-4 mt-4 rounded-lg border px-3 py-2.5 text-xs sm:mx-5 ${error ? "border-red-200 bg-red-50 text-danger" : "border-success/25 bg-success-soft text-success"}`} role={error ? "alert" : "status"}>{error || notice}</div>}

        <div className="hidden overflow-visible xl:block">
          <table className="w-full min-w-[920px] text-left text-[13px]">
            <thead className="border-b bg-background text-[10px] font-bold uppercase tracking-[0.1em] text-muted"><tr><th className="px-5 py-3">Staff member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last login</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y">
              {filtered.map((user) => <StaffRow key={user.id} user={user} busy={busyId === user.id} onEdit={() => setEditor({ mode: "edit", user })} onPassword={() => setPasswordUser(user)} onStatus={() => toggleStatus(user)} onDelete={() => setDeleteUser(user)} />)}
            </tbody>
          </table>
        </div>
        <div className="divide-y xl:hidden">{filtered.map((user) => <StaffCard key={user.id} user={user} busy={busyId === user.id} onEdit={() => setEditor({ mode: "edit", user })} onPassword={() => setPasswordUser(user)} onStatus={() => toggleStatus(user)} onDelete={() => setDeleteUser(user)} />)}</div>
        {!filtered.length && <div className="px-5 py-12 text-center"><UsersRound className="mx-auto text-subtle" size={24} /><p className="mt-3 text-sm font-semibold text-foreground">No staff found</p><p className="mt-1 text-xs text-muted">Adjust the search or add a staff account.</p></div>}
      </section>

      {editor && directory && <StaffEditor mode={editor.mode} user={editor.user} roles={directory.roles} managers={managers} onClose={() => setEditor(null)} onSaved={async (message) => { setEditor(null); await reload(); setError(""); setNotice(message); }} />}
      {passwordUser && <PasswordEditor user={passwordUser} onClose={() => setPasswordUser(null)} onSaved={(message) => { setPasswordUser(null); setError(""); setNotice(message); }} />}
      {deleteUser && <DeleteEditor user={deleteUser} onClose={() => setDeleteUser(null)} onDeleted={async () => { const name = deleteUser.name; setDeleteUser(null); await reload(); setError(""); setNotice(`${name} was deleted.`); }} />}
    </>
  );
}

function Status({ value }: { value: StaffUser["status"] }) {
  const tone = value === "ACTIVE" ? "bg-success-soft text-success" : value === "LOCKED" ? "bg-warning-soft text-warning" : "bg-gray-100 text-muted";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{pretty(value)}</span>;
}

const lastLogin = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never";

type StaffActionsProps = { user: StaffUser; busy: boolean; onEdit: () => void; onPassword: () => void; onStatus: () => void; onDelete: () => void };

function StaffRow({ user, busy, onEdit, onPassword, onStatus, onDelete }: StaffActionsProps) {
  const role = user.roles[0];
  return <tr className="transition-colors hover:bg-brand-soft/40"><td className="px-5 py-4"><p className="font-semibold text-foreground">{user.name}</p><p className="mt-0.5 text-xs text-muted">{user.profile?.employeeCode ? `${user.profile.employeeCode} · ` : ""}{user.loginId}</p><p className="mt-0.5 text-xs text-subtle">{user.email}</p></td><td className="px-4 py-4"><p className="font-medium text-foreground">{role?.name}</p><p className="mt-0.5 text-xs text-muted">{pretty(user.department)}</p></td><td className="px-4 py-4"><p className="font-medium text-foreground">{pretty(user.dataScope)}</p><p className="mt-0.5 text-xs text-muted">{user.manager?.name ?? (role?.key === "SALES_EXECUTIVE" ? "No manager assigned" : role?.portal === "ADMIN" ? "Admin portal" : "Staff portal")}</p></td><td className="px-4 py-4"><Status value={user.status} /></td><td className="px-4 py-4 text-xs text-muted">{lastLogin(user.lastLoginAt)}</td><td className="px-5 py-4"><div className="flex justify-end"><StaffActions user={user} busy={busy} onEdit={onEdit} onPassword={onPassword} onStatus={onStatus} onDelete={onDelete} /></div></td></tr>;
}

function StaffCard({ user, busy, onEdit, onPassword, onStatus, onDelete }: StaffActionsProps) {
  const role = user.roles[0];
  return <article className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{user.name}</p><p className="mt-1 truncate text-xs text-muted">{user.profile?.employeeCode ? `${user.profile.employeeCode} · ` : ""}{user.loginId}</p><p className="mt-1 truncate text-xs text-subtle">{user.email}</p></div><Status value={user.status} /></div><dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-3 text-xs"><div><dt className="text-muted">Role</dt><dd className="mt-1 font-medium text-foreground">{role?.name}</dd></div><div><dt className="text-muted">Department</dt><dd className="mt-1 font-medium text-foreground">{pretty(user.department)}</dd></div><div><dt className="text-muted">Record access</dt><dd className="mt-1 font-medium text-foreground">{pretty(user.dataScope)}</dd></div><div><dt className="text-muted">Manager</dt><dd className="mt-1 font-medium text-foreground">{user.manager?.name ?? "—"}</dd></div></dl><div className="mt-3 flex justify-end"><StaffActions user={user} busy={busy} onEdit={onEdit} onPassword={onPassword} onStatus={onStatus} onDelete={onDelete} /></div></article>;
}

function StaffActions({ user, busy, onEdit, onPassword, onStatus, onDelete }: StaffActionsProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const run = (action: () => void) => { setOpen(false); action(); };
  return <div className="relative" ref={root}><button type="button" disabled={busy} onClick={() => setOpen((value) => !value)} className="grid size-11 place-items-center rounded-lg border bg-white text-muted shadow-[0_2px_6px_rgba(15,23,42,0.05)] transition-colors hover:border-brand/25 hover:bg-brand-soft hover:text-brand disabled:opacity-50 xl:size-9" aria-label={busy ? "Saving staff account" : `Open actions for ${user.name}`} aria-expanded={open}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <MoreHorizontal size={17} />}</button>{open && <div className="absolute bottom-12 right-0 z-50 w-44 overflow-hidden rounded-lg border bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)]"><MenuAction icon={Pencil} label="Edit details" onClick={() => run(onEdit)} /><MenuAction icon={KeyRound} label="Update password" onClick={() => run(onPassword)} /><MenuAction icon={user.status === "ACTIVE" ? UserX : UserCheck} label={user.status === "ACTIVE" ? "Deactivate" : "Activate"} onClick={() => run(onStatus)} /><div className="my-1 border-t" /><MenuAction icon={Trash2} label="Delete account" danger onClick={() => run(onDelete)} /></div>}</div>;
}

function MenuAction({ icon: Icon, label, danger = false, onClick }: { icon: typeof Pencil; label: string; danger?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-xs font-medium transition-colors ${danger ? "text-danger hover:bg-red-50" : "text-muted hover:bg-background hover:text-foreground"}`}><Icon size={15} />{label}</button>;
}

function StaffEditor({ mode, user, roles, managers, onClose, onSaved }: { mode: "create" | "edit"; user?: StaffUser; roles: Role[]; managers: StaffUser[]; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const profile = user?.profile;
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    mobile: profile?.mobile ?? "",
    jobTitle: profile?.jobTitle ?? "",
    employmentType: profile?.employmentType ?? "FULL_TIME",
    joiningDate: profile?.joiningDate?.slice(0, 10) ?? today,
    dateOfBirth: profile?.dateOfBirth?.slice(0, 10) ?? "",
    shiftStart: profile?.shiftStart ?? "10:00",
    shiftEnd: profile?.shiftEnd ?? "19:00",
    bloodGroup: profile?.bloodGroup ?? "",
    workLocation: profile?.workLocation ?? "Vadodara",
    residentialAddress: profile?.residentialAddress ?? "",
    emergencyContactName: profile?.emergencyContactName ?? "",
    emergencyContactMobile: profile?.emergencyContactMobile ?? "",
    roleKey: user?.roles[0]?.key ?? roles[0]?.key ?? "",
    managerId: user?.managerId ?? "",
    status: user?.status ?? "ACTIVE",
    password: "",
  });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const role = roles.find((item) => item.key === form.roleKey);
  const set = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = {
        name: form.name,
        email: form.email,
        mobile: form.mobile,
        jobTitle: form.jobTitle,
        employmentType: form.employmentType,
        joiningDate: form.joiningDate,
        dateOfBirth: form.dateOfBirth || null,
        shiftStart: form.shiftStart || null,
        shiftEnd: form.shiftEnd || null,
        bloodGroup: form.bloodGroup || null,
        workLocation: form.workLocation || null,
        residentialAddress: form.residentialAddress || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactMobile: form.emergencyContactMobile || null,
        roleKey: form.roleKey,
        managerId: form.roleKey === "SALES_EXECUTIVE" ? form.managerId || null : null,
        ...(mode === "create" ? { password: form.password } : { status: form.status }),
      };
      const response = await fetch(mode === "create" ? "/api/staff" : `/api/staff/${user?.id}`, { method: mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, `Unable to ${mode === "create" ? "create" : "update"} staff account.`));
      const saved = data as StaffUser;
      await onSaved(mode === "create" ? `${form.name} was added as ${saved.profile?.employeeCode ?? saved.loginId}.` : `${form.name} was updated successfully.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save staff account."); setSaving(false); }
  };
  const selectClass = "h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10";
  return <Modal wide title={mode === "create" ? "Add staff" : "Edit staff details"} subtitle="Create one reusable employee record with controlled portal access." onClose={onClose}>
    <form onSubmit={submit} className="space-y-6">
      {mode === "create" ? <div className="rounded-lg border border-brand/15 bg-brand-soft/50 px-4 py-3"><p className="text-xs font-semibold text-foreground">Employee code and Login ID are generated automatically</p><p className="mt-1 text-xs text-muted">They will be shown after the staff account is created.</p></div> : <div className="grid gap-4 rounded-lg border bg-background p-4 sm:grid-cols-2"><Field label="Employee code"><Input value={profile?.employeeCode ?? "Generated when saved"} readOnly className="bg-white text-muted" /></Field><Field label="Login ID"><Input value={user?.loginId ?? ""} readOnly className="bg-white text-muted" /></Field></div>}

      <section className="space-y-4"><SectionHeading title="Contact details" /><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name *"><Input value={form.name} onChange={set("name")} minLength={2} maxLength={120} required /></Field><Field label="Mobile *"><Input value={form.mobile} onChange={set("mobile")} type="tel" inputMode="tel" minLength={7} maxLength={20} required /></Field><Field label="Email *"><Input value={form.email} onChange={set("email")} type="email" maxLength={254} required autoComplete="off" /></Field><Field label="Job title *"><Input value={form.jobTitle} onChange={set("jobTitle")} placeholder="e.g. Event Operations Manager" minLength={2} maxLength={120} required /></Field></div></section>

      <section className="space-y-4"><SectionHeading title="Employment" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Role *"><select value={form.roleKey} onChange={set("roleKey")} className={selectClass} required>{roles.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></Field><Field label="Department"><Input value={pretty(role?.department)} readOnly className="bg-background text-muted" /></Field><Field label="Employment type"><select value={form.employmentType} onChange={set("employmentType")} className={selectClass}><option value="FULL_TIME">Full Time</option><option value="PART_TIME">Part Time</option><option value="CONTRACT">Contract</option><option value="INTERN">Intern</option></select></Field><Field label="Joining date *"><Input value={form.joiningDate} onChange={set("joiningDate")} type="date" required /></Field><Field label="Shift start"><Input value={form.shiftStart} onChange={set("shiftStart")} type="time" /></Field><Field label="Shift end"><Input value={form.shiftEnd} onChange={set("shiftEnd")} type="time" /></Field><Field label="Work location"><Input value={form.workLocation} onChange={set("workLocation")} maxLength={120} /></Field>{form.roleKey === "SALES_EXECUTIVE" && <Field label="Sales Manager"><select value={form.managerId} onChange={set("managerId")} className={selectClass}><option value="">Not assigned</option>{managers.filter((manager) => manager.id !== user?.id).map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select></Field>}{mode === "edit" && <Field label="Account status"><select value={form.status} onChange={set("status")} className={selectClass}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="LOCKED">Locked</option></select></Field>}</div>{role && <div className="grid grid-cols-3 gap-2 rounded-lg border bg-background p-3 text-xs"><div><p className="text-muted">Portal</p><p className="mt-1 font-semibold text-foreground">{pretty(role.portal)}</p></div><div><p className="text-muted">Department</p><p className="mt-1 font-semibold text-foreground">{pretty(role.department)}</p></div><div><p className="text-muted">Record access</p><p className="mt-1 font-semibold text-foreground">{pretty(role.dataScope)}</p></div></div>}</section>

      <section className="space-y-4"><SectionHeading title="Personal and emergency" optional /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Date of birth"><Input value={form.dateOfBirth} onChange={set("dateOfBirth")} type="date" max={today} /></Field><Field label="Blood group"><select value={form.bloodGroup} onChange={set("bloodGroup")} className={selectClass}><option value="">Select blood group</option><option value="A_POSITIVE">A+</option><option value="A_NEGATIVE">A-</option><option value="B_POSITIVE">B+</option><option value="B_NEGATIVE">B-</option><option value="AB_POSITIVE">AB+</option><option value="AB_NEGATIVE">AB-</option><option value="O_POSITIVE">O+</option><option value="O_NEGATIVE">O-</option></select></Field><Field label="Emergency contact name"><Input value={form.emergencyContactName} onChange={set("emergencyContactName")} maxLength={120} /></Field><Field label="Emergency contact mobile"><Input value={form.emergencyContactMobile} onChange={set("emergencyContactMobile")} type="tel" inputMode="tel" maxLength={20} /></Field><label className="block space-y-1.5 sm:col-span-2 lg:col-span-3"><span className="text-xs font-medium text-foreground">Residential address</span><textarea value={form.residentialAddress} onChange={set("residentialAddress")} maxLength={500} rows={3} className="w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></label></div></section>

      {mode === "create" && <section className="space-y-4"><SectionHeading title="Account security" /><div className="grid gap-4 sm:grid-cols-2"><Field label="Password set by administrator *"><Input value={form.password} onChange={set("password")} type="password" minLength={8} maxLength={128} required autoComplete="new-password" /></Field><div className="flex items-end"><p className="pb-2 text-xs leading-5 text-muted">Staff cannot change this password. An administrator can update it later.</p></div></div></section>}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}
      <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-white pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Saving…" : mode === "create" ? "Add staff" : "Save changes"}</Button></div>
    </form>
  </Modal>;
}

function SectionHeading({ title, optional = false }: { title: string; optional?: boolean }) {
  return <div className="flex items-center justify-between border-b pb-2"><h3 className="text-sm font-semibold text-foreground">{title}</h3>{optional && <span className="text-[11px] text-subtle">Optional</span>}</div>;
}

function PasswordEditor({ user, onClose, onSaved }: { user: StaffUser; onClose: () => void; onSaved: (message: string) => void }) {
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); if (password !== confirm) { setError("Passwords do not match."); return; } setSaving(true); setError(""); try { const response = await fetch(`/api/staff/${user.id}/password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(data, "Unable to update password.")); onSaved(`${user.name}'s password was updated. Existing sessions were signed out.`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update password."); setSaving(false); } };
  return <Modal title="Update staff password" subtitle={`Set a new administrator-controlled password for ${user.name}.`} onClose={onClose}><form onSubmit={submit} className="space-y-4"><Field label="New password"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" /></Field><Field label="Confirm password"><Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} required autoComplete="new-password" /></Field><p className="text-xs leading-5 text-muted">Updating the password will sign this account out from every active session.</p>{error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}<div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Updating…" : "Update password"}</Button></div></form></Modal>;
}

function DeleteEditor({ user, onClose, onDeleted }: { user: StaffUser; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false); const [error, setError] = useState("");
  const remove = async () => {
    setDeleting(true); setError("");
    try {
      const response = await fetch(`/api/staff/${user.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to delete staff account."));
      await onDeleted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete staff account."); setDeleting(false); }
  };
  return <Modal title="Delete staff account" subtitle="This action permanently removes the account and its active sessions." onClose={onClose}><div className="rounded-lg border border-red-100 bg-red-50 p-4"><p className="text-sm font-semibold text-foreground">{user.name}</p><p className="mt-1 text-xs text-muted">{user.loginId} · {user.email}</p></div><p className="mt-4 text-xs leading-5 text-muted">Use Deactivate if this person may need access again. Delete only when this account is no longer required.</p>{error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}<div className="mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><button type="button" disabled={deleting} onClick={remove} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-danger px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50 sm:h-10">{deleting && <LoaderCircle className="animate-spin" size={16} />} {deleting ? "Deleting…" : "Delete account"}</button></div></Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">{label}</span>{children}</label>; }

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0f172a]/40 p-3 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label={title}><div className={`my-auto flex max-h-[calc(100dvh-24px)] w-full flex-col rounded-xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-32px)] ${wide ? "max-w-4xl" : "max-w-xl"}`}><div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4"><div><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="mt-1 text-xs text-muted">{subtitle}</p></div><button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={17} /></button></div><div className="overflow-y-auto p-4 sm:p-5">{children}</div></div></div>;
}
