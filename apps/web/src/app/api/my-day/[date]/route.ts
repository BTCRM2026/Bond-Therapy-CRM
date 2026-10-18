import { proxyToApi } from "@/lib/api-proxy";

// A salesperson's own day, for the calendar in Attendance.
export async function GET(request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  return proxyToApi(request, `/my-day/${encodeURIComponent(date)}`, { allowedPortals: ["STAFF"], deniedMessage: "Daily details are available in the staff portal." });
}
