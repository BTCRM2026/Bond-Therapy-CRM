import { proxyJson } from "@/lib/api-proxy";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyJson(request, `/notifications/${id}`, "PATCH");
}
