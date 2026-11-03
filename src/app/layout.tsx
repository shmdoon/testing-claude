import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { t } from "@/i18n";
import "./globals.css";

// Self-hosted at build time by next/font: no runtime request to Google.
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: t("common.appName"), template: `%s · ${t("common.appName")}` },
  description: t("marketing.heroSubtitle"),
  applicationName: t("common.appName"),
  openGraph: {
    type: "website",
    siteName: t("common.appName"),
    locale: "en_IN",
    title: t("marketing.heroTitle"),
    description: t("marketing.heroSubtitle"),
  },
  twitter: { card: "summary_large_image", title: t("marketing.heroTitle"), description: t("marketing.heroSubtitle") },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#141726" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${lexend.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("common.skipToContent")}
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
