import type { ChatMessage } from "@/types/clarify";

// TODO: Future Enhancement - Generate semantic chat titles using backend AI.

export const DEFAULT_CHAT_TITLE = "New conversation";

const GREETING_ONLY = /^(?:hi|hello|hey|halo|hallo|good\s+(?:morning|afternoon)|thanks|thank\s+you|你好|嗨)$/iu;

function normalizeMessage(message: string) {
  return message
    .normalize("NFKC")
    .trim()
    .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, "")
    .replace(/\s+/g, " ");
}

export function isMeaningfulMessage(message: string) {
  const normalized = normalizeMessage(message);
  return normalized.length > 0 && !GREETING_ONLY.test(normalized);
}

export function generateChatTitle(message: string) {
  const clean = normalizeMessage(message);
  if (!isMeaningfulMessage(clean)) return DEFAULT_CHAT_TITLE;
  return truncateTitle(clean);
}

export function firstMeaningfulTitle(messages: ChatMessage[]) {
  const message = messages.find((item) => item.role === "user" && isMeaningfulMessage(item.content));
  return message ? generateChatTitle(message.content) : DEFAULT_CHAT_TITLE;
}

export function resolveStoredChatTitle(title: unknown, messages: ChatMessage[]) {
  if (typeof title !== "string") return firstMeaningfulTitle(messages);
  const clean = title.trim();
  if (!clean || clean === "New Chat" || clean === DEFAULT_CHAT_TITLE || !isMeaningfulMessage(clean)) {
    return firstMeaningfulTitle(messages);
  }
  return clean;
}

function truncateTitle(message: string) {
  const MAX_LENGTH = 42;
  if (message.length <= MAX_LENGTH) return message;

  const available = message.slice(0, MAX_LENGTH - 1).trimEnd();
  const lastSpace = available.lastIndexOf(" ");
  const gracefulCut = lastSpace >= 28 ? available.slice(0, lastSpace) : available;
  return `${gracefulCut.replace(/[\s\p{P}\p{S}]+$/gu, "")}…`;
}
