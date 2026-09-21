import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function GET(request: Request) {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "ADMIN") return NextResponse.json({ message: "Product statistics are restricted to administrators." }, { status: 403 });
    const upstream = await fetch(`${API}/products/stats`, { headers: { cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal }, cache: "no-store" });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  } catch { return NextResponse.json({ message: "Product statistics are temporarily unavailable." }, { status: 503 }); }
}
