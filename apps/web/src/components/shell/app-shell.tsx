"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { VerificationBanner } from "@/components/auth/verification-banner";
import { PolicyUpdateBanner } from "@/components/legal/policy-update-banner";
import { AuthStatus, type AuthState } from "@/components/shell/auth-status";
import { BrandMark } from "@/components/shell/brand-mark";
import { LanguageSwitcher } from "@/components/shell/language-switcher";

import { MobileNav } from "@/components/shell/mobile-nav";
import { NavLink } from "@/components/shell/nav-link";
import { NAV_BY_SURFACE, type ShellSurface } from "@/components/shell/nav-config";
import { ShellFooter } from "@/components/shell/shell-footer";
import { useLocale } from "@/components/shell/locale-provider";
import { localeDirection } from "@/lib/locale";

export interface AppShellProps {
  surface: ShellSurface;
  children: React.ReactNode;
  auth?: AuthState;
  currentPath?: string;
}

export function AppShell({ surface, children, auth, currentPath }: AppShellProps) {
  const pathname = usePathname() ?? "/";
  const activePath = currentPath ?? pathname;
  const { t, locale } = useLocale();
  const items = NAV_BY_SURFACE[surface];
  const homeHref = items[0]?.href ?? "/";

  return (
    <div
      data-shell={surface}
      lang={locale}
      dir={localeDirection(locale)}
      className="flex min-h-dvh min-w-0 max-w-full flex-col bg-surface text-text"
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[90] focus:rounded-control focus:bg-surface-raised focus:px-3 focus:py-2 focus:shadow-md"
      >
        {t("skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/85 backdrop-blur-md">
        <div className="shell-frame grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 py-2 lg:min-h-[4.5rem] lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav items={items} pathname={activePath} auth={auth} />
            <BrandMark href={homeHref} compact />
          </div>
          <nav aria-label={t("menu")} className="hidden items-center gap-1 lg:flex">
            {items.map((item) => (
              <NavLink key={item.href} item={item} pathname={activePath} />
            ))}
          </nav>
          <div className="flex items-center justify-end gap-1.5 sm:gap-3">
            <LanguageSwitcher compact />
            <div className="hidden lg:block">
              <AuthStatus auth={auth} />
            </div>
          </div>
        </div>
      </header>
      <PolicyUpdateBanner />
      <VerificationBanner />
      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
      <ShellFooter surface={surface} />
    </div>
  );
}

export function TravellerShell(props: Omit<AppShellProps, "surface">) {
  return <AppShell surface="traveller" {...props} />;
}

export function ShellMain({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shell-frame flex min-w-0 max-w-full flex-col gap-10 pb-20 pt-10 md:pt-14", className)}
      {...props}
    />
  );
}
