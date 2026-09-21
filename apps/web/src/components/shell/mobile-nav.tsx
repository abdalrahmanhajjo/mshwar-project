"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { AuthStatus, type AuthState } from "@/components/shell/auth-status";
import { LogoSymbol } from "@/components/shell/brand-mark";
import { NavLink } from "@/components/shell/nav-link";
import { useLocale } from "@/components/shell/locale-provider";
import type { ShellNavItem } from "@/components/shell/nav-config";

const DESKTOP_BREAKPOINT = "(min-width: 64rem)";

export function MobileNav({
  items,
  pathname,
  auth,
  footer,
}: {
  items: ShellNavItem[];
  pathname: string;
  auth?: AuthState;
  footer?: React.ReactNode;
}) {
  const { t } = useLocale();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(DESKTOP_BREAKPOINT);
    const onChange = () => {
      if (media.matches) {
        setOpen(false);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("openMenu")} className="-ms-2 rounded-full">
            <Menu className="size-5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="start" closeLabel={t("closeMenu")} className="lg:hidden">
          <SheetHeader className="flex-row items-center gap-3 pe-10">
            <LogoSymbol className="h-6" />
            <SheetTitle>{t("menu")}</SheetTitle>
          </SheetHeader>
          <nav aria-label={t("menu")} className="flex flex-col gap-1">
            {items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                variant="stack"
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>
          {footer}
          <div className="mt-auto flex flex-col gap-3">
            <LanguageSwitcher />
            <AuthStatus auth={auth} variant="panel" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
