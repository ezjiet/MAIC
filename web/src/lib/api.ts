import type { AskQuestionInput, AskResponse, Agency, Citation } from "@/types/clarify";
import { ClarifyApiError } from "@/types/clarify";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface BackendCitation {
  source: string;
  page: number | null;
  effective_date: string | null;
  agency?: string;
}

interface BackendChatResponse {
  agency: Agency;
  answer: string;
  citations: BackendCitation[];
  refused: boolean;
}

function adaptCitation(c: BackendCitation): Citation {
  const cleanTitle = c.source.replace(/\.pdf\.pdf$/, ".pdf").replace(/_/g, " ");
  // Build a real, clickable URL to the PDF served by the backend at /pdfs/<agency>/<file>
  const agency = (c.agency || "").toLowerCase();
  const filename = encodeURIComponent(c.source);
  const pageAnchor = c.page ? `#page=${c.page}` : "";
  const url = agency ? `${BACKEND_URL}/pdfs/${agency}/${filename}${pageAnchor}` : "#";
  return {
    document_title: cleanTitle,
    clause: c.page != null ? `Page ${c.page}` : "",
    effective_date: c.effective_date || undefined,
    source_url: url,
  };
}

export async function askQuestion(input: AskQuestionInput): Promise<AskResponse> {
  const cleanQuery = input.message.trim();
  if (!cleanQuery) {
    throw new ClarifyApiError("malformed", "Please enter a question.");
  }

  // Pass previous chat history so the AI has multi-turn context
  const history = (input.messages || []).slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let resp: Response;
  try {
    resp = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: cleanQuery, history }),
    });
  } catch (e) {
    throw new ClarifyApiError("network",
      "Tak dapat sambung ke Clarify MY backend. Pastikan server berjalan di " + BACKEND_URL);
  }

  if (!resp.ok) {
    if (resp.status === 503) {
      throw new ClarifyApiError("unavailable",
        "AI servis sibuk sekejap. Cuba lagi dalam beberapa saat.");
    }
    throw new ClarifyApiError("unavailable", `Backend error (${resp.status}).`);
  }

  const data: BackendChatResponse = await resp.json();

  return {
    answer: data.answer,
    agency: data.agency,
    status: data.refused ? "refused" : "answered",
    citations: (data.citations || []).map(adaptCitation),
  };
}
