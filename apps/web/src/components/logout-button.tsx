"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button variant="secondary" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }}>
      <LogOut size={16} /> Sign out
    </Button>
  );
}

