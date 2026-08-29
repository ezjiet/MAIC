import { API_BASE_URL } from "@/lib/api-base";
import type { UploadedAttachment } from "@/types/clarify";
import { ClarifyApiError } from "@/types/clarify";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ACCEPTED_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;

export function validateAttachment(file: File) {
  if (!ACCEPTED_TYPES.has(file.type) || !ACCEPTED_EXTENSIONS.test(file.name)) {
    throw new ClarifyApiError("malformed", "Please choose a PDF, JPG or PNG file.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ClarifyApiError("malformed", "The file must be 10 MB or smaller.");
  }
}

export async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  validateAttachment(file);
  const body = new FormData();
  body.append("file", file);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/attachments`, { method: "POST", body });
  } catch {
    throw new ClarifyApiError("network", "Could not upload the form. Check that the service is running.");
  }
  if (!response.ok) {
    let message = "The form could not be uploaded.";
    try {
      const data = await response.json() as { detail?: string };
      if (data.detail) message = data.detail;
    } catch { /* Keep the safe fallback. */ }
    throw new ClarifyApiError(response.status === 503 ? "unavailable" : "malformed", message);
  }
  return response.json() as Promise<UploadedAttachment>;
}
