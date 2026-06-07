import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { getAuthCookieName, parseSessionCookie } from "@/lib/auth/session";

const intlMiddleware = createMiddleware(routing);
const PUBLIC_SEGMENTS = new Set(["login"]);

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const [, maybeLocale, maybeSegment] = pathname.split("/");
  const locale = routing.locales.includes(maybeLocale as "zh" | "en" | "ja" | "ko")
    ? maybeLocale
    : routing.defaultLocale;
  const segment = maybeLocale === locale ? maybeSegment : maybeLocale;
  const isPublicPage = PUBLIC_SEGMENTS.has(segment);
  const hasSession = Boolean(parseSessionCookie(request.cookies.get(getAuthCookieName())?.value));

  if (!hasSession && !isPublicPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublicPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = `/${locale}`;
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
