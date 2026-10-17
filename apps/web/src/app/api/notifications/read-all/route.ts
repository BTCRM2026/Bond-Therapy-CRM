import { proxyToApi } from "@/lib/api-proxy";

export const PATCH = (request: Request) => proxyToApi(request, "/notifications/read-all", { allowedPortals: ["ADMIN", "STAFF", "DISTRIBUTOR"] });
