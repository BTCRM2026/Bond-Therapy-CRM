"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Truck } from "lucide-react";
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

export type DistributorRow = {
  id: string;
  businessName: string;
  contactName: string;
  phone: string | null;
  email: string | null;
  territory: string | null;
  creditLimit: string | null;
  status: "ONBOARDING" | "ACTIVE" | "INACTIVE";
  assignedSalesperson: { id: string; name: string } | null;
  createdAt: string;
};

const STATUSES = ["ONBOARDING", "ACTIVE", "INACTIVE"] as const;

const schema = z.object({
  businessName: z.string().trim().min(2, "Business name is required."),
  contactName: z.string().trim().min(2, "Contact name is required."),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  territory: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

export function DistributorsClient({ initialDistributors }: { initialDistributors: DistributorRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const stats = useMemo(
    () => [
      { label: "Total distributors", value: initialDistributors.length },
      { label: "Active", value: initialDistributors.filter((d) => d.status === "ACTIVE").length },
      { label: "Onboarding", value: initialDistributors.filter((d) => d.status === "ONBOARDING").length },
    ],
    [initialDistributors],
  );

  const onCreate = async (values: FormValues) => {
    setError("");
    const response = await fetch("/api/distributors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? "Could not create the distributor.");
      return;
    }
    reset();
    setOpen(false);
    router.refresh();
  };

  const onStatusChange = async (distributor: DistributorRow, status: string) => {
    const response = await fetch(`/api/distributors/${distributor.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) router.refresh();
  };

  return (
    <div className="space-y-5">
      <StatRow stats={stats} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-base font-semibold text-foreground">Distributor directory</h2><p className="mt-1 text-xs text-muted">Onboarding, ownership and account status in one place.</p></div>
        <Button onClick={() => setOpen(true)}>
          <Truck size={16} /> New distributor
        </Button>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Business</TH>
            <TH>Contact</TH>
            <TH>Territory</TH>
            <TH>Salesperson</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {initialDistributors.map((distributor) => (
            <TR key={distributor.id}>
              <TD>
                <p className="font-medium text-foreground">{distributor.businessName}</p>
                <p className="text-xs text-muted">{distributor.email ?? "No email on file"}</p>
              </TD>
              <TD>
                <p className="text-foreground">{distributor.contactName}</p>
                <p className="text-xs text-muted">{distributor.phone ?? "-"}</p>
              </TD>
              <TD className="text-muted">{distributor.territory ?? "-"}</TD>
              <TD className="text-muted">{distributor.assignedSalesperson?.name ?? "Unassigned"}</TD>
              <TD>
                <Select
                  className="h-9 w-[150px] text-xs"
                  value={distributor.status}
                  onChange={(event) => onStatusChange(distributor, event.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </Select>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {initialDistributors.length === 0 && <EmptyState message="Add a distributor to start tracking their orders and agreements." />}

      <Drawer open={open} onClose={() => setOpen(false)} title="New distributor" description="Onboard a distributor account.">
        <form className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="businessName">Business name</label>
            <Input id="businessName" {...register("businessName")} />
            {errors.businessName && <p className="text-xs text-danger">{errors.businessName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="contactName">Contact name</label>
            <Input id="contactName" {...register("contactName")} />
            {errors.contactName && <p className="text-xs text-danger">{errors.contactName.message}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground" htmlFor="phone">Phone</label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground" htmlFor="email">Email</label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="territory">Territory</label>
            <Input id="territory" {...register("territory")} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground" htmlFor="notes">Notes</label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            <Plus size={16} /> {isSubmitting ? "Creating..." : "Create distributor"}
          </Button>
        </form>
      </Drawer>
    </div>
  );
}
