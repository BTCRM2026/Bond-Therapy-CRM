"use client";

import { Camera, CheckCircle2, LoaderCircle, RefreshCw, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { prepareImageFile } from "@/lib/invoice-file";
import { cn } from "@/lib/utils";

type Facing = "user" | "environment";
type Purpose = "VISIT_CHECK_IN" | "REPORT_CALL" | "EXCHANGE_ITEM";

function cameraMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access is blocked. Allow the camera for this site in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is in use by another app. Close it and try again.";
  return "Unable to open the camera.";
}

// Live camera only: there is deliberately no file picker, so a photo can only be one taken at that moment.
export function CameraCapture({ photo, existingUrl, purpose, scopeId, facing = "environment", label, hint, maxBytes = 8 * 1024 * 1024, onChange, onError }: { photo: File | null; existingUrl?: string; purpose: Purpose; scopeId?: string; facing?: Facing; label: string; hint?: string; maxBytes?: number; onChange: (file: File, captureToken: string) => void; onError: (message: string) => void }) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Facing>(facing);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  // One-time pass from the server, issued when the camera opens and sent along with the photo.
  const pass = useRef<string>("");
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const stop = () => { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setActive(false); };
  useEffect(() => () => { stream.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => {
    if (active && video.current && stream.current) { video.current.srcObject = stream.current; void video.current.play().catch(() => undefined); }
  }, [active]);

  const open = async (next: Facing) => {
    onError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { onError("The camera works only on a secure (HTTPS) connection on a device with a camera."); return; }
    setStarting(true);
    stream.current?.getTracks().forEach((track) => track.stop());
    try {
      const issued = await fetch("/api/captures", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose, scopeId }) });
      const issuedData = await issued.json().catch(() => null) as { token?: string } | null;
      if (!issued.ok || !issuedData?.token) throw new Error("pass");
      pass.current = issuedData.token;
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: next }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      setMode(next);
      setActive(true);
    } catch (cause) { onError(cause instanceof Error && cause.message === "pass" ? "The camera could not be started. Check your connection and try again." : cameraMessage(cause)); setActive(false); }
    finally { setStarting(false); }
  };

  const capture = async () => {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    setSaving(true);
    try {
      const scale = Math.min(1, 1280 / Math.max(element.videoWidth, element.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(element.videoWidth * scale);
      canvas.height = Math.round(element.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (!blob) { onError("The photo could not be captured. Please try again."); return; }
      const prepared = await prepareImageFile(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() }), 1280, 0.72, 300 * 1024);
      if (prepared.size > maxBytes) { onError("The photo is too large. Please retake it."); return; }
      onChange(prepared, pass.current);
      stop();
    } finally { setSaving(false); }
  };

  if (active) {
    return <div className="overflow-hidden rounded-xl border bg-foreground">
      <div className="relative aspect-[4/3] max-h-[58dvh] w-full bg-black">
        <video ref={video} playsInline muted autoPlay className={cn("size-full object-cover", mode === "user" && "-scale-x-100")} aria-label="Camera preview" />
      </div>
      <div className="flex items-center justify-between gap-3 bg-foreground px-4 py-3">
        <button type="button" onClick={stop} disabled={saving} className="grid size-11 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 disabled:opacity-50" aria-label="Close camera"><X size={20} /></button>
        <button type="button" onClick={capture} disabled={saving} className="grid size-16 place-items-center rounded-full border-4 border-white/90 bg-white/15 transition-transform active:scale-95 disabled:opacity-60" aria-label="Take photo">{saving ? <LoaderCircle className="animate-spin text-white" size={22} /> : <span className="size-11 rounded-full bg-white" />}</button>
        <button type="button" onClick={() => open(mode === "user" ? "environment" : "user")} disabled={saving || starting} className="grid size-11 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 disabled:opacity-50" aria-label="Switch camera"><RefreshCw size={19} /></button>
      </div>
    </div>;
  }

  const shown = preview || existingUrl;
  if (shown) {
    return <div className="grid gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[96px_1fr] sm:items-center">
      <div className="relative h-32 overflow-hidden rounded-lg bg-white sm:h-24"><Image src={shown} alt="Photo taken" fill sizes="96px" className="object-cover" unoptimized /></div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-success"><CheckCircle2 size={16} /><p className="text-sm font-semibold">Photo ready</p></div>
        {photo && <p className="mt-1 text-xs text-muted">Taken just now · {(photo.size / 1024).toFixed(0)} KB</p>}
        <button type="button" onClick={() => open(mode)} disabled={starting} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold text-foreground hover:bg-background disabled:opacity-60">{starting ? <LoaderCircle className="animate-spin" size={14} /> : <Camera size={14} />}Retake</button>
      </div>
    </div>;
  }

  return <button type="button" onClick={() => open(mode)} disabled={starting} className="block w-full rounded-xl border border-dashed bg-background p-5 text-center transition-colors hover:border-brand/40 hover:bg-brand-soft/20 disabled:opacity-70">
    <span className="mx-auto grid size-11 place-items-center rounded-full border bg-white text-brand">{starting ? <LoaderCircle className="animate-spin" size={20} /> : <Camera size={20} />}</span>
    <span className="mt-3 block text-sm font-semibold text-foreground">{starting ? "Opening camera…" : label}</span>
    <span className="mt-1 block text-xs text-muted">{hint ?? "Opens your camera. Photos from the gallery are not accepted."}</span>
  </button>;
}
