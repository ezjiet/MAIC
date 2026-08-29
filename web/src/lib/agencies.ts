import type { Agency } from "@/types/clarify";

export const agencyDetails = {
  KWSP: { name: "KWSP", description: "Savings & Withdrawal", logo: "/agencies/kwsp.png", accent: "#9f2942", tint: "#fff5f7", border: "#f1d4da" },
  LHDN: { name: "LHDN", description: "Tax & Income", logo: "/agencies/lhdn.png", accent: "#1769aa", tint: "#f1f8fd", border: "#d2e6f4" },
  JPJ: { name: "JPJ", description: "Driving & Vehicles", logo: "/agencies/jpj.png", accent: "#263b73", tint: "#fff9eb", border: "#eadcad" },
  MULTI: { name: "Multiple agencies", description: "More than one agency", logo: "", accent: "#465f78", tint: "#f1f5f9", border: "#d7e0e8" },
  UNCLEAR: { name: "Unclear", description: "Outside current scope", logo: "", accent: "#64748b", tint: "#f4f6f8", border: "#dce2e8" },
} satisfies Record<Agency, { name: string; description: string; logo: string; accent: string; tint: string; border: string }>;
