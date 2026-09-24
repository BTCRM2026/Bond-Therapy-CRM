import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";
import type { PortalType } from "@/lib/portal-types";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function proxyToApi(request: Request, upstreamPath: string, options: { allowedPortals: PortalType[]; deniedMessage?: string }) {
  try {
    const portal = portalFromRequest(request);
    if (!portal || !options.allowedPortals.includes(portal)) return NextResponse.json({ message: options.deniedMessage ?? "This action is not available from this portal." }, { status: 403 });
    const url = new URL(`${API}${upstreamPath}`);
    new URL(request.url).searchParams.forEach((value, key) => url.searchParams.set(key, value));
    const hasBody = !["GET", "HEAD", "DELETE"].includes(request.method);
    const upstream = await fetch(url, {
      method: request.method,
      headers: { cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal, ...(hasBody ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}) },
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } });
  } catch { return NextResponse.json({ message: "Service is temporarily unavailable." }, { status: 503 }); }
}
