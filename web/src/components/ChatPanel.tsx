"use client";

import { ArrowUp, Info, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { ClarifyAvatar } from "@/components/ClarifyAvatar";
import { AnswerCard, ErrorState, LoadingState, RefusalState } from "@/components/ResponseStates";
import type { ApiErrorKind, AskResponse, ChatSession } from "@/types/clarify";

const starters = ["KWSP house withdrawal", "Income tax filing", "Renew driving licence"];

interface ChatPanelProps {
  chat: ChatSession;
  query: string;
  loading: boolean;
  errorKind: ApiErrorKind | null;
  focusedMessageId: string | null;
  savedMessageIds: Set<string>;
  onQueryChange: (query: string) => void;
  onSubmit: (query?: string) => void;
  onRetry: () => void;
  onToggleSave: (messageId: string) => void;
  onNewChat: () => void;
}

export function ChatPanel({ chat, query, loading, errorKind, focusedMessageId, savedMessageIds, onQueryChange, onSubmit, onRetry, onToggleSave, onNewChat }: ChatPanelProps) {
  const conversationRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    const target = focusedMessageId
      ? conversation.querySelector<HTMLElement>(`[data-message-id="${focusedMessageId}"]`)
      : null;
    if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
    else conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length, loading, errorKind, focusedMessageId]);

  return (
    <section aria-labelledby="chat-title" aria-busy={loading} className="flex h-[610px] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[#d6e0e9] bg-white shadow-[0_18px_38px_-34px_rgba(16,36,62,0.6)] lg:h-full lg:min-h-0">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf0] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#788697]">Clarify MY assistant</p>
          <h2 id="chat-title" className="mt-0.5 truncate text-[15px] font-bold text-[#10243e]">{chat.title}</h2>
        </div>
        <button type="button" disabled={loading} onClick={onNewChat} aria-label="Start a new chat" className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#cfdbe6] bg-white px-2.5 text-[10px] font-extrabold text-[#315d85] transition hover:border-[#8eabc5] hover:bg-[#f5f8fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] disabled:cursor-wait disabled:opacity-50"><Plus className="size-3.5" aria-hidden="true" />New Chat</button>
      </div>

      <div ref={conversationRef} role="log" aria-label="Conversation messages" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] px-4 py-5 [scrollbar-color:#c8d2dd_transparent] sm:px-6 sm:py-6">
        <div className={chat.messages.length === 0 ? "pt-4 sm:pt-7" : ""}>
          <div className="flex items-start gap-3">
            <ClarifyAvatar />
            <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-[#dae3eb] bg-white px-4 py-3 text-sm leading-6 text-[#42566e] shadow-[0_8px_24px_-22px_rgba(16,36,62,0.6)]">
              <p className="font-semibold text-[#10243e]">Hi! I’m Clarify MY.</p>
              <p className="mt-1">Ask me anything about KWSP, LHDN or JPJ.</p>
            </div>
          </div>

          {chat.messages.length === 0 && (
            <div className="ml-[52px] mt-3 flex flex-wrap gap-2">
              {starters.map((starter) => <button type="button" key={starter} disabled={loading} onClick={() => onSubmit(starter)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#d2dee9] bg-white px-3 text-xs font-semibold text-[#315d85] transition hover:border-[#78a0c4] hover:bg-[#f5f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] disabled:cursor-wait disabled:opacity-60"><Sparkles className="size-3.5" aria-hidden="true" />{starter}</button>)}
            </div>
          )}
        </div>

        {chat.messages.map((message, index) => {
          if (message.role === "user") {
            return <div key={message.id} data-message-id={message.id} className="my-5 flex justify-end"><div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-[#173f66] px-4 py-3 text-sm leading-6 text-white shadow-[0_8px_20px_-16px_rgba(16,36,62,0.7)]">{message.content}</div></div>;
          }

          const response: AskResponse = {
            answer: message.content,
            agency: message.agency ?? "UNCLEAR",
            status: message.status ?? "refused",
            citations: message.citations ?? [],
          };
          const isLastAssistant = !chat.messages.slice(index + 1).some((item) => item.role === "assistant");
          return (
            <div key={message.id} data-message-id={message.id} className={`flex items-start gap-3 ${focusedMessageId === message.id ? "rounded-2xl ring-3 ring-[#2b65a5]/15" : ""}`}>
              <ClarifyAvatar />
              <div className="min-w-0 flex-1">
                {response.status === "answered" ? (
                  <AnswerCard response={response} onFollowUp={onSubmit} showFollowUps={isLastAssistant && !loading} saved={savedMessageIds.has(message.id)} onToggleSave={() => onToggleSave(message.id)} />
                ) : <RefusalState response={response} />}
              </div>
            </div>
          );
        })}

        {loading && <div className="mt-5 flex items-start gap-3"><ClarifyAvatar /><div className="min-w-0 flex-1"><LoadingState /></div></div>}
        {errorKind && !loading && <div className="mt-5 flex items-start gap-3"><ClarifyAvatar /><div className="min-w-0 flex-1"><ErrorState kind={errorKind} onRetry={onRetry} /></div></div>}
      </div>

      <form onSubmit={submit} className="border-t border-[#e5eaf0] bg-white p-3 sm:px-4 sm:py-3">
        <div className="flex items-end gap-2 rounded-xl border border-[#cfd9e4] bg-white p-1.5 transition focus-within:border-[#2b65a5] focus-within:ring-3 focus-within:ring-[#2b65a5]/10">
          <label htmlFor="question" className="sr-only">Ask about KWSP, LHDN or JPJ</label>
          <textarea id="question" rows={1} maxLength={500} value={query} disabled={loading} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={keyDown} placeholder="Ask about KWSP, LHDN or JPJ..." className="min-h-10 max-h-24 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-5 text-[#10243e] outline-none placeholder:text-[#8b97a5] disabled:cursor-wait" />
          <button type="submit" disabled={!query.trim() || loading} aria-label="Send question" className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#1e609b] text-white transition hover:bg-[#173f66] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#28659c]/30 disabled:cursor-not-allowed disabled:bg-[#a8b8c9]"><ArrowUp className="size-4" aria-hidden="true" /></button>
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#7b8796]"><Info className="size-3" aria-hidden="true" />Independent assistant. Verify important decisions on the linked official website.</p>
      </form>
    </section>
  );
}
