import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-[0_1px_2px_rgba(23,32,51,0.025)]">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="border-b bg-[#fafbfc]" {...props} />;
}

export function TBody({ ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-border" {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-[#fafbff]", className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("h-11 px-4 text-xs font-semibold text-muted", className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3.5 align-middle text-[13.5px] text-foreground", className)} {...props} />;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-14 text-center">
      <p className="text-sm font-medium text-foreground">Nothing here yet</p>
      <p className="text-xs text-muted">{message}</p>
    </div>
  );
}
