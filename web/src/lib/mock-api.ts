import type { Agency, AskQuestionInput, AskResponse } from "@/types/clarify";

const responses = {
  KWSP: {
    answer: "KWSP allows eligible members to use savings from Account Sejahtera for qualifying housing purposes, subject to the latest requirements and available balance.",
    agency: "KWSP",
    status: "answered",
    citations: [{ document_title: "KWSP Housing Withdrawal Guide", clause: "Section 3.1", effective_date: "2026-01-01", source_url: "https://www.kwsp.gov.my/en/member/house-withdrawal/buy-house" }],
  },
  LHDN: {
    answer: "Whether you need to pay income tax depends on your chargeable income after eligible reliefs and deductions. Check the latest filing guidance for the relevant assessment year.",
    agency: "LHDN",
    status: "answered",
    citations: [{ document_title: "Individual Income Tax Guidance", clause: "Filing and tax liability", effective_date: "2026-01-01", source_url: "https://www.hasil.gov.my/en/individual/introduction-individual-income-tax/" }],
  },
  JPJ: {
    answer: "An expired driving licence can generally be renewed through supported JPJ channels, provided it has not exceeded the period that requires an appeal or additional test.",
    agency: "JPJ",
    status: "answered",
    citations: [{ document_title: "Driving Licence Renewal", clause: "Competent Driving Licence", effective_date: "2026-01-01", source_url: "https://www.jpj.gov.my/en/web/main-site/driving-licenses" }],
  },
  UNCLEAR: {
    answer: "I couldn't find enough official information to answer this reliably.",
    agency: "UNCLEAR",
    status: "refused",
    citations: [],
  },
} satisfies Record<string, AskResponse>;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const contextualAnswers: Record<Exclude<Agency, "UNCLEAR">, { amount: string; documents: string; eligibility: string }> = {
  KWSP: {
    amount: "For a housing withdrawal, the eligible amount depends on the purchase cost, your housing financing, and the balance available in Account Sejahtera. Check the current KWSP calculation before applying.",
    documents: "You may need the sale and purchase agreement, proof of financing, identification, and relevant property details. The exact checklist depends on the type of housing application.",
    eligibility: "Eligibility depends on factors such as your age, Account Sejahtera balance, and the qualifying housing purpose. The official KWSP guide lists the current conditions.",
  },
  LHDN: {
    amount: "Your tax amount depends on chargeable income after eligible reliefs and deductions, using the rates for the relevant assessment year.",
    documents: "Keep income statements, receipts for claimed reliefs, and other supporting tax records. LHDN may require these if your filing is reviewed.",
    eligibility: "Whether you need to file depends on your income sources and the latest LHDN filing requirements for the assessment year.",
  },
  JPJ: {
    amount: "Renewal fees vary by licence class and renewal period. Confirm the current fee through an official JPJ channel before payment.",
    documents: "You will generally need valid identification and your licence details; extra documentation may apply to special or long-expired cases.",
    eligibility: "Renewal eligibility depends on the licence type and how long it has been expired. Longer expiry periods may require an appeal or additional steps.",
  },
};

function detectAgency(value: string): Agency {
  if (/\b(kwsp|epf|withdraw|house|housing|rumah)\b/.test(value)) return "KWSP";
  if (/\b(jpj|lesen|licen[cs]e|road\s?tax)\b/.test(value)) return "JPJ";
  if (/\b(lhdn|tax|income|cukai|hasil)\b/.test(value)) return "LHDN";
  return "UNCLEAR";
}

export async function getMockResponse(input: AskQuestionInput): Promise<AskResponse> {
  await wait(750);
  const latest = input.message.toLowerCase();
  const recentContext = input.messages.slice(-8).map((message) => message.content.toLowerCase()).join(" ");
  const agency = detectAgency(latest) === "UNCLEAR" ? detectAgency(recentContext) : detectAgency(latest);
  if (agency === "UNCLEAR") return responses.UNCLEAR;

  const base = responses[agency];
  if (/\b(how much|amount|berapa|fee|cost)\b/.test(latest)) return { ...base, answer: contextualAnswers[agency].amount };
  if (/\b(document|documents|dokumen|need to bring|bring)\b/.test(latest)) return { ...base, answer: contextualAnswers[agency].documents };
  if (/\b(eligible|eligibility|age|umur|who can|who is)\b/.test(latest)) return { ...base, answer: contextualAnswers[agency].eligibility };
  return base;
}
