import { NextResponse } from "next/server";
import { PORTAL_HEADER } from "@/lib/portal";

export async function POST(request: Request) {
  const upstream = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/auth/logout`, {
    method: "POST",
    headers: { cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: "DISTRIBUTOR" },
    cache: "no-store",
  });
  const response = NextResponse.json({ ok: upstream.ok }, { status: upstream.status });
  const cookie = upstream.headers.get("set-cookie");
  if (cookie) response.headers.set("set-cookie", cookie);
  return response;
}
