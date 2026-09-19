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
  department: "PURCHASE" | "SALES" | "ACCOUNTS_BILLING" | "WAREHOUSE" | "DEMO" | null;
  dataScope: "OWN" | "TEAM" | "DEPARTMENT" | "COMPANY";
  manager: { id: string; name: string } | null;
  roles: Array<{ key: string; name: string }>;
  permissions: string[];
  portal: PortalType;
  dashboardPath: string;
  profile: {
    employeeCode: string;
    mobile: string;
    jobTitle: string;
    employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
    joiningDate: string;
    dateOfBirth: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    bloodGroup: string | null;
    workLocation: string | null;
    residentialAddress: string | null;
    emergencyContactName: string | null;
    emergencyContactMobile: string | null;
  } | null;
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
