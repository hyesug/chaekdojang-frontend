import type { Metadata, Viewport } from "next";
import Link from "next/link";
// 글꼴은 사이트에 함께 싣는다. 사용자 PC에 설치된 글꼴에 따라 화면이 달라지지 않도록.
// 두 파일 모두 글자 범위별로 쪼개져 있어 화면에 쓰인 글자 조각만 내려받는다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource/noto-serif-kr/korean-600.css";
import "@fontsource/noto-serif-kr/korean-700.css";
import "./globals.css";
import Header from "./components/Header";
import AnalyticsTracker from "./components/AnalyticsTracker";
import GoogleAnalytics from "./components/GoogleAnalytics";
import ServiceStatusGuard from "./components/ServiceStatusGuard";
import IosInstallBanner from "./components/IosInstallBanner";
import { shareText } from "./lib/serverApi";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.chaekdojang.com";
const themeColor = "#174A46";

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "책도장",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/chaekdojang-logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/chaekdojang-logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/chaekdojang-logo-192.png", sizes: "192x192", type: "image/png" },
    ],
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor,
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
        <IosInstallBanner />
        <footer className="mt-12 border-t border-cream-300 bg-cream-50">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 font-serif text-lg font-bold text-brown-800">
                <span className="stamp-mark pointer-events-none" aria-hidden="true">冊</span>
                책도장
              </Link>
              <p className="mt-2 text-sm text-sage-600">읽은 책에 나만의 감상을 찍다</p>
            </div>
            <nav aria-label="서비스 정보" className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-sage-600">
              <Link href="/cs" className="transition-colors hover:text-brown-800">고객센터</Link>
              <Link href="/install" className="transition-colors hover:text-brown-800">앱 설치</Link>
              <Link href="/terms" className="transition-colors hover:text-brown-800">이용약관</Link>
              <Link href="/privacy" className="font-semibold text-brown-700 transition-colors hover:text-brown-800">개인정보처리방침</Link>
              <Link href="/payment-info" className="transition-colors hover:text-brown-800">환불·결제 안내</Link>
            </nav>
          </div>
          <div className="border-t border-cream-300">
            <p className="mx-auto max-w-6xl px-5 py-4 text-xs text-sage-600">© 2026 책도장. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
