"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageSizeMenu } from "@/components/ui/page-size-menu";

export function CompactPagination({ page, pageSize, total, hasMore, onPageChange, onPageSizeChange }: { page: number; pageSize: number; total: number; hasMore: boolean; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return <div className="flex h-10 w-full shrink-0 items-center rounded-lg border bg-white text-[13px] text-muted sm:w-auto">
    <span className="flex-1 whitespace-nowrap px-3 sm:flex-none">{first}–{last} <span className="text-subtle">of</span> {total}</span>
    <div className="border-l"><PageSizeMenu pageSize={pageSize} onSelect={onPageSizeChange} toolbar /></div>
    <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="grid h-[38px] w-10 place-items-center border-l text-muted transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-35" aria-label="Previous page"><ChevronLeft size={15} /></button>
    <button type="button" disabled={!hasMore} onClick={() => onPageChange(page + 1)} className="grid h-[38px] w-10 place-items-center rounded-r-[7px] border-l text-muted transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-35" aria-label="Next page"><ChevronRight size={15} /></button>
  </div>;
}
