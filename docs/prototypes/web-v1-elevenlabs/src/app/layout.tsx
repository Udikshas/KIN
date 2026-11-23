import type { Metadata } from "next";
import { Geist_Mono, Inter, Noto_Sans_Devanagari, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoDeva = Noto_Sans_Devanagari({
  variable: "--font-noto-deva",
  subsets: ["devanagari"],
  weight: ["400", "500"],
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-noto-tamil",
  subsets: ["tamil"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Kin — a daily call for parents who live alone",
  description:
    "Kin phones your parent every evening in their own language, checks sleep, pain and medicine, remembers what they said, and sends you one card about what changed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${notoDeva.variable} ${notoTamil.variable} antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
