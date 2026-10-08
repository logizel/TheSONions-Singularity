import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter self-hosted via next/font — zero layout shift, no external requests.
 * Loaded with all optical sizes and numeric features for tabular-nums support.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  // Include the numeric variant features via the axes option
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Hospital Stock Balancer — Network Dashboard",
  description:
    "Network inventory balancer — stockouts, waste, transfers and priorities on one screen.",
  // Prevent indexing of internal medical data tool
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
