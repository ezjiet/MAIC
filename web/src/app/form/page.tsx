"use client";
import { useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Field = { field_code: string; label: string; type: string; section?: string; instruction?: string };
type RequiredInfo = { label: string; field_type: string; example: string };
type Guide = { form_summary: string; sections: string[]; required_info: RequiredInfo[]; example_description: string };
type Suggestion = {
  field: Field;
  value: string | number | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  cap_note: string;
  receipt_required: boolean | null;
  citation: { source: string; page: number | null; agency: string } | null;
};

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  let resp: Response;
  try { resp = await fetch(`${BACKEND}${path}`, init); }
  catch { throw new Error(`Cannot reach backend at ${BACKEND}. Is uvicorn running?`); }
  const text = await resp.text();
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { const p = JSON.parse(text); msg = p.detail || p.message || JSON.stringify(p); } catch { msg = text || msg; }
    throw new Error(msg);
  }
  return JSON.parse(text) as T;
}

export default function FormAssistantPage() {
  const [step, setStep] = useState<1|2|3|4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [agency, setAgency] = useState<"lhdn"|"kwsp"|"jpj">("kwsp");
  const [fields, setFields] = useState<Field[]>([]);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [extraNotes, setExtraNotes] = useState("");
  const [facts, setFacts] = useState<Record<string, unknown>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  async function handleExtract() {
    if (!file) return;
    setLoading("Reading your form with AI vision (20-40s)…"); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await apiFetch<{form_id:string; form_name:string; fields:Field[]}>(
        "/form/extract", { method: "POST", body: fd });
      if (!r.fields?.length) {
        setError("Could not detect any fields. The form may be a scanned image with poor quality — try a clearer PDF.");
        setLoading(""); return;
      }
      setFormId(r.form_id); setFormName(r.form_name); setFields(r.fields);

      setLoading("Analysing what info this form needs…");
      const g = await apiFetch<Guide>("/form/prepare", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ form_name: r.form_name, agency, fields: r.fields })
      });
      setGuide(g);
      setStep(2);
    } catch (e) { setError((e as Error).message); }
    setLoading("");
  }

  async function handleSuggest() {
    setLoading("Filling the form based on your info (30-60s)…"); setError("");
    try {
      const answered = guide?.required_info
        .map(ri => `${ri.label}: ${answers[ri.label] || "(not provided)"}`)
        .join("\n") || "";
      const factsText = answered + (extraNotes ? `\n\nAdditional notes: ${extraNotes}` : "");

      const r = await apiFetch<{facts:Record<string,unknown>; suggestions:Suggestion[]}>(
        "/form/suggest", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ form_id: formId, form_name: formName, agency, fields, facts_text: factsText })
        });
      setFacts(r.facts || {}); setSuggestions(r.suggestions || []);
      setStep(3);
    } catch (e) { setError((e as Error).message); }
    setLoading("");
  }

  async function handleFinalise() {
    setLoading("Generating your draft PDF…"); setError("");
    try {
      const r = await apiFetch<{download_url:string}>(
        "/form/finalise", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ form_id: formId, form_name: formName, agency, facts, suggestions })
        });
      setDownloadUrl(`${BACKEND}${r.download_url}`);
      setStep(4);
    } catch (e) { setError((e as Error).message); }
    setLoading("");
  }

  function downloadNow() { if (downloadUrl) window.location.href = downloadUrl; }
  function updateAnswer(label: string, value: string) { setAnswers(a => ({...a, [label]: value})); }
  function updateSuggestion(i: number, value: string) {
    setSuggestions(s => s.map((sg, j) => j === i ? {...sg, value} : sg));
  }
  function resetAll() {
    setStep(1); setFile(null); setFields([]); setGuide(null);
    setAnswers({}); setExtraNotes(""); setSuggestions([]); setDownloadUrl(""); setError("");
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#10243e]">Form Assistant</h1>
        <p className="mt-1 text-sm text-[#52647a]">Upload a Malaysian government form → AI reads it → tells you exactly what info it needs → fills it based on your answers → you review and download.</p>
        <div className="mt-4 flex gap-2">
          {[1,2,3,4].map(n => (
            <div key={n} className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold text-center ${step >= n ? "bg-[#2b65a5] text-white" : "bg-[#eaf2fa] text-[#7a8a9e]"}`}>
              {["1. Upload","2. Your Info","3. Review","4. Download"][n-1]}
            </div>
          ))}
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-bold text-red-800">Error</p>
          <p className="mt-1 text-xs text-red-700 whitespace-pre-wrap break-words">{error}</p>
        </div>
      )}
      {loading && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-3">
          <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          <p className="text-sm text-blue-800">{loading}</p>
        </div>
      )}

      {step === 1 && (
        <section className="rounded-xl border border-[#d8e4ef] bg-white p-6">
          <label className="block text-sm font-bold mb-2">1. Which agency is this form for?</label>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(["lhdn","kwsp","jpj"] as const).map(a => (
              <button key={a} type="button" onClick={() => setAgency(a)} disabled={!!loading}
                      className={`rounded-lg border px-4 py-2 text-sm font-bold ${agency === a ? "border-[#2b65a5] bg-[#eaf2fa] text-[#10243e]" : "border-[#d8e4ef] bg-white text-[#52647a]"}`}>
                {a.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="block text-sm font-bold mb-2">2. Upload the form (PDF, JPG, or PNG)</label>
          <input type="file" accept="application/pdf,image/*" disabled={!!loading}
                 onChange={e => setFile(e.target.files?.[0] || null)}
                 className="mb-4 block w-full rounded-lg border border-[#d8e4ef] p-2 text-sm" />
          <button onClick={handleExtract} disabled={!file || !!loading}
                  className="rounded-lg bg-[#2b65a5] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            {loading ? "Working…" : "Analyse form →"}
          </button>
        </section>
      )}

      {step === 2 && guide && (
        <section className="rounded-xl border border-[#d8e4ef] bg-white p-6">
          <div className="mb-4 rounded-lg bg-[#f6f9fc] p-3">
            <p className="text-xs font-bold uppercase text-[#7a8a9e]">Form Detected</p>
            <p className="text-sm font-bold text-[#10243e]">{formName}</p>
            <p className="mt-1 text-xs text-[#52647a]">{guide.form_summary}</p>
            <p className="mt-1 text-[11px] text-[#7a8a9e]">{fields.length} fields · Agency: {agency.toUpperCase()}</p>
          </div>

          <h2 className="mb-3 text-sm font-bold text-[#10243e]">
            This form needs the following information from you:
          </h2>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
            {guide.required_info.map((ri) => (
              <div key={ri.label}>
                <label className="block text-xs font-bold text-[#345070]">{ri.label}</label>
                <input value={answers[ri.label] || ""} onChange={e => updateAnswer(ri.label, e.target.value)}
                       placeholder={`e.g. ${ri.example}`}
                       className="mt-1 block w-full rounded-md border border-[#d8e4ef] px-2 py-1.5 text-sm" />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-[#345070]">Anything else worth noting? (optional)</label>
            <textarea value={extraNotes} onChange={e => setExtraNotes(e.target.value)} rows={2}
                      placeholder="E.g. special circumstances, dependants, other reliefs, etc."
                      className="mt-1 block w-full rounded-md border border-[#d8e4ef] px-2 py-1.5 text-sm" />
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep(1)} disabled={!!loading}
                    className="rounded-lg border border-[#d8e4ef] px-4 py-2 text-sm font-bold text-[#52647a]">← Back</button>
            <button onClick={handleSuggest} disabled={!!loading}
                    className="rounded-lg bg-[#2b65a5] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
              {loading ? "Filling…" : "Fill form →"}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rounded-xl border border-[#d8e4ef] bg-white p-6">
          <h2 className="text-lg font-bold mb-1">Review the filled form</h2>
          <p className="mb-4 text-xs text-[#7a8a9e]">These are AI suggestions based on the info you provided. <b>Edit anything wrong</b> before downloading.</p>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-lg border border-[#e6ecf3] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase text-[#7a8a9e]">{s.field.field_code}</p>
                    <p className="text-sm font-bold text-[#10243e]">{s.field.label}</p>
                    {s.field.instruction && <p className="text-[11px] text-[#7a8a9e]">{s.field.instruction}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    s.confidence === "high" ? "bg-green-100 text-green-700" :
                    s.confidence === "medium" ? "bg-amber-100 text-amber-700" :
                    "bg-gray-100 text-gray-600"}`}>{s.confidence}</span>
                </div>
                <input value={s.value == null ? "" : String(s.value)}
                       onChange={e => updateSuggestion(i, e.target.value)}
                       placeholder="(please fill)"
                       className="mt-2 block w-full rounded-md border border-[#d8e4ef] px-2 py-1.5 text-sm" />
                {s.reasoning && <p className="mt-2 text-[11px] text-[#52647a]"><b>Why:</b> {s.reasoning}</p>}
                {s.cap_note && <p className="text-[11px] text-amber-700"><b>Cap:</b> {s.cap_note}</p>}
                {s.citation && <p className="text-[11px] text-[#2b65a5]">📄 {s.citation.source} · p{s.citation.page ?? "?"}</p>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep(2)} disabled={!!loading}
                    className="rounded-lg border border-[#d8e4ef] px-4 py-2 text-sm font-bold text-[#52647a]">← Back</button>
            <button onClick={handleFinalise} disabled={!!loading}
                    className="rounded-lg bg-[#2b65a5] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
              {loading ? "Generating…" : "Generate draft PDF →"}
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="rounded-xl border border-[#d8e4ef] bg-white p-6 text-center">
          <h2 className="text-lg font-bold mb-2">✓ Draft PDF ready</h2>
          <p className="mb-4 text-sm text-[#52647a]">Review carefully before submitting to the agency. You remain the signer.</p>
          <button onClick={downloadNow}
                  className="inline-block rounded-lg bg-[#2b65a5] px-6 py-3 text-sm font-bold text-white hover:bg-[#245d98]">
            📥 Download Draft PDF
          </button>
          <p className="mt-3 text-[11px] text-[#7a8a9e]">
            Or copy the direct link: <a href={downloadUrl} className="break-all text-[#2b65a5] underline">{downloadUrl}</a>
          </p>
          <div className="mt-4">
            <button onClick={resetAll} className="text-sm font-bold text-[#2b65a5] underline">Start another form</button>
          </div>
        </section>
      )}
    </main>
  );
}
