import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // ROLLOUT NOTE (read before adding a path here): this matcher only lists
  // paths that have actually been migrated to src/app/[locale]/. Anything
  // NOT listed here never touches this middleware at all, so it keeps
  // behaving exactly like it did before i18n existed — zero risk of
  // breaking /dashboard, /admin, /api, or any not-yet-migrated public page
  // (login, register, the marketing pages, legal, etc.).
  //
  // IMPORTANT — each migrated route needs TWO entries here, not one: the
  // bare path (for the default "en" locale, which never gets a URL prefix —
  // see localePrefix:"as-needed" in src/i18n/routing.ts) AND the same path
  // under "/(es|pt)/..." (for the two prefixed locales). A catch-all like
  // "/(es|pt)/:path*" is a trap — it would match EVERY path under those two
  // prefixes, including ones that don't have a [locale] version yet (e.g.
  // "/es/asset/ABC123/report", which doesn't exist until the report page is
  // migrated too), and 404. List exact patterns instead, one pair per
  // migrated route:
  //   - "/asset/:code" matches exactly one segment after "/asset/" (e.g.
  //     "/asset/ABC123"), so it does NOT also swallow "/asset/ABC123/report"
  //     — that subpage stays on its own old, un-migrated, English-only route
  //     until it's migrated in its own turn.
  //
  // As each additional page gets moved under [locale] (see
  // MAINTLYQR_FEATURE_BACKLOG.md for the rollout order), add its pair here
  // too. Do NOT switch this to a broad catch-all until every in-scope page
  // has actually been migrated.
  matcher: [
    "/",
    "/(es|pt)",
    "/asset/:code",
    "/(es|pt)/asset/:code",
    "/asset/:code/report",
    "/(es|pt)/asset/:code/report",
    "/maintler/:code",
    "/(es|pt)/maintler/:code",
    "/qr-empty",
    "/(es|pt)/qr-empty",
    "/login",
    "/(es|pt)/login",
    "/register",
    "/(es|pt)/register",
    "/product",
    "/(es|pt)/product",
    "/how-it-works",
    "/(es|pt)/how-it-works",
    "/industries",
    "/(es|pt)/industries",
    "/pricing",
    "/(es|pt)/pricing",
    "/resources",
    "/(es|pt)/resources",
    "/about",
    "/(es|pt)/about",
    // "/api" here matches only the exact marketing page at src/app/api/
    // (Item "Connect Your Software") — it does NOT touch "/api/admin/..."
    // or any other route-handler path, since this is an exact-segment
    // pattern, not a prefix/catch-all.
    "/api",
    "/(es|pt)/api",
    "/legal",
    "/(es|pt)/legal",
    "/terms",
    "/(es|pt)/terms",
    "/privacy",
    "/(es|pt)/privacy",
    "/cookies",
    "/(es|pt)/cookies",
  ],
};
