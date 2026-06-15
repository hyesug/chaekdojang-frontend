import type { Metadata } from "next";
import { Noto_Sans_KR, Nanum_Myeongjo } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import AnalyticsTracker from "./components/AnalyticsTracker";
import { shareText } from "./lib/serverApi";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sans-kr",
  display: "swap",
});

const nanumMyeongjo = Nanum_Myeongjo({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-serif-kr",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.chaekdojang.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "책도장 - 독후감 쓰고 책 취향을 나누는 독서 SNS",
    template: "%s | 책도장",
  },
  description:
    shareText(),
  keywords: [
    "책도장",
    "독서 SNS",
    "독후감",
    "독서 기록",
    "책 리뷰",
    "서평",
    "책 추천",
    "내 서재",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "책도장",
    title: "책도장 - 독후감 쓰고 책 취향을 나누는 독서 SNS",
    description: shareText(),
  },
  twitter: {
    card: "summary",
    title: "책도장 - 독후감 쓰고 책 취향을 나누는 독서 SNS",
    description: shareText(),
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  verification: {
    other: {
      "naver-site-verification": "f56764e0a735a04ffcf4979924675bceab30c8a7",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "책도장",
    alternateName: "Chaekdojang",
    url: siteUrl,
    description: shareText(),
    inLanguage: "ko-KR",
  };

  return (
    <html lang="ko" className={`${notoSansKR.variable} ${nanumMyeongjo.variable}`}>
      <body className="min-h-screen flex flex-col bg-cream-100 text-brown-800">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AnalyticsTracker />
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="py-8 text-center text-sm text-brown-400 border-t border-cream-200">
          © 2026 책도장 — 책과 함께하는 일상
        </footer>
      </body>
    </html>
  );
}
