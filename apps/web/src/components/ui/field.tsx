import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">
      {message}
    </p>
  );
}
