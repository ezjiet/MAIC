import { ExternalLink, FileText } from "lucide-react";
import type { Citation } from "@/types/clarify";

function dateLabel(value?: string) {
  if (!value) return "Date not provided";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function CitationCard({ citation }: { citation: Citation }) {
  return (
    <article className="rounded-xl border border-[#cfdce8] bg-[#f6f9fc] p-3">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-[#2b65a5] shadow-sm"><FileText className="size-4" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e7c8e]">Official source</p>
          <h4 className="mt-0.5 text-[13px] font-bold text-[#10243e]">{citation.document_title}</h4>
          <p className="mt-1 text-[11px] text-[#65758a]">{citation.clause} · Effective: {dateLabel(citation.effective_date)}</p>
        </div>
        <a href={citation.source_url} target="_blank" rel="noopener noreferrer" aria-label={`View official source ${citation.document_title} (opens in new tab)`} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-[#245d98] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b65a5]">
          <span className="hidden sm:inline">View official source</span><ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
