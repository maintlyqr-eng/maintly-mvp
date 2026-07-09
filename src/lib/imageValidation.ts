// Shared client-side guard for user-uploaded photos (asset photos, mechanic
// profile photos). The <input accept="image/*"> attribute is only a UI hint —
// it does not stop someone from picking a 200MB file or renaming a .exe to
// .png, so every upload path should call this before hitting Supabase Storage.

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please choose an image file (JPG, PNG, WEBP...).";
  }
  if (file.type === "image/svg+xml") {
    return "SVG files aren't supported. Please choose a JPG, PNG, or WEBP image.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is 8MB.`;
  }
  return null;
}
