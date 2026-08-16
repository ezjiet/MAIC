import type { Agency, ChatMessage, ChatSession } from "@/types/clarify";
import { DEFAULT_CHAT_TITLE, resolveStoredChatTitle } from "@/lib/chat-title";

// TODO: Future Enhancement - Sync chat history to backend storage.

const CHATS_KEY = "clarify-my-chats-v3";
const LATEST_ACTIVE_CHAT_KEY = "clarify-my-latest-active-chat-v4";
const LIMIT = 30;
const agencies: Agency[] = ["KWSP", "LHDN", "JPJ", "UNCLEAR"];

function createId(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    typeof message.createdAt === "string" &&
    (!message.agency || agencies.includes(message.agency))
  );
}

function parseChatSession(value: unknown): ChatSession | null {
  if (!value || typeof value !== "object") return null;
  const chat = value as Partial<ChatSession>;
  if (
    typeof chat.id !== "string" ||
    typeof chat.createdAt !== "string" ||
    typeof chat.updatedAt !== "string" ||
    !Array.isArray(chat.messages) ||
    !chat.messages.every(isMessage)
  ) return null;

  return {
    id: chat.id,
    title: resolveStoredChatTitle(chat.title, chat.messages),
    messages: chat.messages,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

export function createDraftChat(): ChatSession {
  const now = new Date().toISOString();
  return { id: createId("chat"), title: DEFAULT_CHAT_TITLE, messages: [], createdAt: now, updatedAt: now };
}

export function createMessageId() {
  return createId("message");
}

export function getChats(): ChatSession[] {
  try {
    const saved = window.localStorage.getItem(CHATS_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    const chats = parsed
      .map(parseChatSession)
      .filter((chat): chat is ChatSession => chat !== null)
      .filter(hasUserMessages)
      .sort(sortByUpdatedAt)
      .slice(0, LIMIT);

    const needsTitleMigration = chats.some((chat) => {
      const stored = parsed.find((item) => item && typeof item === "object" && (item as Partial<ChatSession>).id === chat.id) as Partial<ChatSession> | undefined;
      return stored?.title !== chat.title;
    });
    if (needsTitleMigration) window.localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    return chats;
  } catch {
    return [];
  }
}

export function getChat(chatId: string) {
  return getChats().find((chat) => chat.id === chatId);
}

export function saveChat(chats: ChatSession[], chat: ChatSession) {
  if (!hasUserMessages(chat)) return chats;
  const next = [chat, ...chats.filter((item) => item.id !== chat.id)].sort(sortByUpdatedAt).slice(0, LIMIT);
  window.localStorage.setItem(CHATS_KEY, JSON.stringify(next));
  return next;
}

export function setLatestActiveChat(chatId: string | null) {
  if (chatId) window.localStorage.setItem(LATEST_ACTIVE_CHAT_KEY, chatId);
  else window.localStorage.removeItem(LATEST_ACTIVE_CHAT_KEY);
}

export function getLatestActiveChatId() {
  return window.localStorage.getItem(LATEST_ACTIVE_CHAT_KEY);
}

export function clearHistory() {
  window.localStorage.setItem(CHATS_KEY, "[]");
  setLatestActiveChat(null);
}

export function countQuestions(chat: ChatSession) {
  return chat.messages.filter((message) => message.role === "user").length;
}

function hasUserMessages(chat: ChatSession) {
  return chat.messages.some((message) => message.role === "user");
}

function sortByUpdatedAt(a: ChatSession, b: ChatSession) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

// Opening History or Saved changes only the viewed chat.
// Sending a message promotes that chat to latest active.
