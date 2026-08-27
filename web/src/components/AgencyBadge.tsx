import Image from "next/image";
import { agencyDetails } from "@/lib/agencies";
import type { Agency } from "@/types/clarify";

export function AgencyBadge({ agency }: { agency: Agency }) {
  const detail = agencyDetails[agency];
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: detail.tint, color: detail.accent }}>
      {detail.logo && <span className="grid size-5 place-items-center rounded-full bg-white"><Image src={detail.logo} alt="" width={18} height={18} className="size-[18px] object-contain" /></span>}
      {detail.name}
    </span>
  );
}
