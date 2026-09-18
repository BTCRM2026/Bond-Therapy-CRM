"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileSignature, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { StatRow } from "@/components/ui/stat-row";
import type { DistributorRow } from "../distributors/distributors-client";

export type AgreementRow = {
  id: string;
  partyType: "DISTRIBUTOR" | "SUPPLIER" | "EMPLOYEE";
  partyName: string;
  distributorId: string | null;
  distributor: { id: string; businessName: string } | null;
  title: string;
  signedDate: string | null;
  expiryDate: string | null;
  status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "TERMINATED";
  notes: string | null;
};

const PARTY_TYPES = ["DISTRIBUTOR", "SUPPLIER", "EMPLOYEE"] as const;
const STATUSES = ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED"] as const;

const schema = z.object({
  partyType: z.enum(PARTY_TYPES),
  partyName: z.string().trim().min(2, "Party name is required."),
  distributorId: z.string().trim().optional(),
  title: z.string().trim().min(2, "Title is required."),
  signedDate: z.string().trim().optional(),
  expiryDate: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

export function AgreementsClient({ initialAgreements, distributors }: { initialAgreements: AgreementRow[]; distributors: DistributorRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { partyType: "DISTRIBUTOR" } });

  const stats = useMemo(
    () => [
      { label: "Total agreements", value: initialAgreements.length },
      { label: "Active", value: initialAgreements.filter((a) => a.status === "ACTIVE").length },
      { label: "Expiring soon", value: initialAgreements.filter((a) => a.status === "EXPIRING_SOON").length },
      { label: "Expired", value: initialAgreements.filter((a) => a.status === "EXPIRED").length },
    ],
    [initialAgreements],
  );

  const onCreate = async (values: FormValues) => {
    setError("");
    const response = await fetch("/api/agreements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, distributorId: values.distributorId || undefined }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? "Could not create the agreement.");
      return;
    }
    reset();
    setOpen(false);
    router.refresh();
  };

  const onStatusChange = async (agreement: AgreementRow, status: string) => {
    const response = await fetch(`/api/agreements/${agreement.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) router.refresh();
  };

  return (
    <div className="space-y-5">
      <StatRow stats={stats} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Agreements</h2>
        <Button onClick={() => setOpen(true)}>
          <FileSignature size={16} /> New agreement
        </Button>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Title</TH>
            <TH>Party</TH>
            <TH>Signed</TH>
            <TH>Expiry</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {initialAgreements.map((agreement) => (
            <TR key={agreement.id}>
              <TD>
                <p className="font-medium text-foreground">{agreement.title}</p>
                {agreement.notes && <p className="text-xs text-muted">{agreement.notes}</p>}
              </TD>
              <TD>
                <p className="text-foreground">{agreement.partyName}</p>
                <p className="text-xs text-muted">{agreement.partyType}</p>
              </TD>
              <TD className="text-muted">{agreement.signedDate ? new Date(agreement.signedDate).toLocaleDateString() : "-"}</TD>
              <TD className="text-muted">{agreement.expiryDate ? new Date(agreement.expiryDate).toLocaleDateString() : "-"}</TD>
              <TD>
                <Select
                  className="h-9 w-[160px] text-xs"
                  value={agreement.status}
                  onChange={(event) => onStatusChange(agreement, event.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>{status.replace("_", " ")}</option>
                  ))}
                </Select>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {initialAgreements.length === 0 && <EmptyState message="Log a distributor, supplier or employee agreement to start tracking expiries." />}

      <Drawer open={open} onClose={() => setOpen(false)} title="New agreement" description="Record a contract and its expiry date.">
        <form className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="title">Title</label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground" htmlFor="partyType">Party type</label>
              <Select id="partyType" {...register("partyType")}>
                {PARTY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground" htmlFor="partyName">Party name</label>
              <Input id="partyName" {...register("partyName")} />
              {errors.partyName && <p className="text-xs text-danger">{errors.partyName.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="distributorId">Linked distributor (optional)</label>
            <Select id="distributorId" {...register("distributorId")}>
              <option value="">None</option>
              {distributors.map((distributor) => (
                <option key={distributor.id} value={distributor.id}>{distributor.businessName}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground" htmlFor="signedDate">Signed date</label>
              <Input id="signedDate" type="date" {...register("signedDate")} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground" htmlFor="expiryDate">Expiry date</label>
              <Input id="expiryDate" type="date" {...register("expiryDate")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="notes">Notes</label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            <Plus size={16} /> {isSubmitting ? "Saving..." : "Create agreement"}
          </Button>
        </form>
      </Drawer>
    </div>
  );
}
