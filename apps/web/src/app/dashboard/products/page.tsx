import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProductManagement } from "@/components/product-management";
import { ProductsCatalogue, type ProductListResponse } from "@/components/products-catalogue";
import { PORTAL_HEADER, type PortalType } from "@/lib/portal";
import { requireSession } from "@/lib/session";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

async function loadProducts(portal: PortalType) {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/products?page=1&pageSize=200`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: portal }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as ProductListResponse;
  } catch { return null; }
}

export default async function ProductsPage() {
  const session = await requireSession();
  const isAdmin = session.portal === "ADMIN" && session.roles.some((role) => role.key === "SUPER_ADMIN");
  const isSales = session.portal === "STAFF" && SALES_ROLE_KEYS.has(session.roles[0]?.key ?? "");
  const isAccounts = session.portal === "STAFF" && session.roles.some((role) => role.key === "ACCOUNTS_BILLING");
  if (!isAdmin && !isSales && !isAccounts) redirect("/dashboard/access-denied");

  const initial = await loadProducts(session.portal);
  return (
    <DashboardShell
      userName={session.name}
      roleName={session.roles[0]?.name ?? (isAdmin ? "Super Admin" : "Staff")}
      roleKey={session.roles[0]?.key}
      headerTitle="Products"
      headerSubtitle={isAdmin ? "Manage the shared product catalogue" : "Catalogue and live stock"}
      portal={session.portal}
      canManageStaff={isAdmin && session.permissions.includes("admin.staff.manage")}
      visualTheme={isAdmin ? "product-reference" : "default"}
    >
      {isAdmin ? <ProductManagement initial={initial} /> : <ProductsCatalogue initial={initial} />}
    </DashboardShell>
  );
}
