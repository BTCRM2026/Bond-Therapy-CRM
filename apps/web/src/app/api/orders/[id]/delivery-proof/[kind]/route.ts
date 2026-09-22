import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";
const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

async function forward(request: Request, context: { params: Promise<{ id: string; kind: string }> }, method: "GET" | "POST") {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "STAFF" && portal !== "ADMIN") return NextResponse.json({ message: "Delivery proof is not available." }, { status: 403 });
    const { id, kind } = await context.params;
    const headers: Record<string, string> = { cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal };
    if (method === "POST") headers["content-type"] = request.headers.get("content-type") ?? "multipart/form-data";
    const upstream = await fetch(`${API}/orders/${encodeURIComponent(id)}/delivery-proof/${encodeURIComponent(kind)}`, { method, headers, body: method === "POST" ? await request.arrayBuffer() : undefined, cache: "no-store" });
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", ...(upstream.headers.get("content-disposition") ? { "content-disposition": upstream.headers.get("content-disposition")! } : {}) } });
  } catch { return NextResponse.json({ message: "Delivery proof service is temporarily unavailable." }, { status: 503 }); }
}
export const GET = (request: Request, context: { params: Promise<{ id: string; kind: string }> }) => forward(request, context, "GET");
export const POST = (request: Request, context: { params: Promise<{ id: string; kind: string }> }) => forward(request, context, "POST");
