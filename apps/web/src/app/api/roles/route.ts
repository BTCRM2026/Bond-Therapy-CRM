import { proxyJson } from "@/lib/api-proxy";

export async function GET(request: Request) {
  return proxyJson(request, "/roles", "GET");
}
