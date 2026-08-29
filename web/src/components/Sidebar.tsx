"use client";

import { Bookmark, CircleHelp, History, Info, MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/BrandLockup";
import { SupportedAgencies } from "@/components/SupportedAgencies";

export type NavigationView = "chat" | "history" | "saved" | "faq" | "about";

const navItems = [
  { label: "Chat", icon: MessageSquareText, target: "chat" as NavigationView },
  { label: "History", icon: History, target: "history" as NavigationView },
  { label: "Saved", icon: Bookmark, target: "saved" as NavigationView },
  { label: "FAQ", icon: CircleHelp, target: "faq" as NavigationView },
  { label: "About", icon: Info, target: "about" as NavigationView },
] as ReadonlyArray<{ label: string; icon: typeof MessageSquareText; target: NavigationView }>;

export function Sidebar({ activeView, onOpenChat, onOpenHistory }: { activeView: NavigationView; onOpenChat: () => void; onOpenHistory: () => void }) {
  const router = useRouter();

  function navigate(label: string, target: NavigationView) {
    if (label === "Chat") onOpenChat();
    else if (label === "History") onOpenHistory();
    else if (label === "Saved") router.push("/saved");
    else if (label === "FAQ") router.push("/faq");
    else if (label === "About") router.push("/about");
    else {
      const section = document.getElementById(target);
      if (section) section.scrollIntoView({ behavior: "smooth", block: "nearest" });
      else router.push(`/#${target}`);
    }
  }

  return (
    <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-[#dfe6ed] bg-white px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex">
      <div className="border-b border-[#e8edf2] pb-4">
        <BrandLockup />
      </div>

      <nav className="mt-4" aria-label="Primary navigation">
        <ul className="space-y-1">
          {navItems.map(({ label, icon: Icon, target }) => {
            const active = activeView === target;
            return (
              <li key={label}>
                <button type="button" onClick={() => navigate(label, target)} aria-current={active ? "page" : undefined} className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28659c] ${active ? "bg-[#eaf2fa] text-[#164f86]" : "text-[#607086] hover:bg-[#f5f7f9] hover:text-[#10243e]"}`}>
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{label}</span>
                  {active && <span className="ml-auto h-4 w-1 rounded-full bg-[#28659c]" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="my-4 border-t border-[#e8edf2]" />
      <SupportedAgencies compact />

      <p id="about" className="mt-auto border-t border-[#e8edf2] pt-3 text-center text-[8.5px] leading-4 text-[#8994a1]">Independent civic-tech assistant<br />Not a government application</p>
    </aside>
  );
}
