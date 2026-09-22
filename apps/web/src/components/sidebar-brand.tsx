export function SidebarBrand() {
  return (
    <div className="flex min-w-0 items-center justify-center gap-3" aria-label="Bond Therapy Professional">
      <span aria-hidden className="h-[52px] w-12 shrink-0 bg-brand-dark [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]" style={{ maskImage: "url('/brand/bond-therapy-molecule.png')", WebkitMaskImage: "url('/brand/bond-therapy-molecule.png')" }} />
      <span aria-hidden className="h-9 w-[170px] min-w-0 shrink bg-foreground [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]" style={{ maskImage: "url('/brand/bond-therapy-wordmark.png')", WebkitMaskImage: "url('/brand/bond-therapy-wordmark.png')" }} />
    </div>
  );
}
