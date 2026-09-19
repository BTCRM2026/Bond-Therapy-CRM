import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_HEADER, requestPortal, type PortalType } from "@/lib/portal";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export type SessionUser = {
  id: string;
  name: string;
  loginId: string;
  email: string;
  status: string;
  roles: Array<{ key: string; name: string }>;
  permissions: string[];
  portal: PortalType;
  dashboardPath: string;
};

export async function requireSession(expectedPortal?: PortalType): Promise<SessionUser> {
  const portal = await requestPortal();
  if (!portal) redirect("/login");
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/session`, {
      headers: { cookie: cookieStore.toString(), [PORTAL_HEADER]: portal },
      cache: "no-store",
    });
  } catch {
    redirect("/login");
  }
  if (!response.ok) redirect("/login");
  const user = (await response.json()) as SessionUser;
  if (user.portal !== portal || (expectedPortal && user.portal !== expectedPortal)) redirect("/dashboard");
  return user;
}

export function requireAdminSession() {
  return requireSession("ADMIN");
}
