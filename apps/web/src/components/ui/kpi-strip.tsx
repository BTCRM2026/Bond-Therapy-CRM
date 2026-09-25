import { cn } from "@/lib/utils";

const COLUMN_CLASSES = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
  7: "sm:grid-cols-4 lg:grid-cols-7",
} as const;

export function KpiStrip({ children, columns = 4, className }: { children: React.ReactNode; columns?: keyof typeof COLUMN_CLASSES; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border bg-border", COLUMN_CLASSES[columns], className)}>{children}</div>;
}

type KpiTone = "neutral" | "success" | "warning" | "danger" | "brand";
const TONE_TEXT: Record<KpiTone, string> = { neutral: "text-subtle", success: "text-success", warning: "text-warning", danger: "text-danger", brand: "text-brand" };

export function KpiCell({ label, value, detail, tone = "neutral", active = false, onClick, className: extraClassName }: { label: string; value: string | number; detail?: string; tone?: KpiTone; active?: boolean; onClick?: () => void; className?: string }) {
  const content = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[27px]">{value}</p>
      {detail && <p className={cn("mt-1 truncate text-xs", TONE_TEXT[tone])}>{detail}</p>}
    </>
  );
  const className = cn(
    "min-w-0 p-4 text-left transition-colors sm:p-5",
    active ? "bg-brand-soft/75" : "bg-white",
    onClick && "cursor-pointer hover:bg-brand-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
    extraClassName,
  );
  return onClick ? (
    <button type="button" className={className} onClick={onClick} aria-pressed={active}>{content}</button>
  ) : (
    <div className={className}>{content}</div>
  );
}
