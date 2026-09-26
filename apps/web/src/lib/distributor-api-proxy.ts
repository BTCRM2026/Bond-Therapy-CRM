import { NextResponse } from "next/server";
import { PORTAL_HEADER } from "@/lib/portal";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

/**
 * Same shape as proxyToApi in api-proxy.ts, but the portal is hardcoded to
 * DISTRIBUTOR instead of derived from the host, since /distributor is a path
 * on the admin domain today. Swap this constant for host detection when the
 * distributor portal moves to its own subdomain.
 */
export async function proxyToDistributorApi(request: Request, upstreamPath: string) {
  try {
    const url = new URL(`${API}${upstreamPath}`);
    new URL(request.url).searchParams.forEach((value, key) => url.searchParams.set(key, value));
    const hasBody = !["GET", "HEAD", "DELETE"].includes(request.method);
    const upstream = await fetch(url, {
      method: request.method,
      headers: { cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: "DISTRIBUTOR", ...(hasBody ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}) },
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ message: "Service is temporarily unavailable." }, { status: 503 });
  }
}
