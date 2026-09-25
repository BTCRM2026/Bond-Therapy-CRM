"use client";

import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormActions({ saving, disabled, onClose, label = "Save" }: { saving: boolean; disabled?: boolean; onClose: () => void; label?: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      <Button type="submit" disabled={saving || disabled}>
        {saving && <LoaderCircle className="animate-spin" size={16} />}
        {saving ? "Saving…" : label}
      </Button>
    </div>
  );
}
