import { NextResponse } from "next/server";
import { PORTAL_HEADER, portalFromRequest } from "@/lib/portal";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const portal = portalFromRequest(request);
    if (portal !== "STAFF" && portal !== "ADMIN")
      return NextResponse.json(
        { message: "Order forms are not available from this portal." },
        { status: 403 },
      );
    const { id } = await context.params;
    const upstream = await fetch(
      `${API}/orders/${encodeURIComponent(id)}/order-form.pdf`,
      {
        headers: {
          cookie: request.headers.get("cookie") ?? "",
          [PORTAL_HEADER]: portal,
        },
        cache: "no-store",
      },
    );
    if (!upstream.ok)
      return NextResponse.json(
        { message: "Could not prepare this order form." },
        { status: upstream.status },
      );
    return new NextResponse(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition":
          upstream.headers.get("content-disposition") ??
          "attachment; filename=order-form.pdf",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Order form service is temporarily unavailable." },
      { status: 503 },
    );
  }
}
