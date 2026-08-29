import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { ChatSessionProvider } from "@/components/ChatSessionProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Clarify MY | Public-service information, made clearer",
  description:
    "A multilingual, citation-first assistant for Malaysian public-service information.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-MY" className={inter.variable}>
      <body className="bg-[#f5f8fb] text-[#10243e] antialiased">
        <ChatSessionProvider>{children}</ChatSessionProvider>
      </body>
    </html>
  );
}
