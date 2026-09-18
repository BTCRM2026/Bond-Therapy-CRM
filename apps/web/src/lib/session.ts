import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roles: Array<{ key: string; name: string }>;
  dashboardPath: string;
};

export async function requireSession(): Promise<SessionUser> {
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/session`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
  } catch {
    redirect("/login");
  }
  if (!response.ok) redirect("/login");
  return (await response.json()) as SessionUser;
}

export async function serverApiFetch(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), cookie: cookieStore.toString() },
    cache: "no-store",
  });
}
