import Image from "next/image";

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      src="/brand/clarify-my-logo.png"
      alt="Clarify MY — Ask, Understand, Act"
      width={1942}
      height={809}
      priority
      className={`h-auto object-contain object-left ${compact ? "w-[164px]" : "w-full max-w-[198px]"}`}
      unoptimized
    />
  );
}
