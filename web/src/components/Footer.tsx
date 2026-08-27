import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-[#e6edf3] pt-5 pb-4 text-[11px] text-[#7a8a9e]">
      <div className="mx-auto flex w-full max-w-[940px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-[#4a5b70]">Clarify MY</span>
          <span className="mx-1.5 text-[#c8d2df]">·</span>
          Independent civic-tech assistant. Not a government application.
        </p>
        <nav aria-label="Site footer" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/about" className="hover:text-[#28659c]">About</Link>
          <Link href="/faq" className="hover:text-[#28659c]">FAQ</Link>
          <Link href="/" className="hover:text-[#28659c]">Chat</Link>
          <span className="text-[#c8d2df]">·</span>
          <span>v0.1</span>
        </nav>
      </div>
    </footer>
  );
}
