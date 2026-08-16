import { ArrowRight, Bookmark, Trash2 } from "lucide-react";
import { AgencyBadge } from "@/components/AgencyBadge";
import type { SavedAnswer } from "@/types/clarify";

function formatSavedAt(value: string) {
  const savedAt = new Date(value);
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - savedAt.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Saved just now";
  if (elapsedMinutes < 60) return `Saved ${elapsedMinutes}m ago`;
  if (savedAt.toDateString() === new Date().toDateString()) return `Saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return `Saved ${savedAt.toLocaleDateString([], { day: "numeric", month: "short" })}`;
}

export function SavedAnswers({ items, ready, disabled, onOpen, onRemove }: { items: SavedAnswer[]; ready: boolean; disabled: boolean; onOpen: (item: SavedAnswer) => void; onRemove: (messageId: string) => void }) {
  return (
    <section id="saved" aria-labelledby="saved-title" className="overflow-hidden rounded-2xl border border-[#dce4eb] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#e8edf2] px-4 py-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#7c8998]">Bookmarked for later</p>
          <h2 id="saved-title" className="mt-1 flex items-center gap-2 text-sm font-extrabold text-[#10243e]"><Bookmark className="size-4 text-[#28659c]" aria-hidden="true" />Saved Answers</h2>
        </div>
        {items.length > 3 && <span className="text-[10px] font-bold text-[#61758a]">Latest 3</span>}
      </div>
      <div className="p-3">
        {!ready ? <p className="py-4 text-center text-xs text-[#7b8796]">Loading saved answers…</p> : items.length === 0 ? (
          <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed border-[#d5dee7] bg-[#fafcfd] px-4 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#edf3f8] text-[#75889c]"><Bookmark className="size-4" aria-hidden="true" /></span><div><p className="text-[11px] font-bold text-[#506379]">No saved answers yet</p><p className="mt-0.5 text-[10px] leading-4 text-[#8692a0]">Bookmark useful answers to find them quickly later.</p></div></div>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 3).map((item) => (
              <li key={item.id} className="rounded-xl border border-[#e0e6ec] bg-[#fbfcfd] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <AgencyBadge agency={item.agency} />
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" disabled={disabled} onClick={() => onOpen(item)} aria-label={`Open saved answer: ${item.query}`} className="grid size-7 place-items-center rounded-lg text-[#75879a] transition hover:bg-[#edf3f8] hover:text-[#315d85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] disabled:opacity-60"><ArrowRight className="size-3.5" aria-hidden="true" /></button>
                    <button type="button" disabled={disabled} onClick={() => onRemove(item.messageId)} aria-label={`Delete saved answer: ${item.query}`} className="grid size-7 place-items-center rounded-lg text-[#8592a0] transition hover:bg-[#fff0f2] hover:text-[#934052] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94b5c] disabled:opacity-60"><Trash2 className="size-3.5" aria-hidden="true" /></button>
                  </div>
                </div>
                <button type="button" disabled={disabled} onClick={() => onOpen(item)} aria-label={`Open saved answer details: ${item.query}`} className="mt-1.5 block w-full rounded-lg px-0.5 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] disabled:opacity-60">
                  <span className="line-clamp-2 text-[11px] font-bold leading-4 text-[#213b55]">{item.query}</span>
                  <span className="mt-1 block text-[9px] text-[#7f8b99]">{formatSavedAt(item.savedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
