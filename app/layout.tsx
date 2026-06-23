import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/Header";
import AnalyticsTracker from "./components/AnalyticsTracker";
import GoogleAnalytics from "./components/GoogleAnalytics";
import ServiceStatusGuard from "./components/ServiceStatusGuard";
import { shareText } from "./lib/serverApi";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.chaekdojang.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "책도장",
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
    title: "책도장",
    description: shareText(),
  },
  twitter: {
    card: "summary",
    title: "책도장",
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
    <html lang="ko">
      <body className="min-h-screen flex flex-col bg-cream-100 text-brown-800">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <GoogleAnalytics />
        <AnalyticsTracker />
        <ServiceStatusGuard />
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="px-4 py-8 text-center text-sm text-brown-400 border-t border-cream-200">
          <p>2026 책도장. 읽은 책에 나만의 감상을 찍다</p>
          <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <a href="/privacy" className="hover:text-brown-600">개인정보처리방침</a>
            <a href="/terms" className="hover:text-brown-600">이용약관</a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
