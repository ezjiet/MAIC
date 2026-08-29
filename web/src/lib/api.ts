import { API_BASE_URL, resolveApiUrl } from "@/lib/api-base";
import type { AskQuestionInput, AskResponse } from "@/types/clarify";
import { ClarifyApiError } from "@/types/clarify";

export async function askQuestion(input: AskQuestionInput): Promise<AskResponse> {
  const cleanQuery = input.message.trim();
  if (!cleanQuery) throw new ClarifyApiError("malformed", "Please enter a question.");

  const history = input.messages.slice(-10).map(({ role, content }) => ({ role, content }));
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: input.chatId,
        message: cleanQuery,
        history,
        attachments: (input.attachmentIds ?? []).map((attachment_id) => ({ attachment_id })),
      }),
    });
  } catch {
    throw new ClarifyApiError("network", `Could not connect to Clarify MY at ${API_BASE_URL}.`);
  }

  if (response.status === 410) {
    throw new ClarifyApiError("attachment_expired", "That attachment is no longer available. Please upload it again.");
  }
  if (!response.ok) {
    throw new ClarifyApiError("unavailable", response.status === 503
      ? "The answer service is temporarily busy. Please try again shortly."
      : `The service returned an error (${response.status}).`);
  }

  try {
    const data = await response.json() as AskResponse;
    return {
      ...data,
      citations: (data.citations ?? []).map((item) => ({ ...item, source_url: resolveApiUrl(item.source_url) ?? "#" })),
      recommended_forms: (data.recommended_forms ?? []).map((item) => ({
        ...item,
        source_url: resolveApiUrl(item.source_url),
        download_url: resolveApiUrl(item.download_url),
      })),
      suggested_follow_ups: data.suggested_follow_ups ?? [],
    };
  } catch {
    throw new ClarifyApiError("malformed", "The response could not be read safely.");
  }
}
