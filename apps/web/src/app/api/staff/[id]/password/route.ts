import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";

export async function POST(request: Request, { params }: RouteContext<"/api/staff/[id]/password">) {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "ADMIN") return NextResponse.json({ message: "This resource is only available in the Admin portal." }, { status: 403 });
    const { id } = await params;
    const upstream = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/users/${encodeURIComponent(id)}/password`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "", [PORTAL_HEADER]: portal },
      body: await request.text(),
      cache: "no-store",
    });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  } catch {
    return NextResponse.json({ message: "Password service is temporarily unavailable." }, { status: 503 });
  }
}
