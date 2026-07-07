import { SupabaseClient } from "@supabase/supabase-js";
import { validateImageFile } from "@/lib/imageValidation";

// Shared by every place that uploads a photo for an asset (new-asset form,
// edit-asset form) so the validation + storage path logic lives in one spot
// instead of being copy-pasted per form.
export async function uploadAssetPhoto(
  supabase: SupabaseClient,
  file: File,
  assetId: string
): Promise<{ url: string | null; error: string | null }> {
  const validationError = validateImageFile(file);
  if (validationError) return { url: null, error: validationError };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${assetId}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("asset-photos")
    .upload(path, file, { upsert: true });
  if (uploadError) return { url: null, error: uploadError.message };

  const { data } = supabase.storage.from("asset-photos").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export function genAssetQrCode(): string {
  const raw = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36);
  return raw.replace(/-/g, "").slice(0, 10);
}
