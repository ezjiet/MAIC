import type { Metadata } from "next";
import { FaqPage } from "@/components/FaqPage";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Clarify MY",
  description: "Help and guidance for using Clarify MY.",
};

export default function FrequentlyAskedQuestionsPage() {
  return <FaqPage />;
}
