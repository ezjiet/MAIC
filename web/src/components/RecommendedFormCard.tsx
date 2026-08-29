import { Download, ExternalLink, FileCheck2 } from "lucide-react";
import { AgencyBadge } from "@/components/AgencyBadge";
import type { RecommendedForm } from "@/types/clarify";

export function RecommendedFormCard({ form }: { form: RecommendedForm }) {
  return (
    <article className="rounded-xl border border-[#cfdde8] bg-[#f8fbfd] p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e5f0f8] text-[#205b8f]"><FileCheck2 className="size-4" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h4 className="text-xs font-extrabold text-[#17334f]">{form.form_name}</h4><AgencyBadge agency={form.agency} /></div>
          {form.form_code && <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#667a8e]">{form.form_code}</p>}
          {form.reason && <p className="mt-1 text-[11px] leading-4 text-[#5d7185]">{form.reason}</p>}
          {(form.source_url || form.download_url) && <div className="mt-2 flex flex-wrap gap-2">
            {form.source_url && <a href={form.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[#1e609b] px-2.5 text-[10px] font-bold text-white hover:bg-[#174c78]"><ExternalLink className="size-3.5" aria-hidden="true" />View Official Form</a>}
            {form.download_url && <a href={form.download_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#c7d6e2] bg-white px-2.5 text-[10px] font-bold text-[#315d85]"><Download className="size-3.5" aria-hidden="true" />Download Form</a>}
          </div>}
        </div>
      </div>
    </article>
  );
}
