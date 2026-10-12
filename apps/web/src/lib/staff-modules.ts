// Staff portal modules that are switched on right now. Hidden modules keep their code and routes;
// add a route here to bring it back into the menu, tab bar and dashboard shortcuts.
const ENABLED = new Set(["/dashboard", "/dashboard/clients", "/dashboard/daily-report", "/dashboard/attendance", "/dashboard/settings"]);

export const isStaffModuleEnabled = (href: string) => ENABLED.has(href);
