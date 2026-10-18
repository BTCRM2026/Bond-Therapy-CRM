import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { OrderFormModule } from "@/components/order-form-module";
import { requireSession } from "@/lib/session";
import { isStaffModuleEnabled } from "@/lib/staff-modules";

const SALES_ROLES = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

export default async function OrderFormPage() {
  const session = await requireSession("STAFF");
  if (!isStaffModuleEnabled("/dashboard/order-form")) redirect("/dashboard");
  const roleKey = session.roles[0]?.key ?? "";
  if (!SALES_ROLES.has(roleKey)) redirect("/dashboard/access-denied");
  return (
    <DashboardShell
      userName={session.name}
      roleName={session.roles[0]?.name ?? "Sales"}
      roleKey={roleKey}
      headerTitle="Order Form"
      headerSubtitle="Record salon orders and download a copy after saving"
      portal="STAFF"
    >
      <OrderFormModule />
    </DashboardShell>
  );
}
