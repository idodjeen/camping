import type { Metadata, Viewport } from "next";
import { Assistant, Varela_Round } from "next/font/google";

import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme";

import "./globals.css";

// Body text. Hebrew first: it is the whole interface.
const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  display: "swap",
});

// Titles and big numbers (font-display). It has a single weight.
const varela = Varela_Round({
  weight: "400",
  subsets: ["hebrew", "latin"],
  variable: "--font-varela",
  display: "swap",
});

export const metadata: Metadata = {
  title: "מחנאות",
  description: "מתכננים טיול עם החברים: מי מביא מה, מה קונים, מה אוכלים ומי חייב למי.",
  // Lets iOS launch the Home Screen icon as a standalone app (required for push).
  // "default" rather than black-translucent: the bar then takes theme-color,
  // which the theme script keeps in step with light and dark. A translucent
  // bar always has white text, unreadable over the light canvas.
  appleWebApp: { capable: true, title: "מחנאות", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // An app, not a document: the screen stays at its own width. This also
  // stops iOS from zooming in when a small-font field gets focus.
  maximumScale: 1,
  userScalable: false,
  // Per device setting until the script in <head> applies a stored choice.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
  // Lets the page paint under the notch / home indicator so env(safe-area-inset-*)
  // has something to work with.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT rewrites data-theme before React
    // hydrates, and the DOM must win. It covers this element's attributes only.
    <html
      lang="he"
      dir="rtl"
      data-theme="light"
      suppressHydrationWarning
      className={`${assistant.variable} ${varela.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
