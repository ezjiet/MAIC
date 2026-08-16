import { Bookmark, BookOpenCheck, CircleAlert, RefreshCw, Search, ShieldQuestion } from "lucide-react";
import { AgencyBadge } from "@/components/AgencyBadge";
import { CitationCard } from "@/components/CitationCard";
import type { ApiErrorKind, AskResponse } from "@/types/clarify";

export function LoadingState() {
  return (
    <div role="status" className="max-w-[88%] rounded-2xl rounded-tl-md border border-[#d8e4ef] bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-[#173c67]"><Search className="size-4 animate-pulse" aria-hidden="true" />Checking official sources...</p>
      <div className="mt-3 grid gap-2 text-xs text-[#68788c] sm:grid-cols-3">
        <span>Understanding your question</span><span>Searching public sources</span><span>Preparing a clear answer</span>
      </div>
    </div>
  );
}

const followUps = {
  KWSP: ["How much can I withdraw?", "What documents do I need?", "Who is eligible?"],
  LHDN: ["What income is taxable?", "Which tax reliefs can I claim?", "When is the filing deadline?"],
  JPJ: ["What documents do I need?", "Can I renew online?", "What if it expired long ago?"],
  UNCLEAR: [],
};

export function AnswerCard({ response, onFollowUp, saved = false, onToggleSave, showFollowUps = true }: { response: AskResponse; onFollowUp: (query: string) => void; saved?: boolean; onToggleSave?: () => void; showFollowUps?: boolean }) {
  const heading = response.agency === "KWSP" ? "Yes, you may be eligible for Housing Withdrawal." : response.agency === "LHDN" ? "Your tax obligation depends on your chargeable income." : "You can usually renew through an official JPJ channel.";
  return (
    <article className="response-enter max-w-[92%] rounded-2xl rounded-tl-md border border-[#d8e4ef] bg-white p-4 shadow-[0_10px_25px_-23px_rgba(16,36,62,0.5)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#26814d]"><BookOpenCheck className="size-4" aria-hidden="true" />Grounded in official sources</span><AgencyBadge agency={response.agency} /><span className="rounded-full bg-[#fff7e5] px-2 py-1 text-[10px] font-bold text-[#8b681f]">Demo answer</span></div>
        {onToggleSave && <button type="button" onClick={onToggleSave} aria-pressed={saved} aria-label={saved ? "Saved — remove bookmark" : "Save answer"} title={saved ? "Saved" : "Save answer"} className={`grid size-8 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] ${saved ? "border-[#b7cee2] bg-[#eaf2fa] text-[#174f83]" : "border-[#d9e1e8] bg-white text-[#718094] hover:bg-[#f4f7f9]"}`}><Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} aria-hidden="true" /></button>}
      </div>
      <h3 className="mt-3 text-[15px] font-bold leading-6 text-[#10243e]">{heading}</h3>
      <p className="mt-2 text-sm leading-6 text-[#52647a]">{response.answer}</p>
      <div className="mt-3 space-y-2">{response.citations.map((citation) => <CitationCard key={`${citation.source_url}-${citation.clause}`} citation={citation} />)}</div>
      {showFollowUps && <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Suggested follow-up questions">
        {followUps[response.agency].map((question) => <button key={question} type="button" onClick={() => onFollowUp(question)} className="min-h-8 rounded-full border border-[#d5e0e9] bg-white px-3 text-[10px] font-bold text-[#315d85] transition hover:border-[#8aabc8] hover:bg-[#f4f8fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c]">{question}</button>)}
      </div>}
    </article>
  );
}

export function RefusalState({ response }: { response: AskResponse }) {
  return (
    <div className="response-enter max-w-[88%] rounded-2xl rounded-tl-md border border-[#dfe4e9] bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-[#10243e]"><ShieldQuestion className="size-4 text-[#607087]" aria-hidden="true" />I don’t have enough source support</p>
      <p className="mt-2 text-sm leading-6 text-[#5e6f83]">{response.answer}</p>
      <p className="mt-2 text-xs font-semibold text-[#788697]">Clarify MY avoids answering when there isn’t enough official-source support.</p>
    </div>
  );
}

export function ErrorState({ kind, onRetry }: { kind: ApiErrorKind; onRetry: () => void }) {
  const details: Record<ApiErrorKind, string> = { network: "We couldn’t connect to the service.", unavailable: "The answer service is temporarily unavailable.", malformed: "The response could not be read safely." };
  return (
    <div role="alert" className="max-w-[88%] rounded-2xl rounded-tl-md border border-[#efd6da] bg-[#fffafb] p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-[#7c2938]"><CircleAlert className="size-4" aria-hidden="true" />Something went wrong while checking the sources.</p>
      <p className="mt-1 text-xs text-[#6c5b61]">{details[kind]}</p>
      <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#173c67] px-3 text-[11px] font-bold text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#2b65a5]/30"><RefreshCw className="size-3.5" aria-hidden="true" />Retry</button>
    </div>
  );
}
