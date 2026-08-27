"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Info, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { AgencyBadge } from "@/components/AgencyBadge";
import { MobileHeader, MobileNavigation } from "@/components/MobileHeader";
import { Sidebar } from "@/components/Sidebar";
import { Footer } from "@/components/Footer";
import { SupportedAgencies } from "@/components/SupportedAgencies";
import { faqSections, type FaqEntry } from "@/data/faq";
import { agencyDetails } from "@/lib/agencies";
import type { Agency } from "@/types/clarify";

const supportedAgencies: Exclude<Agency, "UNCLEAR">[] = ["KWSP", "LHDN", "JPJ"];

export function FaqPage() {
  const router = useRouter();
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());

  function toggleItem(itemId: string) {
    setOpenItems((items) => {
      const next = new Set(items);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const navigationProps = {
    activeView: "faq" as const,
    onOpenChat: () => router.push("/"),
    onOpenHistory: () => router.push("/?view=history"),
  };

  return (
    <div className="min-h-screen w-full bg-[#f5f8fb] text-[#10243e] lg:h-screen lg:min-h-[680px] lg:overflow-hidden">
      <div className="min-h-screen w-full bg-white lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <MobileHeader />
        <Sidebar {...navigationProps} />

        <main className="min-w-0 bg-[#f5f8fb] px-4 py-6 sm:px-6 sm:py-8 lg:min-h-0 lg:overflow-y-auto lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[940px]">
            <header>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b7e91]">Help &amp; Guidance</p>
              <h1 className="mt-1.5 text-[clamp(1.75rem,3vw,2.25rem)] font-extrabold tracking-[-0.04em] text-[#10243e]">Frequently Asked Questions</h1>
              <p className="mt-1.5 text-sm text-[#617286]">Everything you need to know about using Clarify MY.</p>
            </header>

            <section aria-label="Ask Clarify MY" className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#d6e0e9] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fa] text-[#28659c]"><MessageSquareText className="size-4" aria-hidden="true" /></span>
                <p className="text-[13px] leading-5 text-[#52667c]">Clarify MY helps make Malaysian public-service information easier to understand. If you cannot find what you need here, ask Clarify MY directly in Chat.</p>
              </div>
              <Link href="/" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-lg px-2.5 text-xs font-extrabold text-[#245d98] transition hover:bg-[#f2f7fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] sm:self-center">Ask Clarify MY<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            </section>

            <div className="mt-8 space-y-8">
              {faqSections.map((section) => (
                <section key={section.id} aria-labelledby={`${section.id}-title`}>
                  <h2 id={`${section.id}-title`} className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6b7e91]">{section.title}</h2>
                  <div className="space-y-2.5">
                    {section.items.map((item) => <FaqItem key={item.id} item={item} open={openItems.has(item.id)} onToggle={() => toggleItem(item.id)} />)}
                  </div>
                </section>
              ))}
            </div>

            <aside className="mt-8 flex items-start gap-3 rounded-2xl border border-[#d7e1e9] bg-[#eef4f8] px-4 py-4 text-[12px] leading-5 text-[#5d7084] sm:px-5">
              <Info className="mt-0.5 size-4 shrink-0 text-[#426b91]" aria-hidden="true" />
              <p><span className="font-bold text-[#334b63]">Independent civic-tech project.</span> Clarify MY is not an official Malaysian government service. Important information should always be verified using the cited official source.</p>
            </aside>

            <div className="mt-8 border-t border-[#dfe6ed] bg-white px-3 pb-6 pt-6 sm:px-4 lg:hidden">
              <SupportedAgencies />
              <MobileNavigation {...navigationProps} />
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
}

function FaqItem({ item, open, onToggle }: { item: FaqEntry; open: boolean; onToggle: () => void }) {
  const buttonId = `${item.id}-button`;
  const panelId = `${item.id}-answer`;

  return (
    <article className={`overflow-hidden rounded-xl border bg-white transition-colors ${open ? "border-[#aac0d3]" : "border-[#dbe3ea] hover:border-[#b8c8d7]"}`}>
      <h3>
        <button id={buttonId} type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex min-h-13 w-full items-center justify-between gap-4 px-4 py-3 text-left text-[13px] font-bold leading-5 text-[#17334f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#28659c] sm:px-5">
          <span>{item.question}</span>
          <span className={`grid size-7 shrink-0 place-items-center rounded-lg bg-[#f2f6f9] text-[#61778d] transition-transform ${open ? "rotate-180" : ""}`}><ChevronDown className="size-4" aria-hidden="true" /></span>
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} aria-hidden={!open} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-[#e8edf2] px-4 py-3.5 text-[13px] leading-6 text-[#5b6d81] sm:px-5">
            <p>{item.answer}</p>
            {item.showAgencies && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {supportedAgencies.map((agency) => <div key={agency} className="flex items-center gap-2 rounded-xl border border-[#e0e6ec] bg-[#fafcfd] px-2.5 py-2"><AgencyBadge agency={agency} /><span className="text-[10px] font-semibold leading-4 text-[#65758a]">{agencyDetails[agency].description}</span></div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
