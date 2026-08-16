import { ArrowUpRight, TrendingUp } from "lucide-react";
import { AgencyBadge } from "@/components/AgencyBadge";
import { topQuestions } from "@/data/faq";

export function FrequentlyAsked({ onSelect, disabled }: { onSelect: (query: string) => void; disabled: boolean }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="flex h-[330px] min-h-0 flex-col rounded-2xl border border-[#dce3eb] bg-white p-3.5 shadow-[0_12px_30px_-28px_rgba(16,36,62,0.55)] lg:h-auto">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#788697]">Across Clarify MY</p><h2 id="faq-title" className="mt-0.5 flex items-center gap-2 text-sm font-bold text-[#10243e]"><TrendingUp className="size-4 text-[#2b65a5]" aria-hidden="true" />Frequently Asked</h2></div><span className="rounded-full bg-[#f0f4f7] px-2.5 py-1.5 text-[9px] font-bold text-[#65758a]">Top 3</span></div>
      <ol className="mt-3 grid min-h-0 flex-1 content-start gap-2">
        {topQuestions.map((item, index) => (
          <li key={item.id}>
            <button type="button" disabled={disabled} onClick={() => onSelect(item.question)} className="group flex min-h-[64px] w-full items-center gap-2.5 rounded-xl border border-[#e1e7ed] bg-[#fbfcfd] px-2.5 py-2 text-left transition hover:border-[#b8cadb] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] disabled:opacity-55">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-[11px] font-extrabold text-[#5c6d81] shadow-sm">{index + 1}</span>
              <span className="min-w-0 flex-1"><span className="line-clamp-2 text-[10.5px] font-semibold leading-4 text-[#10243e]">{item.question}</span><span className="mt-1 flex items-center gap-2"><AgencyBadge agency={item.agency} /><span className="text-[9px] text-[#7a8797]">{item.askCount}</span></span></span>
              <ArrowUpRight className="size-3.5 shrink-0 text-[#7c8998] transition group-hover:text-[#2b65a5]" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
