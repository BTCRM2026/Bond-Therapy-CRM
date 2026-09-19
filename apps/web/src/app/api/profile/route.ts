import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";

export async function PATCH(request: Request) {
  try {
    const portal = portalFromRequest(request);
    if (!portal) return NextResponse.json({ message: "Unknown portal." }, { status: 400 });
    const upstream = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/auth/profile`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal },
      body: await request.text(),
      cache: "no-store",
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ message: "Profile service is temporarily unavailable." }, { status: 503 });
  }
}
