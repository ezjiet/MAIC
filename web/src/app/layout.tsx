import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "Clarify MY | Public-service information, made clearer", description: "A multilingual, citation-first assistant for Malaysian public-service information." };

export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en-MY"><body>{children}</body></html>; }
