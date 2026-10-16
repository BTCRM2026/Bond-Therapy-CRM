// Staff portal modules that are switched on right now. Hidden modules keep their code and routes;
// add a route here to bring it back into the menu, tab bar and dashboard shortcuts.
// Version 2: restore "/dashboard/attendance" here when staff attendance is launched.
// Duplicates kept out of the menus (code retained): sales "Orders" (use Order Form), "Performance" and "Incentives" (use My Performance).
const ENABLED = new Set([
  "/dashboard",
  "/dashboard/clients",
  "/dashboard/daily-report",
  "/dashboard/order-form",
  "/dashboard/requests",
  "/dashboard/my-letters",
  "/dashboard/follow-ups",
  "/dashboard/leads",
  "/dashboard/orders",
  "/dashboard/invoices",
  "/dashboard/products",
  "/dashboard/demos",
  "/dashboard/territory",
  "/dashboard/route",
  "/dashboard/my-performance",
  "/dashboard/settings",
]);

export const isStaffModuleEnabled = (href: string) => ENABLED.has(href);
