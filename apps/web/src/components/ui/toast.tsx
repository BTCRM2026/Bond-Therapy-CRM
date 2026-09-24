"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    const timer = window.setTimeout(onClose, 4000);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [message, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex justify-end sm:inset-x-auto sm:right-5 sm:top-5">
      <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-success/20 bg-white px-4 py-3 shadow-[0_12px_32px_rgba(23,35,31,0.14)]" role="status" aria-live="polite">
        <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-foreground">{message}</p>
        <button type="button" onClick={onClose} className="-mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25" aria-label="Dismiss notification">
          <X size={15} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
