import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Points at src/i18n/request.ts, which loads the right messages/{locale}.json
// for each request — see that file and src/middleware.ts for the rest of the
// i18n setup (added July 2026, MaintlyQR going multi-language).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Every <Image> in this app points at a local file under /public/images —
  // profile/asset photos from Supabase Storage are rendered via plain <img>
  // tags (see HoverAvatar.tsx), not next/image, so there's no remote domain
  // that needs to be allow-listed here. That means we can safely let Next.js
  // optimize (resize + serve WebP/AVIF) the local images for free, instead of
  // shipping the full-size PNGs to every device.
  //
  // Explicit `images` config (added as part of the July 9, 2026 cleanup pass):
  // without this, Next only serves WebP (not the smaller AVIF) and falls back
  // to generic device-size breakpoints not tuned to this app. This is what
  // makes the homepage background (and every other next/image in the app)
  // load fast without needing to hand-compress each source file — Next
  // resizes + re-encodes to whichever format/size the requesting device
  // actually needs, on demand.
  images: {
    formats: ["image/avif", "image/webp"],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2560, 3840],
  },
};

export default withNextIntl(nextConfig);