import type { Metadata } from "next";
import { SavedAnswersPage } from "@/components/SavedAnswersPage";

export const metadata: Metadata = {
  title: "Saved Answers | Clarify MY",
  description: "Find and revisit answers bookmarked in Clarify MY.",
};

export default function SavedPage() {
  return <SavedAnswersPage />;
}
