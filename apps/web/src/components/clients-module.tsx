"use client";

import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Client = {
  id: string;
  salonName: string;
  category: string;
  status: string;
  ownerName: string | null;
  managerName: string | null;
  primaryContact: string;
  whatsappNumber: string | null;
  email: string | null;
  area: string | null;
  city: string;
  potential: string | null;
  overallRating: number | null;
  assignedSalesperson: { id: string; name: string } | null;
  updatedAt: string;
  version: number;
};
export type ClientListResponse = {
  items: Client[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const pretty = (value?: string | null) =>
  value
    ? value
        .toLowerCase()
        .split("_")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ")
    : "Not set";
const messageFrom = (data: unknown, fallback: string) =>
  data && typeof data === "object" && "message" in data
    ? Array.isArray((data as { message: unknown }).message)
      ? (data as { message: string[] }).message.join(" ")
      : String((data as { message: unknown }).message)
    : fallback;

export function ClientsModule({
  initial,
}: {
  initial: ClientListResponse | null;
}) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    initial ? "" : "Unable to load clients. Please try again.",
  );
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setHeaderSlot(document.getElementById("page-header-actions")),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "20",
        });
        if (search.trim()) params.set("search", search.trim());
        if (status) params.set("status", status);
        if (category) params.set("category", category);
        const response = await fetch(`/api/clients?${params}`, {
          cache: "no-store",
        });
        const json = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(messageFrom(json, "Unable to load clients."));
        setData(json as ClientListResponse);
        setError("");
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to load clients.",
        );
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [page, search, status, category]);
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setCategory("");
    setPage(1);
  };
  return (
    <>
      {headerSlot &&
        createPortal(
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            <span className="hidden sm:inline">Add client</span>
            <span className="sr-only sm:hidden">Add client</span>
          </Button>,
          headerSlot,
        )}
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
          <label className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
              size={17}
            />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search salon, owner, phone or city"
              aria-label="Search clients"
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="PROSPECT">Prospect</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            <option value="SALON">Salon</option>
            <option value="SPA">Spa</option>
            <option value="STUDIO">Studio</option>
            <option value="ACADEMY">Academy</option>
          </select>
          {(search || status || category) && (
            <Button variant="secondary" onClick={clearFilters}>
              <X size={15} />
              Clear
            </Button>
          )}
        </div>
        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger"
            role="alert"
          >
            {error}
          </div>
        )}
        <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Assigned salons
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {data?.total ?? 0} relationship{data?.total === 1 ? "" : "s"}
              </p>
            </div>
            <Filter size={17} className="text-subtle" />
          </div>
          {loading && !data ? (
            <div className="space-y-3 p-4">
              <div className="h-20 animate-pulse rounded-lg bg-background" />
              <div className="h-20 animate-pulse rounded-lg bg-background" />
            </div>
          ) : data?.items.length ? (
            <>
              <div className="hidden xl:block">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b bg-background text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                    <tr>
                      <th className="px-5 py-3">Salon</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Potential</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.items.map((client) => (
                      <tr
                        key={client.id}
                        className="transition-colors hover:bg-brand-soft/40"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/dashboard/clients/${client.id}`}
                            className="font-semibold text-foreground hover:text-brand"
                          >
                            {client.salonName}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted">
                            {pretty(client.category)}
                            {client.ownerName ? ` · ${client.ownerName}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-muted">
                          {client.primaryContact}
                        </td>
                        <td className="px-4 py-4 text-muted">
                          {[client.area, client.city]
                            .filter(Boolean)
                            .join(", ")}
                        </td>
                        <td className="px-4 py-4">
                          {client.potential ? (
                            <span className="font-medium text-foreground">
                              {pretty(client.potential)}
                            </span>
                          ) : (
                            <span className="text-subtle">Not set</span>
                          )}
                          {client.overallRating ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted">
                              <Star
                                size={12}
                                className="fill-warning text-warning"
                              />
                              {client.overallRating}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <Status value={client.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            className="text-xs font-semibold text-brand hover:text-brand-dark"
                            href={`/dashboard/clients/${client.id}`}
                          >
                            Salon 360{" "}
                            <ChevronRight className="inline" size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y xl:hidden">
                {data.items.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            </>
          ) : (
            <EmptyClients onAdd={() => setFormOpen(true)} />
          )}
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted">
                Page {data.page} of{" "}
                {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="h-9 px-3"
                  disabled={data.page <= 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft size={15} />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  className="h-9 px-3"
                  disabled={!data.hasMore || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
      {formOpen && (
        <ClientForm
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            setPage(1);
            const response = await fetch("/api/clients?page=1&pageSize=20", {
              cache: "no-store",
            });
            if (response.ok)
              setData((await response.json()) as ClientListResponse);
          }}
        />
      )}
    </>
  );
}

function ClientCard({ client }: { client: Client }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/clients/${client.id}`}
            className="block truncate text-sm font-semibold text-foreground hover:text-brand"
          >
            {client.salonName}
          </Link>
          <p className="mt-1 text-xs text-muted">
            {pretty(client.category)}
            {client.ownerName ? ` · ${client.ownerName}` : ""}
          </p>
        </div>
        <Status value={client.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-3 text-xs">
        <div>
          <p className="text-muted">Contact</p>
          <a
            className="mt-1 block font-medium text-foreground"
            href={`tel:${client.primaryContact}`}
          >
            {client.primaryContact}
          </a>
        </div>
        <div>
          <p className="text-muted">Location</p>
          <p className="mt-1 font-medium text-foreground">
            {[client.area, client.city].filter(Boolean).join(", ") || "Not set"}
          </p>
        </div>
        <div>
          <p className="text-muted">Potential</p>
          <p className="mt-1 font-medium text-foreground">
            {pretty(client.potential)}
          </p>
        </div>
        <div>
          <p className="text-muted">Rating</p>
          <p className="mt-1 inline-flex items-center gap-1 font-medium text-foreground">
            {client.overallRating ? (
              <>
                <Star size={13} className="fill-warning text-warning" />
                {client.overallRating}/5
              </>
            ) : (
              "Not set"
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <a
          href={`tel:${client.primaryContact}`}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-semibold text-foreground"
        >
          <Phone size={14} />
          Call
        </a>
        {client.whatsappNumber && (
          <a
            href={`https://wa.me/${client.whatsappNumber.replace(/\D/g, "")}`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-semibold text-foreground"
          >
            <MessageCircle size={14} />
            WhatsApp
          </a>
        )}
        <Link
          href={`/dashboard/clients/${client.id}`}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand text-xs font-semibold text-white"
        >
          Open
        </Link>
      </div>
    </article>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${value === "ACTIVE" ? "bg-success-soft text-success" : value === "INACTIVE" ? "bg-gray-100 text-muted" : "bg-warning-soft text-warning"}`}
    >
      {pretty(value)}
    </span>
  );
}
function EmptyClients({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-5 py-14 text-center">
      <Building2 className="mx-auto text-subtle" size={28} />
      <p className="mt-3 text-sm font-semibold text-foreground">
        No salons assigned yet
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
        Add your first client relationship and Salon 360 will keep visits,
        follow-ups and notes together.
      </p>
      <Button className="mt-5" onClick={onAdd}>
        <Plus size={15} />
        Add client
      </Button>
    </div>
  );
}

type FormState = {
  salonName: string;
  billingName: string;
  gstin: string;
  state: string;
  stateCode: string;
  category: string;
  status: string;
  ownerName: string;
  managerName: string;
  primaryContact: string;
  whatsappNumber: string;
  email: string;
  keyProfessional: string;
  fullAddress: string;
  area: string;
  city: string;
  pincode: string;
  googleMapsUrl: string;
  latitude: string;
  longitude: string;
  chairCount: string;
  staffCount: string;
  stylistCount: string;
  approximateDailyCustomers: string;
  potential: string;
  customerSegment: string;
  estimatedMonthlyBusiness: string;
  purchasingFrequency: string;
  businessPotentialRating: string;
  relationshipRating: string;
  paymentBehaviourRating: string;
  productOpportunityRating: string;
  overallRating: string;
};
const initialForm: FormState = {
  salonName: "",
  billingName: "",
  gstin: "",
  state: "",
  stateCode: "",
  category: "SALON",
  status: "PROSPECT",
  ownerName: "",
  managerName: "",
  primaryContact: "",
  whatsappNumber: "",
  email: "",
  keyProfessional: "",
  fullAddress: "",
  area: "",
  city: "",
  pincode: "",
  googleMapsUrl: "",
  latitude: "",
  longitude: "",
  chairCount: "",
  staffCount: "",
  stylistCount: "",
  approximateDailyCustomers: "",
  potential: "",
  customerSegment: "",
  estimatedMonthlyBusiness: "",
  purchasingFrequency: "",
  businessPotentialRating: "",
  relationshipRating: "",
  paymentBehaviourRating: "",
  productOpportunityRating: "",
  overallRating: "",
};
function ClientForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update =
    (key: keyof FormState) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((value) => ({ ...value, [key]: event.target.value }));
  const steps = ["Basic", "Contact", "Location", "Business"];
  const next = (event: FormEvent) => {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    void submit();
  };
  const submit = async () => {
    setSaving(true);
    setError("");
    const numeric = [
      "chairCount",
      "staffCount",
      "stylistCount",
      "approximateDailyCustomers",
      "businessPotentialRating",
      "relationshipRating",
      "paymentBehaviourRating",
      "productOpportunityRating",
      "overallRating",
    ];
    const payload: Record<string, unknown> = {
      ...form,
      googleMapsUrl: form.googleMapsUrl || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      estimatedMonthlyBusiness: form.estimatedMonthlyBusiness
        ? Number(form.estimatedMonthlyBusiness)
        : undefined,
    };
    numeric.forEach((key) => {
      payload[key] = form[key as keyof FormState]
        ? Number(form[key as keyof FormState])
        : undefined;
    });
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(messageFrom(data, "Unable to save client."));
      await onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save client.",
      );
      setSaving(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-[1px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Add client"
    >
      <div className="my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col rounded-xl border bg-white shadow-[0_20px_48px_rgba(26,31,26,0.18)] sm:max-h-[calc(100dvh-48px)]">
        <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Add client
            </h2>
            <p className="mt-1 text-xs text-muted">
              Create a client record in four quick steps
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-background sm:size-8"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="border-b px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            {steps.map((label, index) => (
              <div
                key={label}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${index <= step ? "bg-brand text-white" : "bg-background text-muted"}`}
                >
                  {index + 1}
                </span>
                <span
                  className={`hidden truncate text-xs font-semibold sm:block ${index === step ? "text-foreground" : "text-muted"}`}
                >
                  {label}
                </span>
                {index < steps.length - 1 && (
                  <span
                    className={`h-px flex-1 ${index < step ? "bg-brand" : "bg-border"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={next} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {step === 0 && (
              <section className="space-y-4">
                <Field label="Salon name *">
                  <Input
                    value={form.salonName}
                    onChange={update("salonName")}
                    required
                    minLength={2}
                    maxLength={160}
                    autoFocus
                  />
                </Field>
                <Field label="Category *">
                  <Select
                    value={form.category}
                    onChange={update("category")}
                    options={[
                      ["SALON", "Salon"],
                      ["SPA", "Spa"],
                      ["STUDIO", "Studio"],
                      ["ACADEMY", "Academy"],
                    ]}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={form.status}
                    onChange={update("status")}
                    options={[
                      ["PROSPECT", "Prospect"],
                      ["ACTIVE", "Active"],
                      ["INACTIVE", "Inactive"],
                    ]}
                  />
                </Field>
              </section>
            )}
            {step === 1 && (
              <section className="grid gap-4 sm:grid-cols-2">
                <Field label="Owner name">
                  <Input
                    value={form.ownerName}
                    onChange={update("ownerName")}
                  />
                </Field>
                <Field label="Manager name">
                  <Input
                    value={form.managerName}
                    onChange={update("managerName")}
                  />
                </Field>
                <Field label="Primary contact *">
                  <Input
                    value={form.primaryContact}
                    onChange={update("primaryContact")}
                    required
                    type="tel"
                    inputMode="tel"
                    minLength={7}
                  />
                </Field>
                <Field label="WhatsApp number">
                  <Input
                    value={form.whatsappNumber}
                    onChange={update("whatsappNumber")}
                    type="tel"
                    inputMode="tel"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    value={form.email}
                    onChange={update("email")}
                    type="email"
                  />
                </Field>
                <Field label="Key professional">
                  <Input
                    value={form.keyProfessional}
                    onChange={update("keyProfessional")}
                  />
                </Field>
              </section>
            )}
            {step === 2 && (
              <section className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-foreground">
                    Full address
                  </span>
                  <textarea
                    value={form.fullAddress}
                    onChange={update("fullAddress")}
                    rows={3}
                    className="w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                  />
                </label>
                <Field label="Billing name">
                  <Input value={form.billingName} onChange={update("billingName")} placeholder="If different from salon name" />
                </Field>
                <Field label="GSTIN">
                  <Input value={form.gstin} onChange={update("gstin")} maxLength={30} />
                </Field>
                <Field label="Area / locality">
                  <Input value={form.area} onChange={update("area")} />
                </Field>
                <Field label="City *">
                  <Input value={form.city} onChange={update("city")} required />
                </Field>
                <Field label="State">
                  <Input value={form.state} onChange={update("state")} />
                </Field>
                <Field label="GST state code">
                  <Input value={form.stateCode} onChange={update("stateCode")} maxLength={5} inputMode="numeric" />
                </Field>
                <Field label="Pincode">
                  <Input
                    value={form.pincode}
                    onChange={update("pincode")}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Google Maps link (optional)">
                  <Input
                    value={form.googleMapsUrl}
                    onChange={update("googleMapsUrl")}
                    type="url"
                    placeholder="Add a maps link if available"
                  />
                </Field>
                <Field label="Latitude (optional)">
                  <Input value={form.latitude} onChange={update("latitude")} type="number" inputMode="decimal" min="-90" max="90" step="any" placeholder="22.3072" />
                </Field>
                <Field label="Longitude (optional)">
                  <Input value={form.longitude} onChange={update("longitude")} type="number" inputMode="decimal" min="-180" max="180" step="any" placeholder="73.1812" />
                </Field>
              </section>
            )}
            {step === 3 && (
              <section className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Potential">
                    <Select
                      value={form.potential}
                      onChange={update("potential")}
                      options={[
                        ["", "Select potential"],
                        ["HIGH", "High"],
                        ["MEDIUM", "Medium"],
                        ["LOW", "Low"],
                      ]}
                    />
                  </Field>
                  <Field label="Customer segment">
                    <Select
                      value={form.customerSegment}
                      onChange={update("customerSegment")}
                      options={[
                        ["", "Select segment"],
                        ["PREMIUM", "Premium"],
                        ["MID", "Mid"],
                        ["VALUE", "Value"],
                      ]}
                    />
                  </Field>
                  <Field label="Estimated monthly business">
                    <Input
                      value={form.estimatedMonthlyBusiness}
                      onChange={update("estimatedMonthlyBusiness")}
                      type="number"
                      min="0"
                      inputMode="decimal"
                      placeholder="₹"
                    />
                  </Field>
                  <Field label="Purchasing frequency">
                    <Input
                      value={form.purchasingFrequency}
                      onChange={update("purchasingFrequency")}
                      placeholder="e.g. Monthly"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Field label="Chairs">
                    <Input
                      value={form.chairCount}
                      onChange={update("chairCount")}
                      type="number"
                      min="0"
                    />
                  </Field>
                  <Field label="Staff">
                    <Input
                      value={form.staffCount}
                      onChange={update("staffCount")}
                      type="number"
                      min="0"
                    />
                  </Field>
                  <Field label="Stylists">
                    <Input
                      value={form.stylistCount}
                      onChange={update("stylistCount")}
                      type="number"
                      min="0"
                    />
                  </Field>
                  <Field label="Daily customers">
                    <Input
                      value={form.approximateDailyCustomers}
                      onChange={update("approximateDailyCustomers")}
                      type="number"
                      min="0"
                    />
                  </Field>
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold text-foreground">
                    Ratings{" "}
                    <span className="font-normal text-muted">
                      (optional, 1–5)
                    </span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["businessPotentialRating", "Business potential"],
                      ["relationshipRating", "Relationship"],
                      ["paymentBehaviourRating", "Payment behaviour"],
                      ["productOpportunityRating", "Product opportunity"],
                      ["overallRating", "Overall salon"],
                    ].map(([key, label]) => (
                      <Field key={key} label={label}>
                        <Rating
                          value={form[key as keyof FormState]}
                          onChange={(value) =>
                            setForm((current) => ({ ...current, [key]: value }))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </div>
                <p className="rounded-lg border border-brand/15 bg-brand-soft/50 px-3 py-2.5 text-xs leading-5 text-muted">
                  Your account is assigned automatically. Admins can adjust
                  salesperson, trainer, territory and distributor assignment
                  later.
                </p>
              </section>
            )}
            {error && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
          <div className="sticky bottom-0 flex gap-2 border-t bg-white p-4 sm:justify-end sm:px-5">
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep((value) => value - 1)}
              >
                <ChevronLeft size={16} />
                Back
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : step === steps.length - 1
                  ? "Save client"
                  : "Continue"}
              {step < steps.length - 1 && <ChevronRight size={16} />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: string[][];
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10"
    >
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
function Rating({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(String(star))}
          className="grid size-8 place-items-center rounded-md hover:bg-warning-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
          aria-label={`${star} stars`}
        >
          <Star
            size={17}
            className={
              Number(value) >= star
                ? "fill-warning text-warning"
                : "text-subtle"
            }
          />
        </button>
      ))}
    </div>
  );
}
