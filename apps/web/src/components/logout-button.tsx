"use client";

import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const isDistributor = pathname?.startsWith("/distributor") ?? false;
  return (
    <Button aria-label="Sign out" className="h-9 w-full justify-start border-0 bg-transparent px-2.5 text-muted shadow-none hover:bg-background hover:text-foreground" variant="secondary" onClick={async () => { await fetch(isDistributor ? "/api/distributor/auth/logout" : "/api/auth/logout", { method: "POST" }); router.replace(isDistributor ? "/distributor/login" : "/login"); router.refresh(); }}>
      <LogOut size={16} /> <span>Sign out</span>
    </Button>
  );
}
