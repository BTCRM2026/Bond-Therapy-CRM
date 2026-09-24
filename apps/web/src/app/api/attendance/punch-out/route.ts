import { proxyToApi } from "@/lib/api-proxy";

export function POST(request: Request) {
  return proxyToApi(request, "/attendance/punch-out", { allowedPortals: ["STAFF"] });
}
