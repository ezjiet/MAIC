import { getMockResponse } from "@/lib/mock-api";
import { ClarifyApiError, type AskQuestionInput, type AskResponse } from "@/types/clarify";

// TODO: Replace mock response with FastAPI /ask integration.
// TODO: Send conversation history to the backend for multi-turn context.

export async function askQuestion(input: AskQuestionInput): Promise<AskResponse> {
  const cleanQuery = input.message.trim();
  if (!cleanQuery) throw new ClarifyApiError("malformed", "Please enter a question.");
  return getMockResponse({ ...input, message: cleanQuery });
}
