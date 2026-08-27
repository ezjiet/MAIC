"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { Footer } from "@/components/Footer";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Field = { field_code: string; label: string; type: string; section?: string; instruction?: string };
type ExtractResp = { form_id: string; form_name: string; fields: Field[]; field_count: number; is_fillable: boolean; method: string };
type RequiredInfo = { label: string; field_type: string; example: string };
type Guide = { form_summary: string; sections: string[]; required_info: RequiredInfo[]; example_description: string };
type Suggestion = {
  field: Field;
  value: string | number | null;
  confidence: "high" | "medium" | "low";
  reasoning: string; cap_note: string;
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
  const router = useRouter();
  const navProps = {
    activeView: "form" as const as "chat",
    onOpenChat: () => router.push("/"),
    onOpenHistory: () => router.push("/?view=history"),
  };
  const [step, setStep] = useState<1|2|3|4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [agency, setAgency] = useState<"lhdn"|"kwsp"|"jpj">("kwsp");
  const [fields, setFields] = useState<Field[]>([]);
  const [isFillable, setIsFillable] = useState(false);
  const [method, setMethod] = useState("");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [extraNotes, setExtraNotes] = useState("");
  const [facts, setFacts] = useState<Record<string, unknown>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadMode, setDownloadMode] = useState<"official_filled"|"summary"|"">("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  async function handleExtract() {
    if (!file) return;
    setLoading("Reading your form…"); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await apiFetch<ExtractResp>("/form/extract", { method: "POST", body: fd });
      if (!r.fields?.length) {
        setError("Could not detect any fields. Try a different form or a clearer scan.");
        setLoading(""); return;
      }
      setFormId(r.form_id); setFormName(r.form_name); setFields(r.fields);
      setIsFillable(r.is_fillable); setMethod(r.method);

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
    setLoading(isFillable ? "Filling the official PDF form…" : "Generating draft summary…"); setError("");
    try {
      const r = await apiFetch<{download_url:string; mode:"official_filled"|"summary"; filename:string}>(
        "/form/finalise", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ form_id: formId, form_name: formName, agency, facts, suggestions, is_fillable: isFillable })
        });
      setDownloadUrl(`${BACKEND}${r.download_url}`);
      setDownloadMode(r.mode);
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
    setAnswers({}); setExtraNotes(""); setSuggestions([]);
    setDownloadUrl(""); setDownloadMode(""); setError("");
    setIsFillable(false); setMethod("");
  }

  return (
    <div className="min-h-screen w-full bg-[#f5f8fb] text-[#10243e] lg:h-screen lg:min-h-[680px] lg:overflow-hidden">
      <div className="min-h-screen w-full bg-white lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <MobileHeader />
        <Sidebar {...navProps} />
        <div className="min-w-0 bg-[#f5f8fb] px-4 py-6 sm:px-6 sm:py-8 lg:min-h-0 lg:overflow-y-auto lg:px-8 lg:py-10 flex flex-col">
    <main className="mx-auto w-full max-w-[940px] flex-1">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#10243e]">Form Assistant</h1>
        <p className="mt-1 text-sm text-[#52647a]">
          Upload a Malaysian government form → AI reads it → tells you what info it needs →
          fills it → you review → download.
        </p>
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
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase text-[#7a8a9e]">Form Detected</p>
              {isFillable
                ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">✓ Direct fill supported</span>
                : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Draft summary only</span>}
            </div>
            <p className="text-sm font-bold text-[#10243e]">{formName}</p>
            <p className="mt-1 text-xs text-[#52647a]">{guide.form_summary}</p>
            <p className="mt-1 text-[11px] text-[#7a8a9e]">
              {fields.length} fields · {agency.toUpperCase()} · Extracted via {method}
            </p>
          </div>

          <h2 className="mb-3 text-sm font-bold text-[#10243e]">
            This form needs the following information from you:
          </h2>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2">
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
            <label className="block text-xs font-bold text-[#345070]">Anything else? (optional)</label>
            <textarea value={extraNotes} onChange={e => setExtraNotes(e.target.value)} rows={2}
                      placeholder="Special circumstances, dependants, other details…"
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

      {step === 3 && (() => {
        const withValue = suggestions.filter(s => s.value != null && String(s.value).trim() !== "");
        const withoutValue = suggestions.filter(s => s.value == null || String(s.value).trim() === "");
        const visible = showAll ? suggestions : withValue;
        return (
        <section className="rounded-xl border border-[#d8e4ef] bg-white p-6">
          <h2 className="text-lg font-bold mb-1">Review the filled form</h2>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-[#7a8a9e]">
              <b className="text-[#10243e]">{withValue.length} fields filled</b> out of {suggestions.length} total.
              {withoutValue.length > 0 && !showAll && ` ${withoutValue.length} skipped (info not provided — will stay blank in the PDF).`}
            </p>
            {suggestions.length > withValue.length && (
              <button onClick={() => setShowAll(v => !v)}
                      className="shrink-0 rounded-md border border-[#d8e4ef] px-2 py-1 text-[10px] font-bold text-[#345070] hover:bg-[#f6f9fc]">
                {showAll ? "Hide empty fields" : `Show all ${suggestions.length} fields`}
              </button>
            )}
          </div>
          <p className="mb-4 text-xs text-[#7a8a9e]">Edit any value if wrong. Empty fields stay empty in the PDF.</p>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
            {visible.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
                No fields were filled. Go back and provide more info about yourself.
              </div>
            ) : visible.map((s) => {
              const i = suggestions.indexOf(s);
              return (
              <div key={i} className="rounded-lg border border-[#e6ecf3] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#10243e] break-words">{s.field.label}</p>
                    {s.field.instruction && <p className="text-[11px] text-[#7a8a9e]">{s.field.instruction}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    s.confidence === "high" ? "bg-green-100 text-green-700" :
                    s.confidence === "medium" ? "bg-amber-100 text-amber-700" :
                    "bg-gray-100 text-gray-600"}`}>{s.confidence}</span>
                </div>
                <input value={s.value == null ? "" : String(s.value)}
                       onChange={e => updateSuggestion(i, e.target.value)}
                       placeholder="(empty — will stay blank in PDF)"
                       className="mt-2 block w-full rounded-md border border-[#d8e4ef] px-2 py-1.5 text-sm" />
                {s.reasoning && <p className="mt-2 text-[11px] text-[#52647a]">{s.reasoning}</p>}
                {s.cap_note && <p className="text-[11px] text-amber-700"><b>Note:</b> {s.cap_note}</p>}
              </div>
            );})}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep(2)} disabled={!!loading}
                    className="rounded-lg border border-[#d8e4ef] px-4 py-2 text-sm font-bold text-[#52647a]">← Back</button>
            <button onClick={handleFinalise} disabled={!!loading}
                    className="rounded-lg bg-[#2b65a5] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
              {loading ? "Generating…" : (isFillable ? "Fill official form →" : "Generate summary PDF →")}
            </button>
          </div>
        </section>
        );
      })()}

      {step === 4 && (
        <section className="rounded-xl border border-[#d8e4ef] bg-white p-6 text-center">
          <h2 className="text-lg font-bold mb-2">
            ✓ {downloadMode === "official_filled" ? "Filled official form ready" : "Draft PDF ready"}
          </h2>
          <p className="mb-4 text-sm text-[#52647a]">
            {downloadMode === "official_filled"
              ? "This is the actual official form filled with your details. Review carefully before printing / submitting. You remain the signer."
              : "Review this summary carefully. Use it as reference to fill the physical form. You remain the signer."}
          </p>
          <button onClick={downloadNow}
                  className="inline-block rounded-lg bg-[#2b65a5] px-6 py-3 text-sm font-bold text-white hover:bg-[#245d98]">
            📥 Download {downloadMode === "official_filled" ? "Filled Form" : "Draft PDF"}
          </button>
          <p className="mt-3 text-[11px] text-[#7a8a9e]">
            Direct link: <a href={downloadUrl} className="break-all text-[#2b65a5] underline">{downloadUrl}</a>
          </p>
          <div className="mt-4">
            <button onClick={resetAll} className="text-sm font-bold text-[#2b65a5] underline">Start another form</button>
          </div>
        </section>
      )}
    </main>
    <Footer />
        </div>
      </div>
    </div>
  );
}
