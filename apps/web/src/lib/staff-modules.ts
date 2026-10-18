// Staff portal modules that are switched on right now. Hidden modules keep their code and routes;
// add a route here to bring it back into the menu, tab bar and dashboard shortcuts.
// Held back for version 1 (code retained): Follow-ups, Leads, Invoices and Products.
// Duplicates kept out of the menus (code retained): sales "Orders" (use Order Form), "Performance" and "Incentives" (use My Performance).
const ENABLED = new Set([
  "/dashboard",
  "/dashboard/clients",
  "/dashboard/daily-report",
  "/dashboard/order-form",
  "/dashboard/my-team",
  "/dashboard/requests",
  "/dashboard/leave",
  "/dashboard/attendance",
  "/dashboard/my-letters",
  "/dashboard/orders",
  "/dashboard/demos",
  "/dashboard/territory",
  "/dashboard/route",
  "/dashboard/my-performance",
  "/dashboard/settings",
]);

export const isStaffModuleEnabled = (href: string) => ENABLED.has(href);
