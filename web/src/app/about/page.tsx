import type { Metadata } from "next";
import { AboutPage } from "@/components/AboutPage";

export const metadata: Metadata = {
  title: "About | Clarify MY",
  description: "Learn why Clarify MY is making Malaysian public-service information easier to understand.",
};

export default function AboutRoute() {
  return <AboutPage />;
}
