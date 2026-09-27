import { proxyToDistributorApi } from "@/lib/distributor-api-proxy";

export function GET(request: Request) {
  return proxyToDistributorApi(request, "/distributors/me/network");
}
