import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kinlock — The family calendar that actually stays in sync",
  description:
    "Two-way calendar sync, real permissions, and an honest free tier. Built for families who outgrew Cozi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
