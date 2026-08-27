import Image from "next/image";

export function ClarifyAvatar() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#d6e1ec] bg-white shadow-[0_5px_14px_-10px_rgba(12,46,89,0.65)]">
      <span className="relative flex size-full items-center justify-center overflow-hidden">
        <Image
          src="/brand/clarify-my-emblem-v2.png"
          alt="Clarify MY"
          width={1254}
          height={1254}
          className="size-[46px] max-w-none object-contain object-center"
        />
      </span>
    </span>
  );
}
