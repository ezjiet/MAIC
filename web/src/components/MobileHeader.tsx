"use client";

import { Bookmark, History, Info, MessageSquareText } from "lucide-react";
import { BrandLockup } from "@/components/BrandLockup";

const mobileNav = [
  { label: "Chat", target: "chat", icon: MessageSquareText },
  { label: "History", target: "history", icon: History },
  { label: "Saved", target: "saved", icon: Bookmark },
  { label: "About", target: "mobile-agencies", icon: Info },
];

export function MobileHeader() {
  return (
    <header className="border-b border-[#dfe6ed] bg-white px-4 py-2 lg:hidden">
      <BrandLockup compact />
    </header>
  );
}

export function MobileNavigation({ activeView, onOpenChat, onOpenHistory }: { activeView: "chat" | "history"; onOpenChat: () => void; onOpenHistory: () => void }) {
  function navigate(label: string, target: string) {
    if (label === "Chat") onOpenChat();
    else if (label === "History") onOpenHistory();
    else document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav aria-label="Mobile navigation" className="mt-4 border-t border-[#e2e8ee] pt-4 lg:hidden">
      <ul className="grid grid-cols-4 gap-1 rounded-xl bg-[#f2f5f7] p-1">
        {mobileNav.map(({ label, target, icon: Icon }) => { const active = (activeView === "chat" && label === "Chat") || (activeView === "history" && label === "History"); return <li key={label}><button type="button" onClick={() => navigate(label, target)} aria-current={active ? "page" : undefined} className={`flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg text-[9px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] ${active ? "bg-white text-[#174f83] shadow-sm" : "text-[#6b7a8c]"}`}><Icon className="size-3.5" aria-hidden="true" />{label}</button></li>; })}
      </ul>
    </nav>
  );
}
