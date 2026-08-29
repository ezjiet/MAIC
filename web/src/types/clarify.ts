export type Agency = "KWSP" | "LHDN" | "JPJ" | "MULTI" | "UNCLEAR";
export type AnswerStatus = "answered" | "refused";

export interface Citation {
  id: string | number;
  document_title: string;
  section?: string;
  effective_date?: string;
  source_url: string;
}

export interface RecommendedForm {
  form_id: string;
  form_name: string;
  form_code?: string;
  agency: Exclude<Agency, "MULTI" | "UNCLEAR">;
  reason?: string;
  source_url?: string;
  download_url?: string;
}

/** Safe display descriptor for the specific message that introduced a form. */
export interface AttachmentContext {
  document_type?: string;
  agency?: Agency;
  form_name?: string;
  form_code?: string;
}

/** Runtime-only upload state. Never pass this object to localStorage. */
export interface UploadedAttachment extends AttachmentContext {
  attachment_id: string;
  filename: string;
  content_type: string;
  status: "ready";
}

export interface AskResponse {
  answer: string;
  agency: Agency;
  status: AnswerStatus;
  citations: Citation[];
  recommended_forms: RecommendedForm[];
  suggested_follow_ups: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agency?: Agency;
  status?: AnswerStatus;
  citations?: Citation[];
  /** Present only when this message introduced the displayed attachment. */
  attachmentContext?: AttachmentContext[];
  recommendedForms?: RecommendedForm[];
  suggestedFollowUps?: string[];
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
  /** Opaque IDs retained only in memory for the current browser session. */
  attachmentIds?: string[];
}

export interface SavedAnswer {
  id: string;
  chatId: string;
  messageId: string;
  query: string;
  answer: string;
  agency: Agency;
  citations: Citation[];
  recommendedForms?: RecommendedForm[];
  savedAt: string;
}

export type ApiErrorKind = "network" | "unavailable" | "malformed" | "attachment_expired";

export class ClarifyApiError extends Error {
  constructor(public readonly kind: ApiErrorKind, message: string) {
    super(message);
    this.name = "ClarifyApiError";
  }
}
