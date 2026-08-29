import { ExternalLink, FileText } from "lucide-react";
import type { Citation } from "@/types/clarify";

/**
 * Compact source pill. Shows the PDF filename and page. Clicking opens the
 * actual PDF in a new tab, jumping to the cited page.
 */
export function CitationCard({ citation }: { citation: Citation }) {
  const hasLink = citation.source_url && citation.source_url !== "#";
  const content = (
    <>
      <FileText className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{citation.document_title}</span>
      {citation.section && (
        <span className="text-[10px] text-[#7a8a9e]">· {citation.section}</span>
      )}
      {hasLink && <ExternalLink className="size-3 shrink-0 text-[#7a8a9e]" aria-hidden="true" />}
    </>
  );
  const className =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#d5e0e9] bg-[#f6f9fc] px-2.5 py-1 text-[11px] font-medium text-[#345070] hover:bg-white hover:border-[#8aabc8] transition";
  return hasLink ? (
    <a href={citation.source_url} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}
