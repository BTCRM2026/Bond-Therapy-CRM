import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest, type PortalType } from "@/lib/portal";

function loginUrl(request: Request, portal: PortalType) {
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const [currentHostname, currentPort] = forwardedHost.split(":");
  const local = currentHostname === "localhost" || currentHostname === "127.0.0.1" || currentHostname.endsWith(".localhost");
  const targetHostname = local
    ? portal === "STAFF" ? "staff.localhost" : "localhost"
    : portal === "STAFF" ? process.env.STAFF_HOST : process.env.ADMIN_HOST;
  if (!targetHostname) return null;

  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const port = local && currentPort ? `:${currentPort}` : "";
  return `${protocol}://${targetHostname}${port}/login`;
}

export async function POST(request: Request) {
  try {
    const portal = portalFromRequest(request);
    if (!portal) return NextResponse.json({ message: "Unknown portal." }, { status: 400 });
    const upstream = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", [PORTAL_HEADER]: portal },
      body: await request.text(),
      cache: "no-store",
    });
    const body = await upstream.text();
    let responseBody = body;
    if (!upstream.ok) {
      const error = JSON.parse(body) as { assignedPortal?: PortalType; message?: string };
      const redirectUrl = error.assignedPortal ? loginUrl(request, error.assignedPortal) : null;
      if (redirectUrl) responseBody = JSON.stringify({ message: error.message, redirectUrl });
    }
    const response = new NextResponse(responseBody, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
    const cookie = upstream.headers.get("set-cookie");
    if (cookie) response.headers.set("set-cookie", cookie);
    return response;
  } catch {
    return NextResponse.json({ message: "The login service is temporarily unavailable." }, { status: 503 });
  }
}
