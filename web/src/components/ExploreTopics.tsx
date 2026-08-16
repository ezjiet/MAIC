import { Compass } from "lucide-react";
import { AgencyBadge } from "@/components/AgencyBadge";
import type { Agency } from "@/types/clarify";

const topics: { label: string; prompt: string; agency: Exclude<Agency, "UNCLEAR"> }[] = [
  { label: "Home Purchase", prompt: "Tell me about using KWSP savings for a home purchase.", agency: "KWSP" },
  { label: "Retirement Savings", prompt: "Tell me about KWSP retirement savings.", agency: "KWSP" },
  { label: "Income Tax", prompt: "Tell me about LHDN income tax.", agency: "LHDN" },
  { label: "Tax Relief", prompt: "Tell me about LHDN tax relief.", agency: "LHDN" },
  { label: "Licence Renewal", prompt: "Tell me about JPJ licence renewal.", agency: "JPJ" },
  { label: "Road Tax", prompt: "Tell me about JPJ road tax.", agency: "JPJ" },
];

// Topic selection submits to the currently viewed ChatSession.
export function ExploreTopics({ disabled, onSelect }: { disabled: boolean; onSelect: (question: string) => void }) {
  return (
    <section id="explore" aria-labelledby="explore-title" className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#dce4eb] bg-white">
      <div className="border-b border-[#e8edf2] px-4 py-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#7c8998]">What can I ask about?</p>
        <h2 id="explore-title" className="mt-1 flex items-center gap-2 text-sm font-extrabold text-[#10243e]"><Compass className="size-4 text-[#b48625]" aria-hidden="true" />Explore Topics</h2>
      </div>
      <ul className="grid min-h-0 flex-1 auto-rows-[76px] grid-cols-2 content-start gap-2 overflow-y-auto p-3">
        {topics.map((topic) => <li key={`${topic.agency}-${topic.label}`} className="h-full min-w-0"><button type="button" disabled={disabled} onClick={() => onSelect(topic.prompt)} aria-label={`Ask about ${topic.agency} ${topic.label}`} className="flex h-full w-full flex-col items-start justify-start gap-1.5 rounded-xl border border-[#e0e6ec] bg-[#fbfcfd] px-2.5 py-1.5 text-left transition hover:border-[#9eb4c8] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] disabled:cursor-wait disabled:opacity-60"><AgencyBadge agency={topic.agency} /><span className="line-clamp-2 text-[10.5px] font-extrabold leading-[14px] text-[#213b55]">{topic.label}</span></button></li>)}
      </ul>
    </section>
  );
}
