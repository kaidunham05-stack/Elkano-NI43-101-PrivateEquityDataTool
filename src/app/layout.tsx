import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Elkano | NI 43-101 Intelligence Platform",
  description: "AI-powered extraction and analysis of NI 43-101 technical mining reports. Identify high-potential projects where geological uncertainty is collapsing faster than market pricing.",
  keywords: ["NI 43-101", "mining", "technical reports", "AI analysis", "resource extraction", "investment analysis"],
  authors: [{ name: "Elkano" }],
  openGraph: {
    title: "Elkano | NI 43-101 Intelligence Platform",
    description: "AI-powered extraction and analysis of NI 43-101 technical mining reports.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
