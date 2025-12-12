import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
