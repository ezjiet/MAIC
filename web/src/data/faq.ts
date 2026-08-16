import type { FaqItem } from "@/types/clarify";

// TODO: Replace mock FAQ rankings with GET /faq/top.

export const topQuestions: FaqItem[] = [
  { id: "kwsp-house", question: "Can I use KWSP savings to buy a house?", agency: "KWSP", askCount: "12.4k asks" },
  { id: "jpj-licence", question: "How do I renew an expired driving licence?", agency: "JPJ", askCount: "9.8k asks" },
  { id: "lhdn-filing", question: "When do I need to file income tax?", agency: "LHDN", askCount: "8.1k asks" },
];

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  showAgencies?: boolean;
}

export interface FaqSection {
  id: string;
  title: string;
  items: FaqEntry[];
}

export const faqSections: FaqSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    items: [
      {
        id: "what-is-clarify-my",
        question: "What is Clarify MY?",
        answer: "Clarify MY is an AI-powered civic-tech assistant designed to help users understand Malaysian public-service information in clearer, simpler language.",
      },
      {
        id: "supported-agencies",
        question: "Which agencies are currently supported?",
        answer: "The current version of Clarify MY focuses on three Malaysian public-service agencies: KWSP, LHDN and JPJ.",
      },
      {
        id: "what-can-i-ask",
        question: "What can I ask Clarify MY?",
        answer: "You can ask questions related to the supported agencies, such as KWSP savings and withdrawals, LHDN tax matters, or JPJ driving and vehicle services.",
      },
      {
        id: "supported-languages",
        question: "Can I ask questions in Bahasa Malaysia or English?",
        answer: "Yes. Clarify MY is designed to understand English, Bahasa Malaysia and conversational mixed-language queries such as Manglish.",
      },
    ],
  },
  {
    id: "about-answers",
    title: "About the Answers",
    items: [
      {
        id: "information-sources",
        question: "Where does Clarify MY get its information?",
        answer: "Clarify MY is designed to retrieve relevant information from official public-service sources and use that information to generate clearer explanations.",
      },
      {
        id: "answer-sources",
        question: "Does Clarify MY provide sources?",
        answer: "When supporting information is available, Clarify MY displays citations so users can refer to the original official source.",
      },
      {
        id: "answer-accuracy",
        question: "Is every answer guaranteed to be correct?",
        answer: "No AI system can guarantee perfect accuracy. Clarify MY is designed to ground answers in official information, but users should verify important decisions using the cited official source.",
      },
      {
        id: "answer-refusal",
        question: "Why might Clarify MY refuse to answer a question?",
        answer: "If Clarify MY cannot find enough reliable official information to support an answer, it may refuse rather than provide an unsupported response.",
      },
    ],
  },
  {
    id: "privacy-history",
    title: "Privacy & History",
    items: [
      {
        id: "account-required",
        question: "Do I need an account?",
        answer: "No. The current version of Clarify MY does not require users to create an account or log in.",
      },
      {
        id: "history-storage",
        question: "Where is my chat history stored?",
        answer: "For the current MVP, chat history and saved answers are stored locally in your browser.",
      },
      {
        id: "cross-device-history",
        question: "Will my history appear on another device?",
        answer: "Not currently. Because the current MVP uses local browser storage, conversations do not automatically sync between devices.",
      },
      {
        id: "cleared-browser-data",
        question: "What happens if I clear my browser data?",
        answer: "Locally stored chat history and saved answers may be removed if the browser's site data is cleared.",
      },
    ],
  },
  {
    id: "supported-services",
    title: "Supported Services",
    items: [
      {
        id: "current-services",
        question: "What does Clarify MY currently support?",
        answer: "The current MVP focuses on these three service areas:",
        showAgencies: true,
      },
      {
        id: "other-agencies",
        question: "Can Clarify MY answer questions about other Malaysian agencies?",
        answer: "Not reliably in the current MVP. Clarify MY currently focuses on KWSP, LHDN and JPJ so that answers can remain more focused and grounded.",
      },
      {
        id: "government-application",
        question: "Is Clarify MY an official Malaysian government application?",
        answer: "No. Clarify MY is an independent civic-tech project and is not an official government application or service.",
      },
    ],
  },
];
