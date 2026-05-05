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
  title: "책인감 — 나만의 독서 SNS",
  description: "독후감을 남기고, 책을 사랑하는 사람들과 나눠요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${notoSansKR.variable} ${nanumMyeongjo.variable}`}>
      <body className="min-h-screen flex flex-col bg-cream-100 text-brown-800">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="py-8 text-center text-sm text-brown-400 border-t border-cream-200">
          © 2026 책인감 — 책과 함께하는 일상
        </footer>
      </body>
    </html>
  );
}
