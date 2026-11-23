import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const notoDeva = Noto_Sans_Devanagari({
  variable: "--font-noto-deva",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-noto-tamil",
  subsets: ["tamil"],
  weight: ["400", "500"],
});

const description =
  "Kin phones your parent every evening in their own language, checks sleep, pain and medicine, remembers what they said, and sends you one card about what changed.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_SITE_URL to the deployed domain so share previews resolve.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Kin: a daily call for parents who live alone",
  description,
  openGraph: { title: "Kin", description, type: "website" },
  twitter: { card: "summary_large_image", title: "Kin", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${notoDeva.variable} ${notoTamil.variable} antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
