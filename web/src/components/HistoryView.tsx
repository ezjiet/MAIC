import { Clock3, MessageSquareText, Trash2 } from "lucide-react";
import { AgencyBadge } from "@/components/AgencyBadge";
import { countQuestions } from "@/lib/history";
import type { Agency, ChatSession } from "@/types/clarify";

// History entries reopen complete ChatSessions, not individual messages.

function latestAgency(chat: ChatSession): Agency {
  return [...chat.messages].reverse().find((message) => message.role === "assistant")?.agency ?? "UNCLEAR";
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `Today · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function HistoryView({ chats, ready, clearDisabled, onOpen, onClear }: { chats: ChatSession[]; ready: boolean; clearDisabled: boolean; onOpen: (chat: ChatSession) => void; onClear: () => void }) {
  return (
    <section id="history" aria-labelledby="history-title" className="flex h-[610px] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[#d6e0e9] bg-white lg:h-full lg:min-h-0">
      <div className="flex items-center justify-between border-b border-[#e5eaf0] px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#788697]">Saved on this device</p>
          <h2 id="history-title" className="mt-1 flex items-center gap-2 text-base font-extrabold text-[#10243e]"><Clock3 className="size-4 text-[#28659c]" aria-hidden="true" />Conversation history</h2>
        </div>
        {chats.length > 0 && <button type="button" disabled={clearDisabled} onClick={onClear} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-[#7b3c48] hover:bg-[#fff2f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94b5c] disabled:opacity-50"><Trash2 className="size-3.5" aria-hidden="true" />Clear</button>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] p-4 sm:p-5">
        {!ready ? <p className="text-sm text-[#718094]">Loading conversations…</p> : chats.length === 0 ? (
          <div className="grid h-full min-h-60 place-items-center rounded-2xl border border-dashed border-[#d4dee8] bg-white px-6 text-center">
            <div><span className="mx-auto grid size-11 place-items-center rounded-full bg-[#eef4f8] text-[#53718f]"><MessageSquareText className="size-5" aria-hidden="true" /></span><p className="mt-3 text-sm font-bold text-[#31465e]">No conversations yet</p><p className="mt-1 text-xs leading-5 text-[#7b8796]">Your first chat will appear here after you ask a question.</p></div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {chats.map((chat) => {
              const questions = countQuestions(chat);
              return <li key={chat.id}><button type="button" onClick={() => onOpen(chat)} className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-[#dbe3ea] bg-white px-4 py-3 text-left transition hover:border-[#8eabc5] hover:bg-[#f7fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c]"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf4fa] text-[#2b6499]"><MessageSquareText className="size-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#17334f]">{chat.title}</span><span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#718094]"><span>{formatUpdatedAt(chat.updatedAt)}</span><span aria-hidden="true">·</span><span>{questions} {questions === 1 ? "question" : "questions"}</span><AgencyBadge agency={latestAgency(chat)} /></span></span></button></li>;
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
