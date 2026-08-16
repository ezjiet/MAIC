import type { FaqItem } from "@/types/clarify";

// TODO: Replace mock FAQ rankings with GET /faq/top.

export const topQuestions: FaqItem[] = [
  { id: "kwsp-house", question: "Can I use KWSP savings to buy a house?", agency: "KWSP", askCount: "12.4k asks" },
  { id: "jpj-licence", question: "How do I renew an expired driving licence?", agency: "JPJ", askCount: "9.8k asks" },
  { id: "lhdn-filing", question: "When do I need to file income tax?", agency: "LHDN", askCount: "8.1k asks" },
];
