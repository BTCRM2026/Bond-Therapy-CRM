import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

async function forward(request: Request, method: "GET" | "POST") {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "STAFF" && portal !== "ADMIN") return NextResponse.json({ message: "Leads are not available from this portal." }, { status: 403 });
    const url = new URL(`${API}/leads`);
    if (method === "GET") new URL(request.url).searchParams.forEach((value, key) => url.searchParams.set(key, value));
    const upstream = await fetch(url, { method, headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal }, body: method === "POST" ? await request.text() : undefined, cache: "no-store" });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  } catch { return NextResponse.json({ message: "Lead service is temporarily unavailable." }, { status: 503 }); }
}

export const GET = (request: Request) => forward(request, "GET");
export const POST = (request: Request) => forward(request, "POST");
