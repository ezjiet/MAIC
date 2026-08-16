import { Clock3, MessageSquareText, Trash2 } from "lucide-react";
import { AgencyBadge } from "@/components/AgencyBadge";
import type { HistoryItem } from "@/types/clarify";

function timeLabel(value: string) {
  const date = new Date(value); const now = new Date(); if (Number.isNaN(date.getTime())) return "Recently";
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
  if (days <= 0) return new Intl.DateTimeFormat("en-MY", { hour: "numeric", minute: "2-digit" }).format(date);
  if (days === 1) return "Yesterday"; return `${days} days ago`;
}

export function RecentHistory({ history, ready, onSelect, onClear }: { history: HistoryItem[]; ready: boolean; onSelect: (item: HistoryItem) => void; onClear: () => void }) {
  return (
    <section id="history" aria-labelledby="history-title" aria-busy={!ready} className="flex h-[300px] min-h-0 flex-col rounded-2xl border border-[#dce3eb] bg-white p-3.5 shadow-[0_12px_30px_-28px_rgba(16,36,62,0.55)] lg:h-auto">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#788697]">Saved on this device</p><h2 id="history-title" className="mt-0.5 flex items-center gap-2 text-sm font-bold text-[#10243e]"><Clock3 className="size-4 text-[#2b65a5]" aria-hidden="true" />Recent History</h2></div><button type="button" onClick={onClear} disabled={history.length === 0} aria-label="Clear recent history" className="grid size-9 place-items-center rounded-lg text-[#7a8797] hover:bg-[#fff4f5] hover:text-[#9f2942] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f2942] disabled:opacity-40"><Trash2 className="size-3.5" aria-hidden="true" /></button></div>
      {!ready ? (
        <div className="mt-3 min-h-[150px] flex-1 animate-pulse rounded-xl border border-[#e1e7ed] bg-[#f5f7f9]" aria-label="Loading recent history" />
      ) : history.length === 0 ? (
        <div className="mt-3 grid min-h-[150px] flex-1 place-items-center rounded-xl border border-dashed border-[#d8e0e8] bg-[#fafbfc] p-4 text-center"><div><span className="mx-auto grid size-9 place-items-center rounded-full bg-white text-[#7890a8] shadow-sm"><MessageSquareText className="size-4" aria-hidden="true" /></span><p className="mt-2 text-xs font-semibold text-[#4f6176]">No recent questions yet</p><p className="mt-1 text-[10px] text-[#7b8796]">Your recent questions will appear here.</p></div></div>
      ) : (
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {history.slice(0, 5).map((item) => <li key={item.id}><button type="button" onClick={() => onSelect(item)} className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-[#e1e7ed] px-3 py-2 text-left hover:bg-[#fafcfd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b65a5]"><MessageSquareText className="size-4 shrink-0 text-[#6d7d90]" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] font-semibold text-[#10243e]">{item.query}</span><span className="mt-1 flex items-center gap-2"><AgencyBadge agency={item.agency} /><span className="text-[9px] text-[#7a8797]">{timeLabel(item.createdAt)}</span></span></span></button></li>)}
        </ul>
      )}
    </section>
  );
}
