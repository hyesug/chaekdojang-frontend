import type { Metadata } from "next";
import { Noto_Sans_KR, Nanum_Myeongjo } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://www.chaekingam.com"),
  title: {
    default: "책인감 - 독후감 쓰고 책 취향을 나누는 독서 SNS",
    template: "%s | 책인감",
  },
  description:
    "책인감은 책을 읽고 난 감상을 기록하고, 다른 사람의 독후감을 보며 책 취향을 나눌 수 있는 독서 SNS입니다.",
  keywords: [
    "책인감",
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
    url: "https://www.chaekingam.com",
    siteName: "책인감",
    title: "책인감 - 독후감 쓰고 책 취향을 나누는 독서 SNS",
    description:
      "책을 읽고 난 감상을 기록하고, 다른 사람의 독후감을 보며 책 취향을 나누는 독서 SNS입니다.",
  },
  twitter: {
    card: "summary",
    title: "책인감 - 독후감 쓰고 책 취향을 나누는 독서 SNS",
    description:
      "책을 읽고 난 감상을 기록하고, 다른 사람의 독후감을 보며 책 취향을 나누는 독서 SNS입니다.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
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
    name: "책인감",
    alternateName: "Chaekingam",
    url: "https://www.chaekingam.com",
    description:
      "책을 읽고 난 감상을 기록하고, 다른 사람의 독후감을 보며 책 취향을 나누는 독서 SNS입니다.",
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
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="py-8 text-center text-sm text-brown-400 border-t border-cream-200">
          © 2026 책인감 — 책과 함께하는 일상
        </footer>
      </body>
    </html>
  );
}
