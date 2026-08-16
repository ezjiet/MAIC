import { Building2 } from "lucide-react";
import { AgencyCard } from "@/components/AgencyCard";

export function SupportedAgencies({ compact = false }: { compact?: boolean }) {
  return (
    <section id={compact ? "agencies" : "mobile-agencies"} aria-labelledby={compact ? "agencies-title" : "mobile-agencies-title"}>
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#7b8796]">Coverage</p>
          <h2 id={compact ? "agencies-title" : "mobile-agencies-title"} className="mt-1 flex items-center gap-2 text-xs font-extrabold text-[#10243e]">
            <Building2 className="size-3.5 text-[#28659c]" aria-hidden="true" />Supported agencies
          </h2>
        </div>
        {!compact && <span className="text-[9px] text-[#7b8796]">No selection needed</span>}
      </div>
      <div className={compact ? "space-y-2" : "grid gap-2.5 sm:grid-cols-3"}>
        <AgencyCard agency="LHDN" compact={compact} />
        <AgencyCard agency="KWSP" compact={compact} />
        <AgencyCard agency="JPJ" compact={compact} />
      </div>
    </section>
  );
}
