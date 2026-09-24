import { proxyToApi } from "@/lib/api-proxy";

export function POST(request: Request) {
  return proxyToApi(request, "/attendance/punch-in", { allowedPortals: ["STAFF"] });
}
