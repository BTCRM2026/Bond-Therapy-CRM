"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({ title, subtitle, onClose, children, maxWidth = "max-w-md" }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; maxWidth?: "max-w-md" | "max-w-lg" | "max-w-xl" | "max-w-2xl" | "max-w-4xl" }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`my-auto flex max-h-[calc(100dvh-24px)] w-full ${maxWidth} flex-col rounded-xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-32px)]`}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
