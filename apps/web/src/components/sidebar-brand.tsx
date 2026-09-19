import Image from "next/image";

export function SidebarBrand() {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label="Bond Therapy Professional">
      <Image src="/brand/bond-therapy-molecule.png" alt="" width={386} height={404} priority className="h-9 w-auto shrink-0 object-contain" />
      <Image src="/brand/bond-therapy-wordmark.png" alt="" width={1480} height={300} priority className="h-[30px] w-auto min-w-0 object-contain" />
    </div>
  );
}
