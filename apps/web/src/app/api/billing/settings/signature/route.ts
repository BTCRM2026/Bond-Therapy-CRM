import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";
const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

async function forward(request: Request, method: "GET" | "POST") {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "ADMIN") return NextResponse.json({ message: "Administrator access required." }, { status: 403 });
    const headers: Record<string, string> = { cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal };
    if (method === "POST") headers["content-type"] = request.headers.get("content-type") ?? "multipart/form-data";
    const upstream = await fetch(`${API}/billing/settings/signature`, { method, headers, body: method === "POST" ? await request.arrayBuffer() : undefined, cache: "no-store" });
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } });
  } catch { return NextResponse.json({ message: "Billing settings are temporarily unavailable." }, { status: 503 }); }
}
export const GET = (request: Request) => forward(request, "GET");
export const POST = (request: Request) => forward(request, "POST");
