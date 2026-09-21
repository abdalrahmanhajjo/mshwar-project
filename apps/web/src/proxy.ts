import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isProtectedPath, safeNextPath } from "@/lib/auth";
import { LOCALE_COOKIE, LOCALE_HEADER, parseLocale, splitLocalePrefix, withLocalePrefix } from "@/lib/locale";
import { REQUEST_ID_HEADER, newRequestId } from "@/lib/request-id";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Minted here, never taken from the browser, and forwarded to the API through the rewrite.
  const requestId = newRequestId();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  const { locale: prefixLocale, pathname: stripped } = splitLocalePrefix(pathname);
  const locale = prefixLocale ?? parseLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  requestHeaders.set(LOCALE_HEADER, locale);

  function withLocaleCookie(response: NextResponse) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  if (isProtectedPath(stripped) && !request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(locale, "/signin");
    url.search = "";
    url.searchParams.set("next", safeNextPath(`${pathname}${request.nextUrl.search}`));
    return withLocaleCookie(NextResponse.redirect(url));
  }

  if (prefixLocale) {
    const url = request.nextUrl.clone();
    url.pathname = stripped;
    return withLocaleCookie(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
  }

  return withLocaleCookie(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
