import { cn } from "@/lib/utils";

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("grid size-9 place-items-center rounded-lg bg-brand text-sm font-bold text-white", inverse && "bg-white text-brand-dark")}>BT</div>
      <div>
        <p className={cn("text-sm font-semibold tracking-tight text-foreground", inverse && "text-white")}>Bond Therapy</p>
        <p className={cn("text-[11px] text-muted", inverse && "text-white/65")}>Business Operations CRM</p>
      </div>
    </div>
  );
}

