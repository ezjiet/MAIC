import type { Agency, SavedAnswer } from "@/types/clarify";

const STORAGE_KEY = "clarify-my-saved-answers-v2";
const LEGACY_STORAGE_KEY = "clarify-my-saved-questions-v1";
const LIMIT = 30;
const agencies: Agency[] = ["KWSP", "LHDN", "JPJ", "UNCLEAR"];

function isSavedAnswer(value: unknown): value is SavedAnswer {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedAnswer>;
  return (
    typeof item.id === "string" &&
    typeof item.chatId === "string" &&
    typeof item.messageId === "string" &&
    typeof item.query === "string" &&
    typeof item.answer === "string" &&
    typeof item.savedAt === "string" &&
    agencies.includes(item.agency as Agency) &&
    Array.isArray(item.citations)
  );
}

export function getSavedAnswers(): SavedAnswer[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const saved = Array.isArray(parsed) ? parsed.filter(isSavedAnswer).slice(0, LIMIT) : [];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return saved;
  } catch {
    return [];
  }
}

export function saveAnswer(items: SavedAnswer[], item: SavedAnswer) {
  const next = [item, ...items.filter((saved) => saved.messageId !== item.messageId)].slice(0, LIMIT);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeSavedAnswer(items: SavedAnswer[], messageId: string) {
  const next = items.filter((item) => item.messageId !== messageId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

// TODO: Future Enhancement - Sync saved answers to backend storage.
