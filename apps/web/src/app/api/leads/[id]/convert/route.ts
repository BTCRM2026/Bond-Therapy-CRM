import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "STAFF" && portal !== "ADMIN") return NextResponse.json({ message: "Leads are not available from this portal." }, { status: 403 });
    const { id } = await context.params;
    const upstream = await fetch(`${API}/leads/${encodeURIComponent(id)}/convert`, { method: "POST", headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal }, cache: "no-store" });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  } catch { return NextResponse.json({ message: "Lead service is temporarily unavailable." }, { status: 503 }); }
}
