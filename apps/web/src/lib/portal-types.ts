export type PortalType = "ADMIN" | "STAFF" | "DISTRIBUTOR";

export function portalLabel(portal: PortalType) {
  if (portal === "STAFF") return "Staff Portal";
  if (portal === "DISTRIBUTOR") return "Distributor Portal";
  return "Administration Portal";
}
