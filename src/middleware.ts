import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // ROLLOUT NOTE (read before adding a path here): this matcher only lists
  // paths that have actually been migrated to src/app/[locale]/. Anything
  // NOT listed here never touches this middleware at all, so it keeps
  // behaving exactly like it did before i18n existed — zero risk of
  // breaking /dashboard, /admin, /api, or any not-yet-migrated public page
  // (asset/[code], login, register, the marketing pages, legal, etc.).
  //
  // Today this is just the home page ("/" plus its /es and /pt versions).
  // As each additional page gets moved under [locale] (see
  // MAINTLYQR_FEATURE_BACKLOG.md for the rollout order), add its path(s)
  // here too. Do NOT switch this to a broad catch-all matcher until every
  // in-scope page has actually been migrated — a broad matcher would 404
  // any matched path that doesn't have a [locale] version yet.
  matcher: ["/", "/(es|pt)/:path*"],
};
