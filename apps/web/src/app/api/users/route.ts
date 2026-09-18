import { proxyJson } from "@/lib/api-proxy";

export async function GET(request: Request) {
  return proxyJson(request, "/users", "GET");
}

export async function POST(request: Request) {
  return proxyJson(request, "/users", "POST");
}
