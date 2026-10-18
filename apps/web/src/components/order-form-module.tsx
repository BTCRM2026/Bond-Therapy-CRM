"use client";

import {
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  ShoppingCart,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Product = {
  id: string;
  name: string;
  variant: string | null;
  unitPrice: string;
  stockOnHand: number;
};
type Client = {
  id: string;
  salonName: string;
  city: string | null;
  primaryContact: string;
};
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  subtotal: string;
  version: number;
  notes: string | null;
  reviewComment?: string | null;
  paymentVerifiedAt?: string | null;
  distributorInvoiceAttachment?: { id: string; fileName: string; mime: string } | null;
  client: Client;
  items: Array<{ productId: string; quantity: number; product: Product }>;
};
type Page<T> = { items: T[]; page: number; total: number; hasMore: boolean };
type Line = { productId: string; quantity: number };
const money = (value: number | string) =>
  `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const message = (data: unknown, fallback: string) =>
  data && typeof data === "object" && "message" in data
    ? String((data as { message: unknown }).message)
    : fallback;

// What the salesperson needs to know about an order: where it stands, and what to do next.
function stage(order: Order): { label: string; tone: string } {
  if (order.paymentVerifiedAt) return { label: "Payment confirmed", tone: "bg-success-soft text-success" };
  if (order.status === "DRAFT") return { label: "Draft", tone: "bg-background text-muted" };
  if (order.status === "RETURNED_FOR_CORRECTION") return { label: "Returned", tone: "bg-warning-soft text-warning" };
  if (order.status === "REJECTED") return { label: "Rejected", tone: "bg-red-50 text-danger" };
  if (order.status === "SUBMITTED" || order.status === "UNDER_REVIEW") return { label: "With admin", tone: "bg-brand-soft text-brand-dark" };
  return { label: "Approved", tone: "bg-brand-soft text-brand-dark" };
}

// Attach the distributor's bill (camera, gallery or PDF) and send the order to the admin, who confirms the payment.
function BillActions({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const editable = order.status === "DRAFT" || order.status === "RETURNED_FOR_CORRECTION";
  const bill = order.distributorInvoiceAttachment;

  const attach = async (file: File) => {
    setBusy("upload");
    setError("");
    try {
      const body = new FormData();
      body.append("invoice", file);
      const response = await fetch(`/api/orders/${order.id}/bill`, { method: "POST", body });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(message(data, "Could not attach the bill."));
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not attach the bill.");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  };
  const send = async () => {
    setBusy("send");
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "SUBMITTED", version: order.version }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(message(data, "Could not send this order."));
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send this order.");
    } finally {
      setBusy("");
    }
  };

  const note = order.paymentVerifiedAt ? "Payment confirmed by the admin. This sale now counts in your performance."
    : order.status === "SUBMITTED" || order.status === "UNDER_REVIEW" ? "Waiting for the admin to confirm the payment."
    : order.status === "RETURNED_FOR_CORRECTION" ? `Returned by the admin${order.reviewComment ? `: ${order.reviewComment}` : ""}. Fix it and send it again.`
    : order.status === "REJECTED" ? `Rejected${order.reviewComment ? `: ${order.reviewComment}` : "."}`
    : editable ? (bill ? "Bill attached. Send the order to the admin for payment confirmation." : "Attach the distributor’s bill to send this order. It counts as a sale once the admin confirms the payment.")
    : "Approved. Waiting for the admin to confirm the payment.";

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-background/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2 text-xs text-muted">
        {order.paymentVerifiedAt ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" /> : bill ? <FileText size={15} className="mt-0.5 shrink-0 text-brand" /> : <Paperclip size={15} className="mt-0.5 shrink-0 text-subtle" />}
        <div className="min-w-0">
          <p className="leading-5">{note}</p>
          {bill && <a href={`/api/orders/${order.id}/bill`} target="_blank" rel="noreferrer" className="mt-0.5 inline-block max-w-full truncate font-semibold text-brand hover:underline">{bill.fileName}</a>}
          {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
        </div>
      </div>
      {editable && (
        <div className="flex shrink-0 flex-wrap gap-2">
          <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" aria-label="Choose the bill photo or PDF" onChange={(event) => { const file = event.target.files?.[0]; if (file) void attach(file); }} />
          <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => input.current?.click()}>
            {busy === "upload" ? <LoaderCircle size={15} className="animate-spin" /> : <Paperclip size={15} />}
            {bill ? "Replace bill" : "Attach bill"}
          </Button>
          <Button type="button" disabled={Boolean(busy) || !bill} onClick={send}>
            {busy === "send" ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
            Send to admin
          </Button>
        </div>
      )}
    </div>
  );
}

export function OrderFormModule() {
  const [orders, setOrders] = useState<Page<Order> | null>(null);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [saved, setSaved] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const sync = () =>
      setHeaderSlot(document.getElementById("page-header-actions"));
    sync();
    const frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    let active = true;
    fetch(`/api/orders?page=${page}&pageSize=20`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(message(data, "Could not load order forms."));
        if (active) {
          setOrders(data as Page<Order>);
          setError("");
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load order forms.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, refresh]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/products?pageSize=200&catalogueStatus=ACTIVE", {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(message(data, "Could not load products."));
        if (active) setProducts((data as Page<Product>).items);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load products.",
          );
      });
    return () => {
      active = false;
    };
  }, [open]);
  useEffect(() => {
    if (!open || client || !clientSearch.trim()) {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      fetch(
        `/api/clients?search=${encodeURIComponent(clientSearch.trim())}&pageSize=20`,
        { cache: "no-store" },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("Could not search salons.");
          const data = (await response.json()) as Page<Client>;
          if (active) setClients(data.items);
        })
        .catch(() => {
          if (active) setClients([]);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, client, clientSearch]);

  const byId = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const matches = useMemo(
    () =>
      productSearch.trim()
        ? products
            .filter((product) =>
              `${product.name} ${product.variant || ""}`
                .toLowerCase()
                .includes(productSearch.toLowerCase()),
            )
            .slice(0, 12)
        : [],
    [products, productSearch],
  );
  const total = lines.reduce(
    (sum, line) =>
      sum + Number(byId.get(line.productId)?.unitPrice || 0) * line.quantity,
    0,
  );

  const close = () => {
    setOpen(false);
    setEditing(null);
    setSaved(null);
    setClient(null);
    setClientSearch("");
    setClients([]);
    setProductSearch("");
    setLines([]);
    setNotes("");
    setError("");
  };
  const start = (order?: Order) => {
    setEditing(order ?? null);
    setSaved(null);
    setClient(order?.client ?? null);
    setClientSearch(order?.client.salonName ?? "");
    setLines(
      order?.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })) ?? [],
    );
    setNotes(order?.notes ?? "");
    setError("");
    setOpen(true);
  };
  const add = (product: Product) => {
    if (!lines.some((line) => line.productId === product.id))
      setLines((current) => [
        ...current,
        { productId: product.id, quantity: 1 },
      ]);
    setProductSearch("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !client ||
      !lines.length ||
      lines.some(
        (line) => !Number.isInteger(line.quantity) || line.quantity < 1,
      )
    ) {
      setError(
        "Choose a salon and add at least one product with a valid bottle quantity.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        editing ? `/api/orders/${editing.id}` : "/api/orders",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientId: client.id,
            items: lines,
            notes: notes.trim(),
            ...(editing ? { version: editing.version } : {}),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(message(data, "Could not save this order form."));
      setSaved(data as Order);
      setEditing(null);
      setLoading(true);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save this order form.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {headerSlot &&
        createPortal(
          <Button onClick={() => start()}>
            <Plus size={16} />
            <span className="hidden sm:inline">New order form</span>
            <span className="sr-only sm:hidden">New order form</span>
          </Button>,
          headerSlot,
        )}
      {error && !open && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <section className="crm-surface overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-semibold">Saved order forms</h2>
            <p className="text-xs text-muted">
              No saved form can be deleted. Drafts can be corrected.
            </p>
          </div>
          <span className="text-xs text-muted">{orders?.total ?? 0} total</span>
        </div>
        {loading ? (
          <div className="space-y-3 p-5" aria-label="Loading order forms">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-14 animate-pulse rounded bg-background"
              />
            ))}
          </div>
        ) : !orders?.items.length ? (
          <div className="px-5 py-14 text-center">
            <ShoppingCart className="mx-auto text-subtle" size={24} />
            <p className="mt-3 text-sm font-semibold">No order forms yet</p>
            <p className="mt-1 text-xs text-muted">
              Create the first form after confirming the salon’s order.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {orders.items.map((order) => (
              <article key={order.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {order.orderNumber}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stage(order).tone}`}>
                      {stage(order).label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {order.client.salonName} · {order.items.length} product
                    {order.items.length === 1 ? "" : "s"} ·{" "}
                    {money(order.subtotal)}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href={`/api/orders/${order.id}/order-form.pdf`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-[13px] font-semibold hover:bg-background"
                  >
                    <Download size={15} />
                    Download PDF
                  </a>
                  {["DRAFT", "RETURNED_FOR_CORRECTION"].includes(
                    order.status,
                  ) && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => start(order)}
                    >
                      Edit draft
                    </Button>
                  )}
                </div>
                </div>
                <BillActions order={order} onChanged={() => setRefresh((value) => value + 1)} />
              </article>
            ))}
          </div>
        )}
      </section>
      {orders && orders.total > 20 && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => {
              setLoading(true);
              setPage((value) => value - 1);
            }}
          >
            Previous
          </Button>
          <span className="self-center text-xs text-muted">Page {page}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={!orders.hasMore}
            onClick={() => {
              setLoading(true);
              setPage((value) => value + 1);
            }}
          >
            Next
          </Button>
        </div>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Order form"
        >
          <div className="flex max-h-[calc(100dvh-16px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-white shadow-lg sm:max-h-[calc(100dvh-32px)]">
            <div className="flex items-start justify-between border-b px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-base font-semibold">
                  {saved
                    ? `${saved.orderNumber} saved`
                    : editing
                      ? `Edit ${editing.orderNumber}`
                      : "New order form"}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Quantity is the number of bottles or packs; volume is the
                  package size.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-lg hover:bg-background"
              >
                <X size={18} />
              </button>
            </div>
            {saved ? (
              <div className="p-5">
                <p className="rounded-lg border border-success/20 bg-success-soft p-3 text-sm text-success">
                  Saved as a draft. Next, attach the distributor’s bill from the list and send it to the admin. You can also download the PDF.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={close}>
                    Done
                  </Button>
                  <a
                    href={`/api/orders/${saved.id}/order-form.pdf`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
                  >
                    <Download size={16} />
                    Download PDF
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={save} className="flex min-h-0 flex-col">
                <div className="space-y-5 overflow-y-auto p-4 sm:p-5">
                  <Field label="Salon *">
                    <Input
                      value={clientSearch}
                      onChange={(event) => {
                        setClientSearch(event.target.value);
                        setClient(null);
                      }}
                      placeholder="Search salon name"
                      required
                    />
                  </Field>
                  {!client && clientSearch.trim() && (
                    <div className="max-h-40 overflow-y-auto rounded-lg border">
                      {clients.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            setClient(entry);
                            setClientSearch(entry.salonName);
                            setClients([]);
                          }}
                          className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-background"
                        >
                          {entry.salonName}
                          <span className="ml-2 text-xs text-muted">
                            {entry.city}
                          </span>
                        </button>
                      ))}
                      {!clients.length && (
                        <p className="p-3 text-xs text-muted">
                          No matching salons yet.
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <Field label="Add products *">
                      <div className="relative">
                        <Search
                          size={16}
                          className="absolute left-3 top-3 text-subtle"
                        />
                        <Input
                          value={productSearch}
                          onChange={(event) =>
                            setProductSearch(event.target.value)
                          }
                          placeholder="Search products by name or volume"
                          className="pl-9"
                        />
                      </div>
                    </Field>
                    {productSearch.trim() && (
                      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border">
                        {matches.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => add(product)}
                            disabled={lines.some(
                              (line) => line.productId === product.id,
                            )}
                            className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-xs hover:bg-background disabled:opacity-50"
                          >
                            <span className="min-w-0 truncate font-medium">
                              {product.name}{" "}
                              <span className="text-muted">
                                · {product.variant || "—"}
                              </span>
                            </span>
                            <span className="shrink-0">
                              {money(product.unitPrice)}
                            </span>
                          </button>
                        ))}
                        {!matches.length && (
                          <p className="p-3 text-xs text-muted">
                            No matching products.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[570px] text-left text-xs">
                      <thead className="bg-background text-muted">
                        <tr>
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2">Package</th>
                          <th className="px-3 py-2 text-right">MRP</th>
                          <th className="px-3 py-2 text-right">
                            Qty (bottles)
                          </th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lines.map((line) => {
                          const product = byId.get(line.productId);
                          return (
                            <tr key={line.productId}>
                              <td className="px-3 py-2 font-medium">
                                {product?.name ?? "Loading product…"}
                              </td>
                              <td className="px-3 py-2 text-muted">
                                {product?.variant || "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {money(product?.unitPrice || 0)}
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  aria-label={`Quantity of ${product?.name ?? "product"} in bottles`}
                                  type="number"
                                  min="1"
                                  max="100000"
                                  step="1"
                                  required
                                  value={line.quantity}
                                  onChange={(event) =>
                                    setLines((current) =>
                                      current.map((item) =>
                                        item.productId === line.productId
                                          ? {
                                              ...item,
                                              quantity: Number(
                                                event.target.value,
                                              ),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="ml-auto h-9 w-20 text-right"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                {money(
                                  Number(product?.unitPrice || 0) *
                                    line.quantity,
                                )}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  aria-label={`Remove ${product?.name ?? "product"}`}
                                  onClick={() =>
                                    setLines((current) =>
                                      current.filter(
                                        (item) =>
                                          item.productId !== line.productId,
                                      ),
                                    )
                                  }
                                  className="grid size-8 place-items-center rounded text-muted hover:bg-red-50 hover:text-danger"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!lines.length && (
                      <p className="p-4 text-center text-xs text-muted">
                        Search and add a product to begin.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 text-sm">
                    <span className="text-muted">Estimated MRP total</span>
                    <strong className="tabular-nums">{money(total)}</strong>
                  </div>
                  <Field label="Changes or exchange note (optional)">
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="Mention requested changes or exchange details"
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                    />
                  </Field>
                  {error && (
                    <p
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-danger"
                    >
                      {error}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t bg-white p-4">
                  <Button type="button" variant="secondary" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy || !products.length}>
                    {busy && (
                      <LoaderCircle size={16} className="animate-spin" />
                    )}
                    {busy ? "Saving…" : "Save order form"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
