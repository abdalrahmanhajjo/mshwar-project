import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import localFont from "next/font/local";
import { CookieConsent, CookieConsentProvider } from "@/components/legal/cookie-consent";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { SignedInLocaleSync } from "@/components/shell/locale-sync";
import { CONSENT_COOKIE } from "@/lib/cookie-consent";
import { LOCALE_COOKIE, LOCALE_HEADER, localeDirection, parseLocale } from "@/lib/locale";
import "./globals.css";

const dmSans = localFont({
  src: [{ path: "./fonts/dm-sans-latin-opsz.woff2", weight: "100 1000", style: "normal" }],
  variable: "--font-latin-face",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const newsreader = localFont({
  src: [{ path: "./fonts/newsreader-latin-opsz-italic.woff2", weight: "200 800", style: "italic" }],
  variable: "--font-display-face",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

const notoSansArabic = localFont({
  src: [{ path: "./fonts/noto-sans-arabic-wght.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-arabic-face",
  display: "swap",
  fallback: ["Tahoma", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Mshwar — Plan Your Lebanon Trip",
  description: "Discover. Plan. Book Lebanon. AI-powered itinerary builder.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = parseLocale(headerStore.get(LOCALE_HEADER) ?? cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale} dir={localeDirection(locale)} suppressHydrationWarning>
      <body className={`${dmSans.variable} ${newsreader.variable} ${notoSansArabic.variable}`}>
        <LocaleProvider initialLocale={locale}>
          <CookieConsentProvider initial={cookieStore.get(CONSENT_COOKIE)?.value ?? null}>
            <AuthProvider>
              <SignedInLocaleSync />
              {children}
            </AuthProvider>
            <CookieConsent />
          </CookieConsentProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
