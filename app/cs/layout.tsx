import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/cs" },
};

export default function CustomerSupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
