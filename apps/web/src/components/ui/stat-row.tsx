import { cn } from "@/lib/utils";

export type Stat = { label: string; value: string | number };

export function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-stretch rounded-xl border bg-white", className)}>
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={cn("min-w-[140px] flex-1 px-5 py-4", index > 0 && "border-l border-border")}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{stat.label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
