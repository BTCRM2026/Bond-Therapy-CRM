import Image from "next/image";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/brand/bond-therapy-logo.png"
      alt="Bond Therapy Professional"
      width={185}
      height={95}
      className={`h-auto w-[150px] object-contain sm:w-[165px] ${className}`}
    />
  );
}
