import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every <Image> in this app points at a local file under /public/images —
  // profile/asset photos from Supabase Storage are rendered via plain <img>
  // tags (see HoverAvatar.tsx), not next/image, so there's no remote domain
  // that needs to be allow-listed here. That means we can safely let Next.js
  // optimize (resize + serve WebP/AVIF) the local images for free, instead of
  // shipping the full-size PNGs to every device.
};

export default nextConfig;