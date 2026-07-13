import { defineRouting } from "next-intl/routing";

// Facu's ask: MaintlyQR needs to work in other languages, but there are
// already physical QR stickers out in the world pointing at un-prefixed
// URLs like maintlyqr.com/asset/ABC123 — those can never break. `as-needed`
// means the default locale (English) never gets a URL prefix at all, so
// every link that already exists (printed stickers, saved bookmarks,
// anything shared before today) keeps working exactly as-is. Only the
// non-default locales get a prefix: /es/asset/ABC123, /pt/asset/ABC123.
//
// Rollout note: this file declares all three locales, but the middleware
// (src/middleware.ts) only actually routes the pages that have been
// migrated under src/app/[locale]/ so far — everything else keeps using
// its old, un-migrated, always-English route untouched. See the matcher
// comment in middleware.ts before adding a locale-aware page here.
export const routing = defineRouting({
  locales: ["en", "es", "pt"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
