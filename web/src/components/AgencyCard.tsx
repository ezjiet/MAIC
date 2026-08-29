import Image from "next/image";
import { agencyDetails } from "@/lib/agencies";
import type { Agency } from "@/types/clarify";

export function AgencyCard({ agency, compact = false }: { agency: Exclude<Agency, "MULTI" | "UNCLEAR">; compact?: boolean }) {
  const detail = agencyDetails[agency];

  return (
    <article
      aria-label={`${detail.name}: ${detail.description}`}
      className={`flex w-full cursor-default items-center border text-left ${compact ? "min-h-[68px] gap-2.5 rounded-xl px-2.5 py-2" : "min-h-[82px] gap-3 rounded-2xl px-4 py-3"}`}
      style={{ background: detail.tint, borderColor: detail.border }}
    >
      <span className={`grid shrink-0 place-items-center border border-black/[0.04] bg-white shadow-sm ${compact ? "size-11 rounded-xl" : "size-14 rounded-2xl"}`}>
        <Image src={detail.logo} alt={`${agency} official logo`} width={52} height={52} className={compact ? "size-9 object-contain" : "size-11 object-contain"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-bold text-[#10243e] ${compact ? "text-xs" : "text-sm"}`}>{detail.name}</span>
        <span className={`mt-0.5 block truncate text-[#68788c] ${compact ? "text-[9.5px]" : "text-[11px]"}`}>{detail.description}</span>
      </span>
    </article>
  );
}
