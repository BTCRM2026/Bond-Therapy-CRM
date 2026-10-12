"use client";

import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  LoaderCircle,
  MapPin,
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
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { SuccessToast } from "@/components/ui/toast";

type Client = {
  id: string;
  salonName: string;
  category: string;
  clientType: string;
  status: string;
  ownerName: string | null;
  managerName: string | null;
  primaryContact: string;
  whatsappNumber: string | null;
  email: string | null;
  area: string | null;
  city: string;
  state: string | null;
  pincode: string | null;
  fullAddress: string | null;
  headquarter: string | null;
  usedProducts: string | null;
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
  allSalons = false,
}: {
  initial: ClientListResponse | null;
  allSalons?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [clientType, setClientType] = useState("");
  const [category, setCategory] = useState("");
  const [potential, setPotential] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    initial ? "" : "Unable to load clients. Please try again.",
  );
  useEffect(() => {
    const syncHeaderSlot = () =>
      setHeaderSlot(document.getElementById("page-header-actions"));
    syncHeaderSlot();
    const frame = requestAnimationFrame(syncHeaderSlot);
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
        if (clientType) params.set("clientType", clientType);
        if (category) params.set("category", category);
        if (potential) params.set("potential", potential);
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
  }, [page, search, clientType, category, potential]);
  const clearFilters = () => {
    setSearch("");
    setClientType("");
    setCategory("");
    setPotential("");
    setPage(1);
  };
  return (
    <>
      {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
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
        <div className={`grid gap-3 ${allSalons ? "sm:grid-cols-[minmax(0,1fr)_170px_170px_auto]" : "sm:grid-cols-[minmax(0,1fr)_190px_auto]"}`}>
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
              placeholder={allSalons ? "Search salon, owner, phone or city" : "Search salon, owner, phone or HQ"}
              aria-label="Search clients"
            />
          </label>
          {allSalons ? (
            <>
              <FilterMenu value={clientType} fullWidth showLabelOnMobile ariaLabel="Filter clients by type" onSelect={(value) => { setClientType(value); setPage(1); }} options={[{ key: "", label: "All client types" }, { key: "NEW_CLIENT", label: "New client" }, { key: "EXISTING_CLIENT", label: "Existing client" }]} />
              <FilterMenu value={category} fullWidth showLabelOnMobile ariaLabel="Filter clients by category" onSelect={(value) => { setCategory(value); setPage(1); }} options={[{ key: "", label: "All categories" }, { key: "SALON", label: "Salon" }, { key: "UNISEX", label: "Unisex" }, { key: "STUDIO", label: "Studio" }, { key: "ACADEMY", label: "Academy" }]} />
            </>
          ) : (
            <FilterMenu value={potential} fullWidth showLabelOnMobile ariaLabel="Filter clients by potential" onSelect={(value) => { setPotential(value); setPage(1); }} options={[{ key: "", label: "All potential" }, { key: "HIGH", label: "High potential" }, { key: "MEDIUM", label: "Medium potential" }, { key: "LOW", label: "Low potential" }]} />
          )}
          {(search || clientType || category || potential) && (
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
        <section className="crm-surface overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {allSalons ? "All salons" : "My clients"}
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
          ) : data?.items.length && !allSalons ? (
            <StaffClientList items={data.items} />
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
                      <th className="px-4 py-3">Client type</th>
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
                          <ClientTypeBadge value={client.clientType} />
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
      {formOpen && (() => {
        const onSaved = async (salonName?: string) => {
          setFormOpen(false);
          setPage(1);
          if (salonName) setNotice(`${salonName} was added to your client profiles.`);
          const response = await fetch("/api/clients?page=1&pageSize=20", {
            cache: "no-store",
          });
          if (response.ok)
            setData((await response.json()) as ClientListResponse);
        };
        return allSalons
          ? <ClientForm onClose={() => setFormOpen(false)} onSaved={onSaved} />
          : <ClientProfileForm onClose={() => setFormOpen(false)} onSaved={onSaved} />;
      })()}
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
        <ClientTypeBadge value={client.clientType} />
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
function ClientTypeBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${value === "EXISTING_CLIENT" ? "bg-success-soft text-success" : "bg-brand-soft text-brand-dark"}`}
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
        No clients yet
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
        Add your first client profile with the salon, owner and contact details.
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
  state: string;
  category: string;
  clientType: string;
  ownerName: string;
  primaryContact: string;
  whatsappNumber: string;
  fullAddress: string;
  area: string;
  city: string;
  pincode: string;
  latitude: string;
  longitude: string;
  chairCount: string;
  staffCount: string;
  potential: string;
  customerSegment: string;
};
const initialForm: FormState = {
  salonName: "",
  state: "",
  category: "SALON",
  clientType: "NEW_CLIENT",
  ownerName: "",
  primaryContact: "",
  whatsappNumber: "",
  fullAddress: "",
  area: "",
  city: "",
  pincode: "",
  latitude: "",
  longitude: "",
  chairCount: "",
  staffCount: "",
  potential: "",
  customerSegment: "",
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
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const update =
    (key: keyof FormState) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((value) => ({ ...value, [key]: event.target.value }));
  const steps = ["Basic", "Contact", "Location", "Business"];
  const stepDescriptions = [
    "Identify the salon and its relationship with Bond Therapy.",
    "Add the owner and the two numbers used for daily coordination.",
    "Save the address and exact salon GPS for attendance verification.",
    "Record only the business details needed by the sales team.",
  ];
  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("GPS is not supported on this device.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((value) => ({ ...value, latitude: String(coords.latitude), longitude: String(coords.longitude) }));
        setLocationAccuracy(coords.accuracy);
        setLocating(false);
      },
      () => {
        setLocationError("Allow location access and try again while you are at the salon.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  const next = (event: FormEvent) => {
    event.preventDefault();
    if (step < steps.length - 1) {
      if (step === 2 && (!form.latitude || !form.longitude)) {
        setLocationError("Capture the salon GPS before continuing.");
        return;
      }
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
    ];
    const payload: Record<string, unknown> = {
      ...form,
      potential: form.potential || undefined,
      customerSegment: form.customerSegment || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
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
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/45 p-2 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Add client"
    >
      <div className="my-auto flex max-h-[calc(100dvh-16px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.16)] sm:max-h-[calc(100dvh-48px)]">
        <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
              Add client
            </h2>
            <p className="mt-1 text-xs text-muted">
              Create a clean Salon 360 record in four quick steps
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
        <div className="border-b bg-background/60 px-4 py-3 sm:px-6">
          <p className="mb-3 text-xs font-semibold text-foreground sm:hidden">
            Step {step + 1} of {steps.length} · {steps[step]}
          </p>
          <div className="flex items-center gap-2">
            {steps.map((label, index) => (
              <div
                key={label}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${index <= step ? "bg-brand text-white" : "bg-background text-muted"}`}
                  aria-current={index === step ? "step" : undefined}
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-5 border-b pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Step {step + 1} of {steps.length}</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">{steps[step]}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{stepDescriptions[step]}</p>
            </div>
            {step === 0 && (
              <section className="space-y-5">
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
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Category *">
                    <ChoiceGrid value={form.category} onChange={(category) => setForm((current) => ({ ...current, category }))} options={[["SALON", "Salon"], ["UNISEX", "Unisex"], ["STUDIO", "Studio"], ["ACADEMY", "Academy"]]} />
                  </Field>
                  <Field label="Client type *">
                    <ChoiceGrid value={form.clientType} onChange={(clientType) => setForm((current) => ({ ...current, clientType }))} options={[["NEW_CLIENT", "New client"], ["EXISTING_CLIENT", "Existing client"]]} />
                  </Field>
                </div>
              </section>
            )}
            {step === 1 && (
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Owner name">
                    <Input
                      value={form.ownerName}
                      onChange={update("ownerName")}
                    />
                  </Field>
                </div>
                <Field label="Primary number *">
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
                <Field label="Area / locality">
                  <Input value={form.area} onChange={update("area")} />
                </Field>
                <Field label="City *">
                  <Input value={form.city} onChange={update("city")} required />
                </Field>
                <Field label="State">
                  <Input value={form.state} onChange={update("state")} />
                </Field>
                <Field label="Pincode">
                  <Input
                    value={form.pincode}
                    onChange={update("pincode")}
                    inputMode="numeric"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <div className={`rounded-xl border p-4 ${form.latitude && form.longitude ? "border-success/25 bg-success-soft/35" : "bg-background"}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <span className={`grid size-10 shrink-0 place-items-center rounded-lg border bg-white ${form.latitude ? "text-success" : "text-brand"}`}>
                          {form.latitude ? <CheckCircle2 size={19} /> : <MapPin size={19} />}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Salon GPS location *</p>
                          <p className="mt-1 text-xs leading-5 text-muted">
                            {form.latitude && form.longitude
                              ? `${Number(form.latitude).toFixed(6)}, ${Number(form.longitude).toFixed(6)}${locationAccuracy ? ` · accuracy ±${Math.round(locationAccuracy)} m` : ""}`
                              : "Capture this while at the salon. Visits and attendance will be matched against this point."}
                          </p>
                        </div>
                      </div>
                      <Button type="button" variant="secondary" className="shrink-0" onClick={captureLocation} disabled={locating}>
                        {locating ? <LoaderCircle className="animate-spin" size={15} /> : <MapPin size={15} />}
                        {locating ? "Capturing…" : form.latitude ? "Recapture GPS" : "Capture GPS"}
                      </Button>
                    </div>
                  </div>
                  {locationError && <p className="mt-2 text-xs text-danger" role="alert">{locationError}</p>}
                </div>
              </section>
            )}
            {step === 3 && (
              <section>
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
                </div>
                <p className="mt-4 rounded-lg border border-brand/15 bg-brand-soft/50 px-3 py-2.5 text-xs leading-5 text-muted">
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
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button className="flex-1 sm:flex-none" type="button" variant="secondary" onClick={() => setStep((value) => value - 1)}>
                  <ChevronLeft size={16} />
                  Back
                </Button>
              )}
              <Button className="flex-1 sm:flex-none" type="submit" disabled={saving}>
                {saving ? "Saving…" : step === steps.length - 1 ? "Save client" : "Continue"}
                {step < steps.length - 1 && <ChevronRight size={16} />}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
const INDIAN_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];

const POTENTIAL_OPTIONS = [
  { key: "HIGH", label: "High", active: "border-success bg-success-soft text-success", dot: "bg-success" },
  { key: "MEDIUM", label: "Medium", active: "border-warning bg-warning-soft text-warning", dot: "bg-warning" },
  { key: "LOW", label: "Low", active: "border-brand bg-brand-soft text-brand-dark", dot: "bg-brand" },
] as const;

function PotentialBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-subtle">Not set</span>;
  const tone = value === "HIGH" ? "bg-success-soft text-success" : value === "MEDIUM" ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand-dark";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{pretty(value)}</span>;
}

function StaffClientList({ items }: { items: Client[] }) {
  return (
    <>
      <div className="hidden xl:block">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b bg-background text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
            <tr>
              <th className="px-5 py-3">Salon</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Head quarter</th>
              <th className="px-4 py-3">Used products</th>
              <th className="px-4 py-3">Potential</th>
              <th className="px-5 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((client) => (
              <tr key={client.id} className="transition-colors hover:bg-brand-soft/40">
                <td className="px-5 py-4">
                  <Link href={`/dashboard/clients/${client.id}`} className="font-semibold text-foreground hover:text-brand">{client.salonName}</Link>
                  <p className="mt-0.5 text-xs text-muted">{client.ownerName ?? "Owner not added"}</p>
                </td>
                <td className="px-4 py-4 text-muted">{client.primaryContact}</td>
                <td className="px-4 py-4 text-muted">
                  <p className="text-foreground">{client.headquarter ?? client.city}</p>
                  <p className="mt-0.5 text-xs">{[client.state, client.pincode].filter(Boolean).join(" · ") || "—"}</p>
                </td>
                <td className="max-w-[220px] px-4 py-4 text-muted"><p className="line-clamp-2">{client.usedProducts ?? "—"}</p></td>
                <td className="px-4 py-4"><PotentialBadge value={client.potential} /></td>
                <td className="px-5 py-4 text-right">
                  <Link className="text-xs font-semibold text-brand hover:text-brand-dark" href={`/dashboard/clients/${client.id}`}>View profile <ChevronRight className="inline" size={14} /></Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y xl:hidden">
        {items.map((client) => (
          <article key={client.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/dashboard/clients/${client.id}`} className="block truncate text-sm font-semibold text-foreground hover:text-brand">{client.salonName}</Link>
                <p className="mt-1 text-xs text-muted">{client.ownerName ?? "Owner not added"}</p>
              </div>
              <PotentialBadge value={client.potential} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-3 text-xs">
              <div><dt className="text-muted">Contact</dt><dd className="mt-1"><a className="font-medium text-foreground" href={`tel:${client.primaryContact}`}>{client.primaryContact}</a></dd></div>
              <div><dt className="text-muted">Head quarter</dt><dd className="mt-1 font-medium text-foreground">{client.headquarter ?? client.city}</dd></div>
              <div><dt className="text-muted">State</dt><dd className="mt-1 font-medium text-foreground">{client.state ?? "Not set"}{client.pincode ? ` · ${client.pincode}` : ""}</dd></div>
              <div><dt className="text-muted">Used products</dt><dd className="mt-1 font-medium text-foreground">{client.usedProducts ?? "Not set"}</dd></div>
            </dl>
            <div className="mt-3 flex gap-2">
              <a href={`tel:${client.primaryContact}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-semibold text-foreground"><Phone size={14} />Call</a>
              <Link href={`/dashboard/clients/${client.id}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand text-xs font-semibold text-white">View profile</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

type ProfileValues = { salonName: string; ownerName: string; primaryContact: string; fullAddress: string; state: string; pincode: string; headquarter: string; usedProducts: string; potential: string };
const emptyProfile: ProfileValues = { salonName: "", ownerName: "", primaryContact: "", fullAddress: "", state: "", pincode: "", headquarter: "", usedProducts: "", potential: "" };

function validateProfile(form: ProfileValues) {
  const errors: Partial<Record<keyof ProfileValues, string>> = {};
  if (form.salonName.trim().length < 2) errors.salonName = "Enter the salon name.";
  if (form.ownerName.trim().length < 2) errors.ownerName = "Enter the owner name.";
  if (form.primaryContact.replace(/\D/g, "").length < 10) errors.primaryContact = "Enter a valid contact number (at least 10 digits).";
  if (form.pincode.trim() && !/^\d{6}$/.test(form.pincode.trim())) errors.pincode = "Pincode must be 6 digits.";
  if (form.headquarter.trim().length < 2) errors.headquarter = "Enter the head quarter.";
  if (!form.potential) errors.potential = "Select the potential.";
  return errors;
}

function ClientProfileForm({ onClose, onSaved }: { onClose: () => void; onSaved: (salonName: string) => Promise<void> }) {
  const [form, setForm] = useState(emptyProfile);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState<Array<{ id: string; salonName: string; city: string; primaryContact: string }>>([]);
  const errors = submitted ? validateProfile(form) : {};
  const set = (key: keyof ProfileValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setDuplicates([]);
  };
  const inputClass = (key: keyof ProfileValues) => (errors[key] ? "border-danger focus:border-danger focus:ring-danger/10" : "");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [onClose, saving]);

  const submit = async (event: FormEvent, continueOnDuplicate = false) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.keys(validateProfile(form)).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-profile-form] [aria-invalid='true']")?.focus());
      return;
    }
    setSaving(true);
    const text = (value: string) => value.trim() || undefined;
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          salonName: form.salonName.trim(),
          ownerName: form.ownerName.trim(),
          primaryContact: form.primaryContact.trim(),
          fullAddress: text(form.fullAddress),
          state: text(form.state),
          pincode: text(form.pincode),
          headquarter: form.headquarter.trim(),
          usedProducts: text(form.usedProducts),
          potential: form.potential,
          city: form.headquarter.trim(),
          category: "SALON",
          clientType: "NEW_CLIENT",
          ...(continueOnDuplicate ? { continueOnDuplicate: true } : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 409 && data && Array.isArray(data.candidates) && data.candidates.length) {
        setDuplicates(data.candidates);
        setSaving(false);
        return;
      }
      if (!response.ok) throw new Error(messageFrom(data, "Unable to save this client. Please try again."));
      await onSaved(form.salonName.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this client. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="client-profile-title">
      <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.16)] sm:max-h-[calc(100dvh-48px)] sm:rounded-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="client-profile-title" className="text-lg font-semibold tracking-[-0.01em] text-foreground">Add client</h2>
            <p className="mt-1 text-xs leading-5 text-muted">Fill in the salon details. The profile is saved to your account.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid size-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-background disabled:opacity-50 sm:size-8" aria-label="Close"><X size={18} /></button>
        </div>
        <form data-profile-form onSubmit={(event) => submit(event)} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            <section className="space-y-4">
              <ProfileHeading title="Salon details" />
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileField label="Name of salon" required error={errors.salonName}>
                  <Input value={form.salonName} onChange={set("salonName")} className={inputClass("salonName")} aria-invalid={Boolean(errors.salonName)} maxLength={160} autoComplete="off" autoFocus />
                </ProfileField>
                <ProfileField label="Name of owner" required error={errors.ownerName}>
                  <Input value={form.ownerName} onChange={set("ownerName")} className={inputClass("ownerName")} aria-invalid={Boolean(errors.ownerName)} maxLength={120} autoComplete="off" />
                </ProfileField>
                <div className="sm:col-span-2">
                  <ProfileField label="Contact number" required error={errors.primaryContact}>
                    <Input value={form.primaryContact} onChange={set("primaryContact")} className={inputClass("primaryContact")} aria-invalid={Boolean(errors.primaryContact)} type="tel" inputMode="tel" maxLength={20} placeholder="e.g. 98765 43210" autoComplete="off" />
                  </ProfileField>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <ProfileHeading title="Location" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <ProfileField label="Address">
                    <textarea value={form.fullAddress} onChange={set("fullAddress")} rows={2} maxLength={500} className="w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10" autoComplete="off" />
                  </ProfileField>
                </div>
                <ProfileField label="State">
                  <Input value={form.state} onChange={set("state")} list="client-profile-states" maxLength={100} placeholder="Select or type" autoComplete="off" />
                  <datalist id="client-profile-states">{INDIAN_STATES.map((name) => <option key={name} value={name} />)}</datalist>
                </ProfileField>
                <ProfileField label="Pincode" error={errors.pincode}>
                  <Input value={form.pincode} onChange={set("pincode")} className={inputClass("pincode")} aria-invalid={Boolean(errors.pincode)} inputMode="numeric" maxLength={6} placeholder="6 digits" autoComplete="off" />
                </ProfileField>
                <div className="sm:col-span-2">
                  <ProfileField label="Head quarter" required error={errors.headquarter}>
                    <Input value={form.headquarter} onChange={set("headquarter")} className={inputClass("headquarter")} aria-invalid={Boolean(errors.headquarter)} maxLength={120} placeholder="e.g. Vadodara" autoComplete="off" />
                  </ProfileField>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <ProfileHeading title="Business" />
              <ProfileField label="Used product name" hint="Brands or products the salon uses today. Separate with commas.">
                <Input value={form.usedProducts} onChange={set("usedProducts")} maxLength={300} placeholder="e.g. Keratin shampoo, hair spa cream" autoComplete="off" />
              </ProfileField>
              <div role="group" aria-labelledby="potential-label">
                <p id="potential-label" className="mb-1.5 text-xs font-medium text-foreground">Potential <span className="text-danger">*</span></p>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Potential">
                  {POTENTIAL_OPTIONS.map((option) => {
                    const selected = form.potential === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setForm((current) => ({ ...current, potential: option.key }))}
                        className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${selected ? option.active : errors.potential ? "border-danger bg-white text-muted" : "bg-white text-muted hover:border-brand/30 hover:text-foreground"}`}
                      >
                        <span className={`size-2 rounded-full ${selected ? option.dot : "bg-border"}`} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {errors.potential && <p className="mt-1.5 text-xs text-danger" role="alert">{errors.potential}</p>}
              </div>
            </section>

            {duplicates.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning-soft/60 p-4" role="alert">
                <p className="text-sm font-semibold text-foreground">A similar client already exists</p>
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {duplicates.map((item) => <li key={item.id}><span className="font-medium text-foreground">{item.salonName}</span> · {item.city} · {item.primaryContact}</li>)}
                </ul>
                <p className="mt-2 text-xs text-muted">Check the contact number or salon name, or save anyway if this is a different salon.</p>
              </div>
            )}
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}
          </div>
          <div className="flex shrink-0 gap-2 border-t bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:justify-end sm:px-6">
            <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onClose} disabled={saving}>Cancel</Button>
            {duplicates.length > 0 ? (
              <Button type="button" className="flex-[2] sm:flex-none" disabled={saving} onClick={(event) => submit(event, true)}>
                {saving && <LoaderCircle className="animate-spin" size={16} />}
                {saving ? "Saving…" : "Save anyway"}
              </Button>
            ) : (
              <Button type="submit" className="flex-[2] sm:flex-none" disabled={saving}>
                {saving && <LoaderCircle className="animate-spin" size={16} />}
                {saving ? "Saving…" : "Save client"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function ProfileHeading({ title }: { title: string }) {
  return <h3 className="border-b pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h3>;
}

function ProfileField({ label, required = false, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}{required && <span className="text-danger"> *</span>}</span>
      {children}
      {error ? <span className="block text-xs text-danger" role="alert">{error}</span> : hint ? <span className="block text-xs text-subtle">{hint}</span> : null}
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
function ChoiceGrid({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15 ${value === key ? "border-brand bg-brand-soft text-brand-dark" : "bg-white text-muted hover:border-brand/30 hover:text-foreground"}`}
        >
          <span className={`size-2 rounded-full ${value === key ? "bg-brand" : "bg-border"}`} />
          {label}
        </button>
      ))}
    </div>
  );
}
