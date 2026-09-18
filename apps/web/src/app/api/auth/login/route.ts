import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const upstream = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
      cache: "no-store",
    });
    const response = new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
    const cookie = upstream.headers.get("set-cookie");
    if (cookie) response.headers.set("set-cookie", cookie);
    return response;
  } catch {
    return NextResponse.json({ message: "The login service is temporarily unavailable." }, { status: 503 });
  }
}
