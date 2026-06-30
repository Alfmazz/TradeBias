import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://trade-bias.vercel.app";
const TITLE = "TradeBias — Clarity over prediction";
const DESCRIPTION =
  "Read the market's mood, not its future. TradeBias gives you a clear, rule-based technical bias (bullish, bearish, or neutral) for any ticker — plus a 0DTE options structure view and related news. No predictions, no hype. Bilingual (EN/ES).";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "TradeBias",
  keywords: [
    "TradeBias",
    "market bias",
    "technical analysis",
    "stock analysis",
    "0DTE",
    "options",
    "RSI",
    "MACD",
    "VWAP",
    "trading",
    "bilingual trading tool",
  ],
  authors: [{ name: "TradeBias" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "TradeBias",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
