import type { Agency, AttachmentContext, ChatMessage, ChatSession, Citation } from "@/types/clarify";
import { DEFAULT_CHAT_TITLE, resolveStoredChatTitle } from "@/lib/chat-title";

// TODO: Future Enhancement - Sync chat history to backend storage.
const CHATS_KEY = "clarify-my-chats-v3";
const LATEST_ACTIVE_CHAT_KEY = "clarify-my-latest-active-chat-v4";
const LIMIT = 30;
const agencies: Agency[] = ["KWSP", "LHDN", "JPJ", "MULTI", "UNCLEAR"];

function createId(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

function safeAttachmentContext(value: unknown): AttachmentContext | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const agency = agencies.includes(raw.agency as Agency) ? raw.agency as Agency : undefined;
  const safe: AttachmentContext = {
    document_type: typeof raw.document_type === "string" ? raw.document_type.slice(0, 80) : undefined,
    agency,
    form_name: typeof raw.form_name === "string" ? raw.form_name.slice(0, 180) : undefined,
    form_code: typeof raw.form_code === "string" ? raw.form_code.slice(0, 80) : undefined,
  };
  return Object.values(safe).some(Boolean) ? safe : null;
}

function safeCitations(value: unknown): Citation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const citations = value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const title = typeof raw.document_title === "string" ? raw.document_title : undefined;
    const sourceUrl = typeof raw.source_url === "string" ? raw.source_url : undefined;
    if (!title || !sourceUrl) return [];
    return [{
      id: typeof raw.id === "string" || typeof raw.id === "number" ? raw.id : `stored-citation-${index}`,
      document_title: title,
      section: typeof raw.section === "string" ? raw.section : typeof raw.clause === "string" ? raw.clause : undefined,
      effective_date: typeof raw.effective_date === "string" ? raw.effective_date : undefined,
      source_url: sourceUrl,
    }];
  });
  return citations.length ? citations : undefined;
}

function sanitizeMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Partial<ChatMessage>;
  if (typeof message.id !== "string" || (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" || typeof message.createdAt !== "string" ||
      (message.agency && !agencies.includes(message.agency))) return null;

  const attachmentContext = Array.isArray(message.attachmentContext)
    ? message.attachmentContext.map(safeAttachmentContext).filter((item): item is AttachmentContext => item !== null).slice(0, 3)
    : undefined;
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    agency: message.agency,
    status: message.status,
    citations: safeCitations(message.citations),
    attachmentContext: attachmentContext?.length ? attachmentContext : undefined,
    recommendedForms: Array.isArray(message.recommendedForms) ? message.recommendedForms : undefined,
    suggestedFollowUps: Array.isArray(message.suggestedFollowUps)
      ? message.suggestedFollowUps.filter((item): item is string => typeof item === "string").slice(0, 4)
      : undefined,
    createdAt: message.createdAt,
  };
}

function parseChatSession(value: unknown): ChatSession | null {
  if (!value || typeof value !== "object") return null;
  const chat = value as Partial<ChatSession>;
  if (typeof chat.id !== "string" || typeof chat.createdAt !== "string" ||
      typeof chat.updatedAt !== "string" || !Array.isArray(chat.messages)) return null;
  const messages = chat.messages.map(sanitizeMessage);
  if (messages.some((message) => message === null)) return null;
  const cleanMessages = messages as ChatMessage[];
  return { id: chat.id, title: resolveStoredChatTitle(chat.title, cleanMessages), messages: cleanMessages,
    createdAt: chat.createdAt, updatedAt: chat.updatedAt };
}

function safeChatForStorage(chat: ChatSession): ChatSession {
  return { ...chat, messages: chat.messages.map((message) => sanitizeMessage(message)).filter((message): message is ChatMessage => message !== null) };
}

export function createDraftChat(): ChatSession {
  const now = new Date().toISOString();
  return { id: createId("chat"), title: DEFAULT_CHAT_TITLE, messages: [], createdAt: now, updatedAt: now };
}

export function createMessageId() { return createId("message"); }

export function getChats(): ChatSession[] {
  try {
    const saved = window.localStorage.getItem(CHATS_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    const chats = parsed.map(parseChatSession).filter((chat): chat is ChatSession => chat !== null)
      .filter(hasUserMessages).sort(sortByUpdatedAt).slice(0, LIMIT);
    // Rewrite through the privacy sanitizer, also migrating old unsafe shapes.
    window.localStorage.setItem(CHATS_KEY, JSON.stringify(chats.map(safeChatForStorage)));
    return chats;
  } catch { return []; }
}

export function getChat(chatId: string) { return getChats().find((chat) => chat.id === chatId); }

export function saveChat(chats: ChatSession[], chat: ChatSession) {
  if (!hasUserMessages(chat)) return chats;
  const next = [safeChatForStorage(chat), ...chats.filter((item) => item.id !== chat.id)]
    .sort(sortByUpdatedAt).slice(0, LIMIT);
  window.localStorage.setItem(CHATS_KEY, JSON.stringify(next));
  return next;
}

export function setLatestActiveChat(chatId: string | null) {
  if (chatId) window.localStorage.setItem(LATEST_ACTIVE_CHAT_KEY, chatId);
  else window.localStorage.removeItem(LATEST_ACTIVE_CHAT_KEY);
}

export function getLatestActiveChatId() { return window.localStorage.getItem(LATEST_ACTIVE_CHAT_KEY); }
export function clearHistory() { window.localStorage.setItem(CHATS_KEY, "[]"); setLatestActiveChat(null); }
export function countQuestions(chat: ChatSession) { return chat.messages.filter((message) => message.role === "user").length; }
function hasUserMessages(chat: ChatSession) { return chat.messages.some((message) => message.role === "user"); }
function sortByUpdatedAt(a: ChatSession, b: ChatSession) { return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); }
