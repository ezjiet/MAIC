import type { ReactNode } from "react";

/**
 * Small, dependency-free markdown renderer for the chat bot's replies.
 * Handles: **bold**, *italic*, `inline code`, headings (###, ##, #),
 * ordered lists (1. …), unordered lists (*, -, •), blank-line paragraph
 * breaks, and hard line breaks inside paragraphs.
 *
 * NOTE: This is intentionally strict — it does not accept raw HTML from the
 * model, so the surface stays XSS-safe.
 */

// --- inline: bold / italic / code ------------------------------------------
function renderInline(text: string): ReactNode[] {
  // Combined regex; order matters — code first so **bold** inside `code` doesn't recurse
  const tokenizer = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*[^*\s]\*)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = tokenizer.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const tok = match[0];
    if (tok.startsWith("`")) {
      out.push(
        <code key={`c${key++}`} className="rounded bg-[#f2f5f8] px-1 py-0.5 text-[0.9em] font-mono text-[#1f3a5c]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      out.push(<strong key={`b${key++}`} className="font-semibold text-[#0d2039]">{tok.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={`i${key++}`}>{tok.slice(1, -1)}</em>);
    }
    last = match.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// --- inline with hard line-breaks ------------------------------------------
function renderInlineWithBreaks(text: string, keyPrefix: string): ReactNode[] {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`${keyPrefix}br${i}`} />);
    out.push(...renderInline(line));
  });
  return out;
}

// --- block parser ----------------------------------------------------------
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  const src = String(children ?? "").replace(/\r\n/g, "\n").trim();
  const lines = src.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const isULItem = (l: string) => /^\s{0,3}[-*•]\s+/.test(l);
  const isOLItem = (l: string) => /^\s{0,3}\d+\.\s+/.test(l);
  const stripULMarker = (l: string) => l.replace(/^\s{0,3}[-*•]\s+/, "");
  const stripOLMarker = (l: string) => l.replace(/^\s{0,3}\d+\.\s+/, "");

  while (i < lines.length) {
    const line = lines[i];

    // headings
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const cls =
        level <= 2 ? "mt-4 text-[15px] font-bold text-[#0d2039] first:mt-0" :
        level === 3 ? "mt-3.5 text-[13px] font-bold uppercase tracking-wide text-[#385271] first:mt-0" :
        "mt-3 text-[13px] font-semibold text-[#385271] first:mt-0";
      const Tag = (level === 1 ? "h2" : level === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
      blocks.push(<Tag key={`h${key++}`} className={cls}>{renderInline(text)}</Tag>);
      i += 1;
      continue;
    }

    // unordered list
    if (isULItem(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && isULItem(lines[i])) {
        items.push(
          <li key={`li${key++}`} className="pl-1 marker:text-[#8090a3]">
            {renderInlineWithBreaks(stripULMarker(lines[i]), `ul${key}`)}
          </li>,
        );
        i += 1;
      }
      blocks.push(
        <ul key={`ul${key++}`} className="mt-2 ml-5 list-disc space-y-1 first:mt-0">{items}</ul>,
      );
      continue;
    }

    // ordered list
    if (isOLItem(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && isOLItem(lines[i])) {
        items.push(
          <li key={`li${key++}`} className="pl-1 marker:font-semibold marker:text-[#385271]">
            {renderInlineWithBreaks(stripOLMarker(lines[i]), `ol${key}`)}
          </li>,
        );
        i += 1;
      }
      blocks.push(
        <ol key={`ol${key++}`} className="mt-2 ml-5 list-decimal space-y-1 first:mt-0">{items}</ol>,
      );
      continue;
    }

    // blank line — skip; used as paragraph separator
    if (line.trim() === "") { i += 1; continue; }

    // paragraph — accumulate until blank line or a block marker
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !isULItem(lines[i]) &&
      !isOLItem(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p${key++}`} className="mt-2 leading-6 first:mt-0">
        {renderInlineWithBreaks(para.join("\n"), `p${key}`)}
      </p>,
    );
  }

  return <div className={`text-[14px] text-[#10243e] ${className}`}>{blocks}</div>;
}
