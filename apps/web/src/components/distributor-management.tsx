"use client";

import { Check, KeyRound, LoaderCircle, Plus, Search, Truck, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { FormActions } from "@/components/ui/form-actions";
import { SuccessToast } from "@/components/ui/toast";

type Distributor = {
  id: string;
  partnerType: "SUPER_STOCKIST" | "DISTRIBUTOR";
  parentId: string | null;
  parent: { id: string; businessName: string } | null;
  _count: { children: number };
  businessName: string;
  contactName: string;
  phone: string | null;
  email: string | null;
  territory: string | null;
  creditLimit: string | null;
  status: "ONBOARDING" | "ACTIVE" | "INACTIVE";
  notes: string | null;
  assignedSalesperson: { id: string; name: string } | null;
};
type DistributorUser = { id: string; loginId: string; email: string; name: string; status: string; lastLoginAt: string | null; createdAt: string; roleKey: string | null; roleName: string | null };
const DISTRIBUTOR_ROLE_OPTIONS = [
  { value: "DISTRIBUTOR_OWNER", label: "Owner – full access" },
  { value: "DISTRIBUTOR_ACCOUNTS", label: "Accounts – review, approve, bill" },
  { value: "DISTRIBUTOR_WAREHOUSE", label: "Warehouse – fulfill only" },
];
type ReplenishmentItem = { id: string; quantity: number; product: { name: string; unit: string } };
export type ReplenishmentRequest = {
  id: string;
  requestNumber: string;
  status: "REQUESTED" | "APPROVED" | "PICKING" | "PACKED" | "DISPATCHED" | "RECEIVED" | "PARTIALLY_RECEIVED" | "FULFILLED" | "REJECTED";
  notes: string | null;
  createdAt: string;
  distributor: { id: string; businessName: string };
  sourceDistributor: { id: string; businessName: string } | null;
  requestedBy: { id: string; name: string };
  invoiceReference: string | null;
  items: ReplenishmentItem[];
};

const messageFrom = (data: unknown, fallback: string) => (data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback);
const STATUS_TONE: Record<string, string> = { ONBOARDING: "bg-warning-soft text-warning", ACTIVE: "bg-success-soft text-success", INACTIVE: "bg-gray-100 text-muted", REQUESTED: "bg-warning-soft text-warning", APPROVED: "bg-brand-soft text-brand", PICKING: "bg-brand-soft text-brand", PACKED: "bg-brand-soft text-brand", DISPATCHED: "bg-brand-soft text-brand", RECEIVED: "bg-success-soft text-success", PARTIALLY_RECEIVED: "bg-warning-soft text-warning", FULFILLED: "bg-success-soft text-success", REJECTED: "bg-red-50 text-danger" };
const StatusBadge = ({ value }: { value: string }) => <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[value] ?? "bg-gray-100 text-muted"}`}>{value.charAt(0) + value.slice(1).toLowerCase()}</span>;

export function DistributorManagement({ initialDistributors, initialRequests }: { initialDistributors: Distributor[]; initialRequests: ReplenishmentRequest[] }) {
  const [distributors, setDistributors] = useState(initialDistributors);
  const [requests, setRequests] = useState(initialRequests);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; distributor?: Distributor } | null>(null);
  const [loginsFor, setLoginsFor] = useState<Distributor | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const syncHeaderSlot = () => setHeaderSlot(document.getElementById("page-header-actions"));
    syncHeaderSlot();
    const frame = requestAnimationFrame(syncHeaderSlot);
    return () => cancelAnimationFrame(frame);
  }, []);

  const reloadDistributors = async () => {
    const response = await fetch("/api/distributors", { cache: "no-store" });
    if (response.ok) setDistributors(await response.json());
  };
  const reloadRequests = async () => {
    const response = await fetch("/api/replenishment", { cache: "no-store" });
    if (response.ok) setRequests(await response.json());
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return distributors.filter((distributor) => !term || `${distributor.businessName} ${distributor.contactName} ${distributor.territory ?? ""}`.toLowerCase().includes(term));
  }, [distributors, search]);

  const pendingRequests = requests.filter((request) => request.status === "REQUESTED" || request.status === "APPROVED");

  const review = async (request: ReplenishmentRequest, action: "approve" | "reject" | "pick" | "pack" | "fulfill") => {
    setBusyId(request.id);
    setError("");
    try {
      const response = await fetch(`/api/replenishment/${request.id}/${action}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to update this request."));
      await reloadRequests();
      setNotice(`${request.requestNumber} updated.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this request.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
      {headerSlot && createPortal(<Button onClick={() => setEditor({ mode: "create" })}><Plus size={16} /><span className="hidden sm:inline">Add partner</span><span className="sr-only sm:hidden">Add partner</span></Button>, headerSlot)}

      <div className="space-y-5">
        <KpiStrip columns={3}>
          <KpiCell label="Super Stockists" value={distributors.filter((d) => d.partnerType === "SUPER_STOCKIST").length} />
          <KpiCell label="Active" value={distributors.filter((d) => d.status === "ACTIVE").length} tone="success" />
          <KpiCell label="Replenishment pending" value={pendingRequests.length} tone={pendingRequests.length ? "warning" : "neutral"} />
        </KpiStrip>

        {error && <FormError message={error} />}

        <section className="crm-surface">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search distributors" aria-label="Search distributors" />
            </label>
          </div>
          <div className="overflow-hidden">
            {filtered.length ? (
              <div className="divide-y">{filtered.map((distributor) => (
                <div key={distributor.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">{distributor.businessName}</p><span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted">{distributor.partnerType === "SUPER_STOCKIST" ? "Super Stockist" : "Distributor"}</span><StatusBadge value={distributor.status} /></div>
                    <p className="mt-0.5 text-xs text-muted">{distributor.contactName} · {distributor.territory ?? "No territory set"} · {distributor.partnerType === "SUPER_STOCKIST" ? `${distributor._count.children} assigned distributors` : distributor.parent?.businessName ?? "No Super Stockist assigned"}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" onClick={() => setLoginsFor(distributor)}><KeyRound size={14} />Logins</Button>
                    <Button variant="secondary" onClick={() => setEditor({ mode: "edit", distributor })}>Edit</Button>
                  </div>
                </div>
              ))}</div>
            ) : (
              <div className="px-5 py-14 text-center"><Truck className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No distributors yet</p><p className="mt-1 text-xs text-muted">Add a regional distributor to start routing orders to them.</p></div>
            )}
          </div>
        </section>

        <section className="crm-surface">
          <div className="rounded-t-xl border-b px-5 py-4"><h2 className="text-sm font-semibold text-foreground">Mother Depot replenishment</h2><p className="mt-0.5 text-xs text-muted">Accept, prepare, invoice and dispatch Super Stockist requests</p></div>
          <div className="overflow-hidden rounded-b-xl">
            {requests.length ? (
              <div className="divide-y">{requests.map((request) => (
                <article key={request.id} className="p-4 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{request.requestNumber}</p><StatusBadge value={request.status} /></div>
                    <p className="text-xs text-muted">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(request.createdAt))}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">{request.sourceDistributor?.businessName ?? "Mother Depot"} → {request.distributor.businessName} · Requested by {request.requestedBy.name}</p>
                  <p className="mt-1.5 text-xs text-muted">{request.items.map((item) => `${item.product.name} × ${item.quantity}`).join(" · ")}</p>
                  {request.notes && <p className="mt-1 text-xs italic text-subtle">&quot;{request.notes}&quot;</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!request.sourceDistributor && request.status === "REQUESTED" && <>
                      <Button disabled={busyId === request.id} onClick={() => review(request, "approve")}><Check size={14} />Accept request</Button>
                      <Button variant="secondary" disabled={busyId === request.id} onClick={() => review(request, "reject")}>Reject</Button>
                    </>}
                    {!request.sourceDistributor && request.status === "APPROVED" && <Button disabled={busyId === request.id} onClick={() => review(request, "pick")}><Truck size={14} />Start picking</Button>}
                    {!request.sourceDistributor && request.status === "PICKING" && <Button disabled={busyId === request.id} onClick={() => review(request, "pack")}><Truck size={14} />Mark packed</Button>}
                    {!request.sourceDistributor && request.status === "PACKED" && <Button disabled={busyId === request.id} onClick={() => review(request, "fulfill")}><Truck size={14} />Generate invoice &amp; dispatch</Button>}
                    {!request.sourceDistributor && request.invoiceReference && <a href={`/api/replenishment/${request.id}/invoice.pdf`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg border bg-white px-3 text-xs font-semibold hover:bg-background">View invoice</a>}
                  </div>
                </article>
              ))}</div>
            ) : (
              <div className="px-5 py-14 text-center"><Truck className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No requests yet</p></div>
            )}
          </div>
        </section>
      </div>

      {editor && <DistributorEditor mode={editor.mode} distributor={editor.distributor} partners={distributors} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await reloadDistributors(); }} />}
      {loginsFor && <DistributorLogins distributor={loginsFor} onClose={() => setLoginsFor(null)} />}
    </>
  );
}

function DistributorEditor({ mode, distributor, partners, onClose, onSaved }: { mode: "create" | "edit"; distributor?: Distributor; partners: Distributor[]; onClose: () => void; onSaved: () => void }) {
  const [partnerType, setPartnerType] = useState<Distributor["partnerType"]>(distributor?.partnerType ?? "DISTRIBUTOR");
  const [parentId, setParentId] = useState(distributor?.parentId ?? "");
  const [businessName, setBusinessName] = useState(distributor?.businessName ?? "");
  const [contactName, setContactName] = useState(distributor?.contactName ?? "");
  const [phone, setPhone] = useState(distributor?.phone ?? "");
  const [email, setEmail] = useState(distributor?.email ?? "");
  const [territory, setTerritory] = useState(distributor?.territory ?? "");
  const [creditLimit, setCreditLimit] = useState(distributor?.creditLimit ?? "");
  const [status, setStatus] = useState(distributor?.status ?? "ONBOARDING");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { partnerType, parentId: partnerType === "DISTRIBUTOR" ? parentId : "", businessName, contactName, phone: phone || undefined, email: email || undefined, territory: territory || undefined, creditLimit: creditLimit ? Number(creditLimit) : undefined, ...(mode === "edit" ? { status } : {}) };
      const response = await fetch(mode === "edit" ? `/api/distributors/${distributor!.id}` : "/api/distributors", { method: mode === "edit" ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to save this distributor."));
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this distributor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={mode === "edit" ? "Edit distribution partner" : "Add distribution partner"} subtitle="Create a Super Stockist or assign a Distributor within the supply hierarchy" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Partner type"><Select value={partnerType} onChange={(value) => { setPartnerType(value as Distributor["partnerType"]); if (value === "SUPER_STOCKIST") setParentId(""); }} options={[{ value: "SUPER_STOCKIST", label: "Super Stockist" }, { value: "DISTRIBUTOR", label: "Distributor / Stockist" }]} /></Field>{partnerType === "DISTRIBUTOR" && <Field label="Assigned Super Stockist"><Select value={parentId} onChange={setParentId} options={[{ value: "", label: "Not assigned" }, ...partners.filter((item) => item.partnerType === "SUPER_STOCKIST" && item.id !== distributor?.id).map((item) => ({ value: item.id, label: item.businessName }))]} /></Field>}</div>
        <Field label="Business name"><Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} required minLength={2} /></Field>
        <Field label="Contact name"><Input value={contactName} onChange={(event) => setContactName(event.target.value)} required minLength={2} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone"><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Territory"><Input value={territory} onChange={(event) => setTerritory(event.target.value)} placeholder="e.g. Vadodara, Bharuch" /></Field>
          <Field label="Credit limit"><Input type="number" min={0} value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} /></Field>
        </div>
        {mode === "edit" && <Field label="Status"><Select value={status} onChange={(value) => setStatus(value as Distributor["status"])} options={[{ value: "ONBOARDING", label: "Onboarding" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} /></Field>}
        {error && <FormError message={error} />}
        <FormActions saving={saving} onClose={onClose} label={mode === "edit" ? "Save changes" : "Add partner"} />
      </form>
    </Modal>
  );
}

function DistributorLogins({ distributor, onClose }: { distributor: Distributor; onClose: () => void }) {
  const [users, setUsers] = useState<DistributorUser[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState("DISTRIBUTOR_OWNER");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const response = await fetch(`/api/distributors/${distributor.id}/users`, { cache: "no-store" });
    if (response.ok) setUsers(await response.json());
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot load of this distributor's logins on open, not derived state
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const response = await fetch(`/api/distributors/${distributor.id}/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password, roleKey }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to create this login."));
      setName(""); setEmail(""); setPassword(""); setRoleKey("DISTRIBUTOR_OWNER");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create this login.");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (user: DistributorUser) => {
    setBusyId(user.id);
    setError("");
    try {
      const status = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const response = await fetch(`/api/distributors/${distributor.id}/users/${user.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to update this login."));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this login.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <Modal title={`${distributor.businessName} logins`} subtitle="Portal access for this distributor's staff" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-5">
        <form className="space-y-3 rounded-lg border bg-background p-3.5" onSubmit={createUser}>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><UserPlus size={14} />Add a login</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required minLength={2} />
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
          </div>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password (min. 8 characters)" required minLength={8} />
          <Select value={roleKey} onChange={setRoleKey} options={DISTRIBUTOR_ROLE_OPTIONS} />
          {error && <FormError message={error} />}
          <Button className="w-full" type="submit" disabled={creating}>{creating ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}{creating ? "Creating…" : "Create login"}</Button>
        </form>

        <div className="space-y-2">
          {users === null ? <div className="h-16 animate-pulse rounded-lg bg-background" /> : users.length ? users.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium text-foreground">{user.name}</p>{user.roleName && <span className="inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">{user.roleName}</span>}</div>
                <p className="truncate text-xs text-muted">{user.loginId} · {user.email}</p>
              </div>
              <Button variant="secondary" disabled={busyId === user.id} onClick={() => toggleStatus(user)}>{user.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button>
            </div>
          )) : <p className="px-1 py-4 text-center text-xs text-muted">No logins yet. Create one above.</p>}
        </div>
      </div>
      <div className="mt-5 flex justify-end border-t pt-4"><Button variant="secondary" onClick={onClose}><X size={15} />Close</Button></div>
    </Modal>
  );
}
