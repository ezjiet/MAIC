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
    const saved = Array.isArray(parsed) ? parsed.filter(isSavedAnswer).sort(sortBySavedAt).slice(0, LIMIT) : [];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return saved;
  } catch {
    return [];
  }
}

export function saveAnswer(items: SavedAnswer[], item: SavedAnswer) {
  const next = [item, ...items.filter((saved) => saved.messageId !== item.messageId)].sort(sortBySavedAt).slice(0, LIMIT);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeSavedAnswer(items: SavedAnswer[], messageId: string) {
  const next = items.filter((item) => item.messageId !== messageId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function formatSavedAt(value: string) {
  const savedAt = new Date(value);
  if (Number.isNaN(savedAt.getTime())) return "Saved previously";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - savedAt.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Saved just now";
  if (elapsedMinutes < 60) return `Saved ${elapsedMinutes}m ago`;
  if (savedAt.toDateString() === new Date().toDateString()) return `Saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return `Saved ${savedAt.toLocaleDateString([], { day: "numeric", month: "short" })}`;
}

function sortBySavedAt(a: SavedAnswer, b: SavedAnswer) {
  return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
}

// TODO: Future Enhancement - Sync saved answers to backend storage.
