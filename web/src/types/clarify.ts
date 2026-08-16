export type Agency = "KWSP" | "LHDN" | "JPJ" | "UNCLEAR";
export type AnswerStatus = "answered" | "refused";

export interface Citation {
  document_title: string;
  clause: string;
  effective_date?: string;
  source_url: string;
}

export interface AskResponse {
  answer: string;
  agency: Agency;
  status: AnswerStatus;
  citations: Citation[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agency?: Agency;
  status?: AnswerStatus;
  citations?: Citation[];
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AskQuestionInput {
  chatId: string;
  message: string;
  /** Persisted messages before the latest user message. */
  messages: ChatMessage[];
}

export interface SavedAnswer {
  id: string;
  chatId: string;
  messageId: string;
  query: string;
  answer: string;
  agency: Agency;
  citations: Citation[];
  savedAt: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  agency: Agency;
  createdAt: string;
  response?: AskResponse;
}

export interface FaqItem {
  id: string;
  question: string;
  agency: Exclude<Agency, "UNCLEAR">;
  askCount: string;
}

export type ApiErrorKind = "network" | "unavailable" | "malformed";

export class ClarifyApiError extends Error {
  constructor(public readonly kind: ApiErrorKind, message: string) {
    super(message);
    this.name = "ClarifyApiError";
  }
}
