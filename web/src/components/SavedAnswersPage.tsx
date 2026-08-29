"use client";

import { ArrowRight, Bookmark, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AgencyBadge } from "@/components/AgencyBadge";
import { MobileHeader, MobileNavigation } from "@/components/MobileHeader";
import { Sidebar } from "@/components/Sidebar";
import { Footer } from "@/components/Footer";
import { SupportedAgencies } from "@/components/SupportedAgencies";
import { getChats } from "@/lib/history";
import { formatSavedAt, getSavedAnswers, removeSavedAnswer } from "@/lib/saved";
import type { Agency, ChatSession, SavedAnswer } from "@/types/clarify";

type AgencyFilter = "ALL" | Exclude<Agency, "MULTI" | "UNCLEAR">;

const filters: { label: string; value: AgencyFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "KWSP", value: "KWSP" },
  { label: "LHDN", value: "LHDN" },
  { label: "JPJ", value: "JPJ" },
];

export function SavedAnswersPage() {
  const router = useRouter();
  const [items, setItems] = useState<SavedAnswer[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [query, setQuery] = useState("");
  const [agencyFilter, setAgencyFilter] = useState<AgencyFilter>("ALL");
  const [pendingDelete, setPendingDelete] = useState<SavedAnswer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(getSavedAnswers());
      setChats(getChats());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const chatById = useMemo(() => new Map(chats.map((chat) => [chat.id, chat])), [chats]);
  const normalizedQuery = query.trim().toLocaleLowerCase("en-MY");
  const filteredItems = useMemo(() => items.filter((item) => {
    if (agencyFilter !== "ALL" && item.agency !== agencyFilter) return false;
    if (!normalizedQuery) return true;
    const chatTitle = chatById.get(item.chatId)?.title ?? "";
    return [item.query, item.answer, item.agency, chatTitle].some((value) => value.toLocaleLowerCase("en-MY").includes(normalizedQuery));
  }), [agencyFilter, chatById, items, normalizedQuery]);

  const navigationProps = {
    activeView: "saved" as const,
    onOpenChat: () => router.push("/"),
    onOpenHistory: () => router.push("/?view=history"),
  };

  function openSavedAnswer(item: SavedAnswer) {
    if (!chatById.has(item.chatId)) return;
    const params = new URLSearchParams({ chatId: item.chatId, messageId: item.messageId });
    router.push(`/?${params.toString()}`);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    setItems((current) => removeSavedAnswer(current, pendingDelete.messageId));
    setPendingDelete(null);
  }

  function clearFilters() {
    setQuery("");
    setAgencyFilter("ALL");
  }

  const savedCountLabel = `${items.length} saved ${items.length === 1 ? "answer" : "answers"}`;

  return (
    <div className="min-h-screen w-full bg-[#f5f8fb] text-[#10243e] lg:h-screen lg:min-h-[680px] lg:overflow-hidden">
      <div className="min-h-screen w-full bg-white lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <MobileHeader />
        <Sidebar {...navigationProps} />

        <main className="min-w-0 bg-[#f5f8fb] px-4 py-6 sm:px-6 sm:py-8 lg:min-h-0 lg:overflow-y-auto lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[980px]">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b7e91]">Your Library</p>
                <h1 className="mt-1.5 text-[clamp(1.75rem,3vw,2.25rem)] font-extrabold tracking-[-0.04em] text-[#10243e]">Saved Answers</h1>
                <p className="mt-1.5 text-sm text-[#617286]">Keep useful Clarify MY responses easy to find and revisit.</p>
              </div>
              {ready && <span className="inline-flex min-h-8 w-fit items-center rounded-full border border-[#d7e1e9] bg-white px-3 text-[11px] font-bold text-[#607387]">{savedCountLabel}</span>}
            </header>

            {ready && items.length > 0 && (
              <section aria-label="Saved answer search and filters" className="mt-6 rounded-2xl border border-[#d6e0e9] bg-white p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <label htmlFor="saved-search" className="sr-only">Search saved answers</label>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7b8998]" aria-hidden="true" />
                    <input id="saved-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved answers..." className="min-h-10 w-full rounded-xl border border-[#cfdbe6] bg-[#fbfcfd] py-2 pl-9 pr-9 text-sm text-[#17334f] outline-none transition placeholder:text-[#8b97a5] focus:border-[#28659c] focus:ring-3 focus:ring-[#28659c]/10" />
                    {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear saved answer search" className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-[#7b8998] hover:bg-[#edf3f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c]"><X className="size-3.5" aria-hidden="true" /></button>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter saved answers by agency">
                    {filters.map((filter) => { const selected = agencyFilter === filter.value; return <button key={filter.value} type="button" onClick={() => setAgencyFilter(filter.value)} aria-pressed={selected} className={`min-h-9 rounded-full border px-3 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] ${selected ? "border-[#7fa3c3] bg-[#eaf2fa] text-[#164f86]" : "border-[#d7e0e8] bg-white text-[#66788b] hover:border-[#aebfce] hover:bg-[#f8fafc]"}`}>{filter.label}</button>; })}
                  </div>
                </div>
              </section>
            )}

            <section aria-labelledby="saved-results-title" className="mt-6">
              <h2 id="saved-results-title" className="sr-only">Saved answer results</h2>
              {!ready ? (
                <div className="rounded-2xl border border-[#dbe3ea] bg-white px-5 py-8 text-center text-sm text-[#718094]">Loading saved answers…</div>
              ) : items.length === 0 ? (
                <EmptySavedAnswers onOpenChat={() => router.push("/")} />
              ) : filteredItems.length === 0 ? (
                <NoSavedResults onClear={clearFilters} />
              ) : (
                <ul className="space-y-3">
                  {filteredItems.map((item) => {
                    const linkedChat = chatById.get(item.chatId);
                    return <SavedAnswerCard key={item.id} item={item} chatTitle={linkedChat?.title} available={Boolean(linkedChat)} onOpen={() => openSavedAnswer(item)} onDelete={() => setPendingDelete(item)} />;
                  })}
                </ul>
              )}
            </section>

            <div className="mt-8 border-t border-[#dfe6ed] bg-white px-3 pb-6 pt-6 sm:px-4 lg:hidden">
              <SupportedAgencies />
              <MobileNavigation {...navigationProps} />
            </div>
            <Footer />
          </div>
        </main>
      </div>

      {pendingDelete && <DeleteSavedDialog item={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />}
    </div>
  );
}

function SavedAnswerCard({ item, chatTitle, available, onOpen, onDelete }: { item: SavedAnswer; chatTitle?: string; available: boolean; onOpen: () => void; onDelete: () => void }) {
  return (
    <li className="rounded-2xl border border-[#dbe3ea] bg-white p-4 shadow-[0_12px_28px_-28px_rgba(16,36,62,0.65)] transition hover:border-[#b7c7d5] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <AgencyBadge agency={item.agency} />
          <span className="truncate text-[11px] font-semibold text-[#718094]">{chatTitle ?? "Original conversation unavailable"}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" disabled={!available} onClick={onOpen} aria-label={`Open saved answer: ${item.query}`} className="grid size-8 place-items-center rounded-lg text-[#74879a] transition hover:bg-[#edf3f8] hover:text-[#315d85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight className="size-4" aria-hidden="true" /></button>
          <button type="button" onClick={onDelete} aria-label={`Delete saved answer: ${item.query}`} className="grid size-8 place-items-center rounded-lg text-[#8592a0] transition hover:bg-[#fff0f2] hover:text-[#934052] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94b5c]"><Trash2 className="size-4" aria-hidden="true" /></button>
        </div>
      </div>
      <button type="button" disabled={!available} onClick={onOpen} aria-label={`Open saved answer details: ${item.query}`} className="mt-3 block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] disabled:cursor-default">
        <span className="block text-[14px] font-extrabold leading-5 text-[#17334f]">{item.query}</span>
        <span className="mt-2 line-clamp-3 block text-[12px] leading-5 text-[#607286]">{item.answer}</span>
        <span className="mt-2.5 block text-[10px] font-medium text-[#8592a0]">{formatSavedAt(item.savedAt)}</span>
      </button>
    </li>
  );
}

function EmptySavedAnswers({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-[#dbe3ea] bg-white px-6 py-10 text-center">
      <div><span className="mx-auto grid size-11 place-items-center rounded-full bg-[#edf3f8] text-[#56738f]"><Bookmark className="size-5" aria-hidden="true" /></span><h3 className="mt-3 text-sm font-extrabold text-[#31465e]">No saved answers yet</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#7b8796]">Bookmark useful Clarify MY answers to find them quickly later.</p><button type="button" onClick={onOpenChat} className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#1e609b] px-3 text-xs font-bold text-white transition hover:bg-[#173f66] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#28659c]/30">Go to Chat<ArrowRight className="size-3.5" aria-hidden="true" /></button></div>
    </div>
  );
}

function NoSavedResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="grid min-h-60 place-items-center rounded-2xl border border-[#dbe3ea] bg-white px-6 py-8 text-center">
      <div><Search className="mx-auto size-5 text-[#698096]" aria-hidden="true" /><h3 className="mt-3 text-sm font-extrabold text-[#31465e]">No matching saved answers</h3><p className="mt-1 text-xs text-[#7b8796]">Try changing your search or agency filter.</p><button type="button" onClick={onClear} className="mt-4 min-h-9 rounded-lg px-3 text-xs font-bold text-[#245d98] hover:bg-[#eef4f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c]">Clear filters</button></div>
    </div>
  );
}

function DeleteSavedDialog({ item, onCancel, onConfirm }: { item: SavedAnswer; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#10243e]/25 px-4 backdrop-blur-[1px]">
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-saved-title" aria-describedby="delete-saved-description" className="w-full max-w-sm rounded-2xl border border-[#d8e0e7] bg-white p-5 shadow-[0_24px_64px_-28px_rgba(16,36,62,0.55)]">
        <span className="grid size-9 place-items-center rounded-xl bg-[#fff0f2] text-[#934052]"><Trash2 className="size-4" aria-hidden="true" /></span>
        <h2 id="delete-saved-title" className="mt-3 text-base font-extrabold text-[#17334f]">Delete saved answer?</h2>
        <p id="delete-saved-description" className="mt-1.5 text-xs leading-5 text-[#687a8d]">This removes only the bookmark for “{item.query}”. The original conversation and History remain unchanged.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus onClick={onCancel} className="min-h-9 rounded-lg border border-[#d4dee7] px-3 text-xs font-bold text-[#5f7184] hover:bg-[#f7f9fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c]">Cancel</button>
          <button type="button" onClick={onConfirm} className="min-h-9 rounded-lg bg-[#8f3c4c] px-3 text-xs font-bold text-white hover:bg-[#75313f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#a94b5c]/30">Delete bookmark</button>
        </div>
      </div>
    </div>
  );
}
