export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function resolveApiUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value, API_BASE_URL).toString();
  } catch {
    return undefined;
  }
}
