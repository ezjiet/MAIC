"use client";

import { Bookmark, CircleHelp, History, Info, MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/BrandLockup";
import type { NavigationView } from "@/components/Sidebar";

const mobileNav = [
  { label: "Chat", target: "chat", icon: MessageSquareText },
  { label: "History", target: "history", icon: History },
  { label: "Saved", target: "saved", icon: Bookmark },
  { label: "FAQ", target: "faq", icon: CircleHelp },
  { label: "About", target: "about", icon: Info },
] satisfies ReadonlyArray<{ label: string; target: NavigationView; icon: typeof MessageSquareText }>;

export function MobileHeader() {
  return (
    <header className="border-b border-[#dfe6ed] bg-white px-4 py-2 lg:hidden">
      <BrandLockup compact />
    </header>
  );
}

export function MobileNavigation({ activeView, onOpenChat, onOpenHistory }: { activeView: NavigationView; onOpenChat: () => void; onOpenHistory: () => void }) {
  const router = useRouter();

  function navigate(label: string, target: string) {
    if (label === "Chat") onOpenChat();
    else if (label === "History") onOpenHistory();
    else if (label === "Saved") router.push("/saved");
    else if (label === "FAQ") router.push("/faq");
    else if (label === "About") router.push("/about");
    else {
      const section = document.getElementById(target);
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      else router.push(`/#${target}`);
    }
  }

  return (
    <nav aria-label="Mobile navigation" className="mt-4 border-t border-[#e2e8ee] pt-4 lg:hidden">
      <ul className="grid grid-cols-5 gap-1 rounded-xl bg-[#f2f5f7] p-1">
        {mobileNav.map(({ label, target, icon: Icon }) => {
          const active = activeView === target;
          return <li key={label}><button type="button" onClick={() => navigate(label, target)} aria-current={active ? "page" : undefined} className={`flex min-h-10 w-full items-center justify-center gap-1 rounded-lg text-[9px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] ${active ? "bg-white text-[#174f83] shadow-sm" : "text-[#6b7a8c]"}`}><Icon className="size-3.5" aria-hidden="true" />{label}</button></li>;
        })}
      </ul>
    </nav>
  );
}
