import { Bookmark, CircleAlert, RefreshCw, Search, ShieldQuestion } from "lucide-react";
import { AgencyBadge } from "@/components/AgencyBadge";
import { CitationCard } from "@/components/CitationCard";
import { Markdown } from "@/components/Markdown";
import { RecommendedFormCard } from "@/components/RecommendedFormCard";
import type { ApiErrorKind, AskResponse } from "@/types/clarify";

export function LoadingState({ attachment = false }: { attachment?: boolean }) {
  return (
    <div role="status" className="max-w-[88%] rounded-2xl rounded-tl-md border border-[#d8e4ef] bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-[#173c67]"><Search className="size-4 animate-pulse" aria-hidden="true" />{attachment ? "Reading the form and checking official sources..." : "Checking official sources..."}</p>
      <div className="mt-3 grid gap-2 text-xs text-[#68788c] sm:grid-cols-3"><span>Understanding your question</span><span>Searching public sources</span><span>Preparing clear guidance</span></div>
    </div>
  );
}

export function AnswerCard({ response, onFollowUp, saved = false, onToggleSave, showFollowUps = true }: { response: AskResponse; onFollowUp: (query: string) => void; saved?: boolean; onToggleSave?: () => void; showFollowUps?: boolean }) {
  return (
    <article className="response-enter max-w-[92%] rounded-2xl rounded-tl-md border border-[#d8e4ef] bg-white p-4 shadow-[0_10px_25px_-23px_rgba(16,36,62,0.5)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {response.citations.length === 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6b7788]"><CircleAlert className="size-4" aria-hidden="true" />General guidance — verify current details</span>
          )}
          <AgencyBadge agency={response.agency} />
        </div>
        {onToggleSave && <button type="button" onClick={onToggleSave} aria-pressed={saved} aria-label={saved ? "Saved — remove bookmark" : "Save answer"} title={saved ? "Saved" : "Save answer"} className={`grid size-8 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] ${saved ? "border-[#b7cee2] bg-[#eaf2fa] text-[#174f83]" : "border-[#d9e1e8] bg-white text-[#718094] hover:bg-[#f4f7f9]"}`}><Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} aria-hidden="true" /></button>}
      </div>
      <div className="mt-3"><Markdown>{response.answer}</Markdown></div>
      {response.citations.length > 0 && <div className="mt-3"><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e7c8e]">Sources</p><div className="flex flex-wrap gap-1.5">{response.citations.map((citation) => <CitationCard key={citation.id} citation={citation} />)}</div></div>}
      {response.recommended_forms.length > 0 && <section className="mt-4" aria-label="Recommended official forms"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e7c8e]">{response.recommended_forms.length === 1 ? "Recommended Form" : "Recommended Forms"}</p><div className="grid gap-2">{response.recommended_forms.map((form) => <RecommendedFormCard key={form.form_id} form={form} />)}</div></section>}
      {showFollowUps && response.suggested_follow_ups.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{response.suggested_follow_ups.map((item) => <button type="button" key={item} onClick={() => onFollowUp(item)} className="min-h-8 rounded-full border border-[#d2dee9] bg-white px-2.5 text-[10px] font-semibold text-[#315d85] hover:bg-[#f5f9fc]">{item}</button>)}</div>}
    </article>
  );
}

export function RefusalState({ response }: { response: AskResponse }) {
  return <div className="response-enter max-w-[88%] rounded-2xl rounded-tl-md border border-[#dfe4e9] bg-white p-4"><p className="flex items-center gap-2 text-sm font-bold text-[#10243e]"><ShieldQuestion className="size-4 text-[#607087]" aria-hidden="true" />I need a little more source support</p><div className="mt-2 text-[#5e6f83]"><Markdown>{response.answer}</Markdown></div><p className="mt-2 text-xs font-semibold text-[#788697]">Clarify MY will not guess or fill a form for you.</p></div>;
}

export function ErrorState({ kind, onRetry }: { kind: ApiErrorKind; onRetry: () => void }) {
  const details: Record<ApiErrorKind, string> = { network: "We couldn’t connect to the service.", unavailable: "The answer service is temporarily unavailable.", malformed: "The file or response could not be read safely.", attachment_expired: "The temporary attachment expired. Upload the form again before retrying." };
  return <div role="alert" className="max-w-[88%] rounded-2xl rounded-tl-md border border-[#efd6da] bg-[#fffafb] p-4"><p className="flex items-center gap-2 text-sm font-bold text-[#7c2938]"><CircleAlert className="size-4" aria-hidden="true" />Something went wrong while checking the sources.</p><p className="mt-1 text-xs text-[#6c5b61]">{details[kind]}</p><button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#173c67] px-3 text-[11px] font-bold text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#2b65a5]/30"><RefreshCw className="size-3.5" aria-hidden="true" />Retry</button></div>;
}
