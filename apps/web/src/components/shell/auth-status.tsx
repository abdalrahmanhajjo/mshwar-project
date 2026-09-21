"use client";

import { usePathname, useRouter } from "next/navigation";
import { Heart, LogOut, Route, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { isProtectedPath } from "@/lib/auth";
import { splitLocalePrefix, withLocalePrefix } from "@/lib/locale";
import { initials } from "@/lib/text";
import { cn, focusRing } from "@/lib/utils";

export type AuthState = { status: "guest" } | { status: "signed-in"; name: string };

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full border border-border-subtle bg-brand-subtle text-sm font-semibold text-text",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AuthStatus({ auth, variant = "menu" }: { auth?: AuthState; variant?: "menu" | "panel" }) {
  const { t, locale } = useLocale();
  const pathname = usePathname() ?? "/";
  const path = splitLocalePrefix(pathname).pathname;
  const router = useRouter();
  const ctx = useAuth();
  const resolved = auth ?? ctx.auth;

  async function handleSignOut() {
    await ctx.signOut();
    if (isProtectedPath(path)) {
      router.replace(withLocalePrefix(locale, "/"));
    }
  }

  if (resolved.status === "signed-in") {
    const email = ctx.user?.email;
    if (variant === "panel") {
      return (
        <div className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-3">
          <LocaleLink href="/settings" className={cn("flex min-w-0 items-center gap-3 rounded-control", focusRing)}>
            <Avatar name={resolved.name} />
            <span className="grid min-w-0">
              <span className="sr-only">{t("signedInAs")} </span>
              <span className="truncate text-sm font-semibold text-text" title={resolved.name}>
                {resolved.name}
              </span>
              {email ? <span className="truncate text-xs text-text-muted">{email}</span> : null}
            </span>
          </LocaleLink>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleSignOut()}>
            <LogOut aria-hidden />
            {t("signOut")}
          </Button>
        </div>
      );
    }

    const links = [
      { href: "/trips", label: t("myTrips"), icon: Route },
      { href: "/favorites", label: t("favorites"), icon: Heart },
      { href: "/settings", label: t("settings"), icon: Settings },
    ];

    return (
      <Popover>
        <PopoverTrigger
          className={cn("inline-flex items-center gap-2 rounded-full p-0.5 transition hover:opacity-90", focusRing)}
          title={resolved.name}
        >
          <Avatar name={resolved.name} />
          <span className="sr-only">{t("signedInAs")} </span>
          <span className="sr-only">{resolved.name}</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          <div className="flex items-center gap-3 px-2 pb-3 pt-2">
            <Avatar name={resolved.name} />
            <div className="grid min-w-0">
              <p className="truncate text-sm font-semibold">{resolved.name}</p>
              {email ? <p className="truncate text-xs text-text-muted">{email}</p> : null}
            </div>
          </div>
          <nav aria-label={t("accountMenu")} className="grid gap-0.5 border-t border-border-subtle pt-2">
            {links.map((item) => (
              <LocaleLink
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[0.6rem] px-2.5 py-2 text-sm text-text hover:bg-surface-sunken",
                  focusRing,
                )}
              >
                <item.icon className="size-4 text-text-muted" aria-hidden />
                {item.label}
              </LocaleLink>
            ))}
          </nav>
          <div className="mt-2 border-t border-border-subtle pt-2">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className={cn(
                "flex w-full items-center gap-3 rounded-[0.6rem] px-2.5 py-2 text-sm text-text hover:bg-surface-sunken",
                focusRing,
              )}
            >
              <LogOut className="size-4 text-text-muted" aria-hidden />
              {t("signOut")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const next =
    path.startsWith("/signin") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/verify-email")
      ? withLocalePrefix(locale, "/")
      : pathname;

  return (
    <Button
      variant={variant === "panel" ? "default" : "outline"}
      size="sm"
      asChild
      className={cn(variant === "panel" && "w-full")}
    >
      <LocaleLink href={`/signin?next=${encodeURIComponent(next)}`}>{t("signIn")}</LocaleLink>
    </Button>
  );
}
