import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function GET(request: Request) {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "STAFF" && portal !== "ADMIN") return NextResponse.json({ message: "Stock movements are not available from this portal." }, { status: 403 });
    const url = new URL(`${API}/products/movements`);
    new URL(request.url).searchParams.forEach((value, key) => url.searchParams.set(key, value));
    const upstream = await fetch(url, { headers: { cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal }, cache: "no-store" });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  } catch { return NextResponse.json({ message: "Stock movement service is temporarily unavailable." }, { status: 503 }); }
}
