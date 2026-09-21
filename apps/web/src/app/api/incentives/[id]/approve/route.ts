import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "STAFF") return NextResponse.json({ message: "Not available from this portal." }, { status: 403 });
    const { id } = await context.params;
    const upstream = await fetch(`${API}/incentives/${encodeURIComponent(id)}/approve`, { method: "PATCH", headers: { cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal }, cache: "no-store" });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  } catch { return NextResponse.json({ message: "Incentive service is temporarily unavailable." }, { status: 503 }); }
}
