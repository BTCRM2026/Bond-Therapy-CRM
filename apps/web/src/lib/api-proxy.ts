import { NextResponse } from "next/server";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function proxyJson(request: Request, path: string, method: string) {
  const hasBody = method !== "GET" && method !== "DELETE";
  const upstream = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: hasBody ? await request.text() : undefined,
    cache: "no-store",
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
