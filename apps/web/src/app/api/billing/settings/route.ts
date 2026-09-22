import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";
const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
async function forward(request: Request, method: "GET" | "PATCH") { try { const portal = portalFromRequest(request); if (portal !== "ADMIN") return NextResponse.json({ message: "Administrator access required." }, { status: 403 }); const upstream = await fetch(`${API}/billing/settings`, { method, headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal }, body: method === "PATCH" ? await request.text() : undefined, cache: "no-store" }); return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } }); } catch { return NextResponse.json({ message: "Billing settings are temporarily unavailable." }, { status: 503 }); } }
export const GET = (request: Request) => forward(request, "GET");
export const PATCH = (request: Request) => forward(request, "PATCH");
