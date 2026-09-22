import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";

import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "מחנאות 2026",
  description: "מי מביא מה, מה אוכלים, ומה עוד צריך לקנות.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06060c",
  // Lets the page paint under the notch / home indicator so env(safe-area-inset-*)
  // has something to work with.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} dark`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
