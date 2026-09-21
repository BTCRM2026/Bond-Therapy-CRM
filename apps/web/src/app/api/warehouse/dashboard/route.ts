import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function GET(request: Request) {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "STAFF") return NextResponse.json({ message: "The warehouse workspace is not available from this portal." }, { status: 403 });
    const upstream = await fetch(`${API}/warehouse/dashboard`, { headers: { cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal }, cache: "no-store" });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  } catch { return NextResponse.json({ message: "Warehouse service is temporarily unavailable." }, { status: 503 }); }
}
