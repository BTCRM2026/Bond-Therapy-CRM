import { headers } from "next/headers";

export type PortalType = "ADMIN" | "STAFF" | "DISTRIBUTOR";

export const PORTAL_HEADER = "x-bt-portal";

function hostname(value: string | null) {
  return value?.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

export function portalFromHost(value: string | null): PortalType | null {
  const host = hostname(value);
  const staffHost = (process.env.STAFF_HOST ?? "staff.bondtherapy.management").toLowerCase();
  const adminHosts = new Set([
    (process.env.ADMIN_HOST ?? "bondtherapy.management").toLowerCase(),
    process.env.RAILWAY_PUBLIC_DOMAIN?.toLowerCase(),
    "localhost",
    "127.0.0.1",
  ].filter(Boolean));

  if (host === staffHost || host === "staff.localhost") return "STAFF";
  if (adminHosts.has(host)) return "ADMIN";
  return null;
}

export function portalFromRequest(request: Request) {
  return portalFromHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
}

export async function requestPortal() {
  const requestHeaders = await headers();
  return portalFromHost(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"));
}

export function portalLabel(portal: PortalType) {
  if (portal === "STAFF") return "Staff Portal";
  if (portal === "DISTRIBUTOR") return "Distributor Portal";
  return "Administration Portal";
}
