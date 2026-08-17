"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileSearch,
  Info,
  Languages,
  MessageSquareText,
  Route,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { AgencyCard } from "@/components/AgencyCard";
import { MobileHeader, MobileNavigation } from "@/components/MobileHeader";
import { Sidebar } from "@/components/Sidebar";
import { SupportedAgencies } from "@/components/SupportedAgencies";

const processSteps = [
  {
    number: "01",
    title: "Ask",
    description: "Ask naturally in English, Bahasa Malaysia or conversational mixed language.",
    icon: MessageSquareText,
  },
  {
    number: "02",
    title: "Understand",
    description: "Clarify MY determines the relevant public-service topic or agency.",
    icon: Route,
  },
  {
    number: "03",
    title: "Retrieve",
    description: "The system is designed to retrieve relevant information from official sources.",
    icon: FileSearch,
  },
  {
    number: "04",
    title: "Explain & Verify",
    description: "A clearer explanation is provided with supporting citations when available.",
    icon: CheckCircle2,
  },
];

const principles = [
  {
    title: "Clear Explanations",
    description: "Complex information should be easier to understand.",
    icon: Languages,
  },
  {
    title: "Official-Source Grounding",
    description: "Answers are designed to be supported by relevant official information.",
    icon: ShieldCheck,
  },
  {
    title: "Transparent Citations",
    description: "Users should be able to see where important information comes from.",
    icon: BookOpenCheck,
  },
  {
    title: "Know When Not to Answer",
    description: "When reliable evidence is insufficient, refusing is better than presenting unsupported information.",
    icon: SearchCheck,
  },
];

const exampleQuestions = [
  "How do I renew my licence?",
  "KWSP boleh use for house ke?",
  "Apa tax relief yang saya boleh claim?",
];

export function AboutPage() {
  const router = useRouter();
  const navigationProps = {
    activeView: "about" as const,
    onOpenChat: () => router.push("/"),
    onOpenHistory: () => router.push("/?view=history"),
  };

  return (
    <div className="min-h-screen w-full bg-[#f5f8fb] text-[#10243e] lg:h-screen lg:min-h-[680px] lg:overflow-hidden">
      <div className="min-h-screen w-full bg-white lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <MobileHeader />
        <Sidebar {...navigationProps} />

        <main className="min-w-0 bg-[#f5f8fb] px-4 py-6 sm:px-6 sm:py-8 lg:min-h-0 lg:overflow-y-auto lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[1020px]">
            <header className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b7e91]">About the Project</p>
              <h1 className="mt-1.5 text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.12] tracking-[-0.04em] text-[#10243e]">
                Making Malaysian public-service information easier to understand.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#617286]">
                Clarify MY helps users navigate public-service information through clear, conversational and source-grounded explanations.
              </p>
            </header>

            <section aria-labelledby="mission-title" className="mt-8 rounded-2xl border border-[#d6e0e9] bg-white px-5 py-5 sm:px-6">
              <h2 id="mission-title" className="text-lg font-extrabold tracking-[-0.02em] text-[#17334f]">Why Clarify MY?</h2>
              <div className="mt-2 max-w-4xl space-y-2 text-[13px] leading-6 text-[#5b6d81]">
                <p>Public-service information can be spread across different websites, documents and agencies. Formal terminology can also make simple questions harder to understand.</p>
                <p>Clarify MY aims to provide a simpler way to ask questions about Malaysian public services and receive clearer explanations supported by relevant official sources.</p>
              </div>
            </section>

            <section aria-label="The challenge and our approach" className="mt-8 grid gap-3 md:grid-cols-2">
              <article className="rounded-2xl border border-[#dbe3ea] bg-white p-5">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#7a8897]">The Challenge</p>
                <h2 className="mt-2 text-base font-extrabold text-[#17334f]">Information can feel fragmented.</h2>
                <p className="mt-2 text-[13px] leading-6 text-[#607286]">Public-service information may require users to search across multiple pages, interpret formal terminology, and determine which agency is responsible for their question.</p>
              </article>
              <article className="rounded-2xl border border-[#cfe0ec] bg-[#f8fbfd] p-5">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#4f7698]">Our Approach</p>
                <h2 className="mt-2 text-base font-extrabold text-[#17334f]">Start with a natural question.</h2>
                <p className="mt-2 text-[13px] leading-6 text-[#607286]">Clarify MY provides one conversational interface where users can ask naturally, while the system is designed to retrieve relevant official information and explain it in clearer language.</p>
              </article>
            </section>

            <section aria-labelledby="process-title" className="mt-10">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#7b8796]">From question to clarity</p>
                <h2 id="process-title" className="mt-1.5 text-xl font-extrabold tracking-[-0.025em] text-[#17334f]">How Clarify MY Works</h2>
              </div>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {processSteps.map(({ number, title, description, icon: Icon }) => (
                  <li key={number} className="relative rounded-2xl border border-[#dbe3ea] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-[#eaf2fa] text-[#28659c]"><Icon className="size-4" aria-hidden="true" /></span>
                      <span className="text-[10px] font-extrabold tracking-[0.12em] text-[#9aa6b2]">{number}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-extrabold text-[#17334f]">{title}</h3>
                    <p className="mt-1.5 text-[11px] leading-5 text-[#647589]">{description}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="supported-title" className="mt-10">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#7b8796]">Coverage</p>
              <h2 id="supported-title" className="mt-1.5 text-xl font-extrabold tracking-[-0.025em] text-[#17334f]">Currently Supported</h2>
              <p className="mt-1 text-xs text-[#718094]">Initial coverage focuses on three Malaysian public-service agencies.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <AgencyCard agency="KWSP" />
                <AgencyCard agency="LHDN" />
                <AgencyCard agency="JPJ" />
              </div>
            </section>

            <section aria-labelledby="principles-title" className="mt-10">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#7b8796]">Our principles</p>
              <h2 id="principles-title" className="mt-1.5 text-xl font-extrabold tracking-[-0.025em] text-[#17334f]">What We Care About</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {principles.map(({ title, description, icon: Icon }) => (
                  <article key={title} className="flex items-start gap-3 rounded-2xl border border-[#dbe3ea] bg-white p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eef4f8] text-[#426b91]"><Icon className="size-4" aria-hidden="true" /></span>
                    <div>
                      <h3 className="text-[13px] font-extrabold text-[#17334f]">{title}</h3>
                      <p className="mt-1 text-[11px] leading-5 text-[#647589]">{description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section aria-labelledby="natural-title" className="mt-10 rounded-2xl border border-[#d4e1eb] bg-[#eef5fa] px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#28659c]"><Languages className="size-4" aria-hidden="true" /></span>
                <div>
                  <h2 id="natural-title" className="text-base font-extrabold text-[#17334f]">Ask Naturally</h2>
                  <p className="mt-1 max-w-3xl text-[12px] leading-5 text-[#5f7286]">Clarify MY is designed for the way Malaysians communicate — whether that is English, Bahasa Malaysia or conversational mixed-language questions.</p>
                </div>
              </div>
              <ul aria-label="Example questions" className="mt-4 flex flex-wrap gap-2">
                {exampleQuestions.map((question) => <li key={question} className="rounded-full border border-[#c9d9e6] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#526b82]">“{question}”</li>)}
              </ul>
            </section>

            <section aria-label="Project and team" className="mt-10 grid gap-3 md:grid-cols-2">
              <article className="rounded-2xl border border-[#dbe3ea] bg-white p-5">
                <h2 className="text-base font-extrabold text-[#17334f]">The Project</h2>
                <p className="mt-2 text-[12px] leading-6 text-[#607286]">Clarify MY is an independent civic-tech project focused on making Malaysian public-service information clearer, more accessible, and easier to verify through AI-assisted explanations and transparent sources.</p>
              </article>
              <article className="rounded-2xl border border-[#dbe3ea] bg-white p-5">
                <h2 className="text-base font-extrabold text-[#17334f]">Our Team</h2>
                <p className="mt-2 text-[12px] leading-6 text-[#607286]">Clarify MY is built by a student team passionate about using technology to make public-service information clearer, more accessible, and easier to understand.</p>
              </article>
            </section>

            <section aria-labelledby="cta-title" className="mt-10 flex flex-col gap-4 rounded-2xl border border-[#cddce8] bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 id="cta-title" className="text-base font-extrabold text-[#17334f]">Have a question?</h2>
                <p className="mt-1 text-[12px] text-[#687a8d]">Ask Clarify MY about supported Malaysian public services.</p>
              </div>
              <Link href="/" className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-xl bg-[#1e609b] px-4 text-xs font-extrabold text-white transition hover:bg-[#174b78] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#28659c]/30">
                Ask Clarify MY <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </section>

            <aside className="mt-5 flex items-start gap-3 rounded-2xl border border-[#d7e1e9] bg-[#eef4f8] px-4 py-4 text-[11px] leading-5 text-[#5d7084] sm:px-5">
              <Info className="mt-0.5 size-4 shrink-0 text-[#426b91]" aria-hidden="true" />
              <p><span className="font-bold text-[#334b63]">Independent civic-tech project.</span> Clarify MY is not an official Malaysian government application or service. Important information should always be verified using the cited official source.</p>
            </aside>

            <div className="mt-8 border-t border-[#dfe6ed] bg-white px-3 pb-6 pt-6 sm:px-4 lg:hidden">
              <SupportedAgencies />
              <MobileNavigation {...navigationProps} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
