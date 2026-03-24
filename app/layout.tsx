import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TEKTONIC - DJ Mixing Platform",
  description: "Professional DJ mixing application with track analysis and mixing capabilities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${fontMono.variable}`}>
      <body className="antialiased min-h-screen font-sans selection:bg-primary/30 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
