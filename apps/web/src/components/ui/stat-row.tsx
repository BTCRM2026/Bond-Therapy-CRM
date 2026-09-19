import { cn } from "@/lib/utils";

export type Stat = { label: string; value: string | number };

export function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  const columns = stats.length === 3 ? "sm:grid-cols-3" : stats.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2";
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-xl border bg-border", columns, className)}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="min-w-0 bg-white px-5 py-4"
        >
          <p className="text-xs font-medium text-muted">{stat.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
