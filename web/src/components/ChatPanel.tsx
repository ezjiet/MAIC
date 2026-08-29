"use client";

import { ArrowUp, FileText, Info, Paperclip, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { ClarifyAvatar } from "@/components/ClarifyAvatar";
import { AnswerCard, ErrorState, LoadingState, RefusalState } from "@/components/ResponseStates";
import type { ApiErrorKind, AskResponse, ChatSession, UploadedAttachment } from "@/types/clarify";

const starters = ["KWSP house withdrawal", "Income tax filing", "Renew driving licence"];

interface ChatPanelProps {
  chat: ChatSession;
  query: string;
  loading: boolean;
  uploading: boolean;
  uploadError: string | null;
  attachments: UploadedAttachment[];
  needsReupload: boolean;
  errorKind: ApiErrorKind | null;
  focusedMessageId: string | null;
  savedMessageIds: Set<string>;
  onQueryChange: (query: string) => void;
  onSubmit: (query?: string) => void;
  onRetry: () => void;
  onToggleSave: (messageId: string) => void;
  onNewChat: () => void;
  onUpload: (file: File) => void;
  onRemoveAttachment: (attachmentId: string) => void;
}

export function ChatPanel({ chat, query, loading, uploading, uploadError, attachments, needsReupload, errorKind, focusedMessageId, savedMessageIds, onQueryChange, onSubmit, onRetry, onToggleSave, onNewChat, onUpload, onRemoveAttachment }: ChatPanelProps) {
  const conversationRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = loading || uploading;

  function submit(event: FormEvent) { event.preventDefault(); onSubmit(); }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); } }
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onUpload(file);
  }

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    const target = focusedMessageId ? conversation.querySelector<HTMLElement>(`[data-message-id="${focusedMessageId}"]`) : null;
    if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
    else conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length, loading, errorKind, focusedMessageId]);

  return (
    <section aria-labelledby="chat-title" aria-busy={busy} className="flex h-[610px] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[#d6e0e9] bg-white shadow-[0_18px_38px_-34px_rgba(16,36,62,0.6)] lg:h-full lg:min-h-0">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf0] px-4 py-3 sm:px-5"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#788697]">Clarify MY assistant</p><h2 id="chat-title" className="mt-0.5 truncate text-[15px] font-bold text-[#10243e]">{chat.title}</h2></div><button type="button" disabled={busy} onClick={onNewChat} aria-label="Start a new chat" className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#cfdbe6] bg-white px-2.5 text-[10px] font-extrabold text-[#315d85] transition hover:bg-[#f5f8fb] disabled:opacity-50"><Plus className="size-3.5" aria-hidden="true" />New Chat</button></div>

      <div ref={conversationRef} role="log" aria-label="Conversation messages" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] px-4 py-5 sm:px-6 sm:py-6">
        <div className={chat.messages.length === 0 ? "pt-4 sm:pt-7" : ""}><div className="flex items-start gap-3"><ClarifyAvatar /><div className="max-w-[88%] rounded-2xl rounded-tl-md border border-[#dae3eb] bg-white px-4 py-3 text-sm leading-6 text-[#42566e]"><p className="font-semibold text-[#10243e]">Hi! I’m Clarify MY.</p><p className="mt-1">Ask about KWSP, LHDN or JPJ—or attach a form and ask what a field means.</p></div></div>{chat.messages.length === 0 && <div className="ml-[52px] mt-3 flex flex-wrap gap-2">{starters.map((starter) => <button type="button" key={starter} disabled={busy} onClick={() => onSubmit(starter)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#d2dee9] bg-white px-3 text-xs font-semibold text-[#315d85] hover:bg-[#f5f9fc] disabled:opacity-60"><Sparkles className="size-3.5" aria-hidden="true" />{starter}</button>)}</div>}</div>

        {chat.messages.map((message, index) => {
          if (message.role === "user") return <div key={message.id} data-message-id={message.id} className="my-5 flex justify-end"><div className="max-w-[82%] rounded-2xl rounded-tr-md bg-[#173f66] px-4 py-3 text-sm leading-6 text-white"><p className="whitespace-pre-wrap break-words">{message.content}</p>{message.attachmentContext?.map((item, itemIndex) => <span key={`${message.id}-${itemIndex}`} className="mt-2 flex w-fit max-w-full items-center gap-1.5 rounded-lg bg-white/12 px-2 py-1 text-[10px] font-semibold"><FileText className="size-3" aria-hidden="true" /><span className="truncate">{item.form_name || item.form_code || "Attached form"}</span></span>)}</div></div>;
          const response: AskResponse = { answer: message.content, agency: message.agency ?? "UNCLEAR", status: message.status ?? "refused", citations: message.citations ?? [], recommended_forms: message.recommendedForms ?? [], suggested_follow_ups: message.suggestedFollowUps ?? [] };
          const isLastAssistant = !chat.messages.slice(index + 1).some((item) => item.role === "assistant");
          return <div key={message.id} data-message-id={message.id} className={`flex items-start gap-3 ${focusedMessageId === message.id ? "rounded-2xl ring-3 ring-[#2b65a5]/15" : ""}`}><ClarifyAvatar /><div className="min-w-0 flex-1">{response.status === "answered" ? <AnswerCard response={response} onFollowUp={onSubmit} showFollowUps={isLastAssistant && !loading} saved={savedMessageIds.has(message.id)} onToggleSave={() => onToggleSave(message.id)} /> : <RefusalState response={response} />}</div></div>;
        })}
        {loading && <div className="mt-5 flex items-start gap-3"><ClarifyAvatar /><div className="min-w-0 flex-1"><LoadingState attachment={attachments.length > 0} /></div></div>}
        {errorKind && !loading && <div className="mt-5 flex items-start gap-3"><ClarifyAvatar /><div className="min-w-0 flex-1"><ErrorState kind={errorKind} onRetry={onRetry} /></div></div>}
      </div>

      <form onSubmit={submit} className="border-t border-[#e5eaf0] bg-white p-3 sm:px-4 sm:py-3">
        {(attachments.length > 0 || uploading || uploadError || needsReupload) && <div className="mb-2 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">{attachments.map((item) => <span key={item.attachment_id} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#bfd3e3] bg-[#eef6fb] px-2 py-1 text-[10px] font-semibold text-[#245779]"><FileText className="size-3" aria-hidden="true" /><span className="max-w-48 truncate">{item.form_name || item.form_code || item.filename}</span><button type="button" onClick={() => onRemoveAttachment(item.attachment_id)} aria-label={`Remove ${item.form_name || "attached form"}`} className="grid size-5 place-items-center rounded hover:bg-[#dbeaf5]"><X className="size-3" aria-hidden="true" /></button></span>)}{uploading && <span role="status" className="rounded-lg border border-[#d7e1e9] bg-[#f8fafc] px-2 py-1 text-[10px] font-semibold text-[#66788b]">Reading form…</span>}</div>
          {uploadError && <p role="alert" className="text-[10px] font-semibold text-[#9a3345]">{uploadError}</p>}
          {needsReupload && attachments.length === 0 && <p className="text-[10px] font-semibold text-[#8a5a1d]">This chat used a temporary form. Please attach it again to ask another form-specific question.</p>}
        </div>}
        <div className="flex items-end gap-2 rounded-xl border border-[#cfd9e4] bg-white p-1.5 focus-within:border-[#2b65a5] focus-within:ring-3 focus-within:ring-[#2b65a5]/10">
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={chooseFile} className="sr-only" aria-label="Attach a government form" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || attachments.length >= 3} aria-label="Attach a PDF, JPG or PNG form" title="Attach form (PDF, JPG or PNG; max 10 MB)" className="grid size-10 shrink-0 place-items-center rounded-lg text-[#557087] hover:bg-[#edf3f7] disabled:opacity-40"><Paperclip className="size-4" aria-hidden="true" /></button>
          <label htmlFor="question" className="sr-only">Ask about KWSP, LHDN or JPJ</label><textarea id="question" rows={1} maxLength={500} value={query} disabled={busy} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={keyDown} placeholder={attachments.length ? "Ask what a field means..." : "Ask about KWSP, LHDN or JPJ..."} className="min-h-10 max-h-24 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-5 text-[#10243e] outline-none placeholder:text-[#8b97a5]" />
          <button type="submit" disabled={!query.trim() || busy} aria-label="Send question" className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#1e609b] text-white hover:bg-[#173f66] disabled:cursor-not-allowed disabled:bg-[#a8b8c9]"><ArrowUp className="size-4" aria-hidden="true" /></button>
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#7b8796]"><Info className="size-3" aria-hidden="true" />Files are processed temporarily and not saved in chat history. Clarify MY explains forms but never fills them.</p>
      </form>
    </section>
  );
}
