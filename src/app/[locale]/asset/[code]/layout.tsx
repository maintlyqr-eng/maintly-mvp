import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";

// Incremento 28 (Facu): "capaz mejor poner un cartelito q diga algo mas
// confiable q una pagina web" -- pidió que compartir/abrir el link de un
// equipo se vea con marca (título + foto) en vez de un link pelado. El
// cartelito puntual que aparece AL ESCANEAR con la cámara nativa del
// teléfono no se puede tocar (ver charla con Facu — es a propósito de
// iOS/Android, no busca vista previa antes de que el usuario toque, por
// privacidad). Pero en TODOS los demás lugares donde este link puede
// aparecer -- compartido por WhatsApp, pegado en Slack, una vista previa de
// Safari/Chrome -- sí se puede armar una tarjeta con el nombre del equipo y
// su foto, vía Open Graph / Twitter Card.
//
// asset/[code]/page.tsx es "use client" (usa hooks, estado, etc.), y
// generateMetadata solo puede vivir en un Server Component -- por eso esto
// va en un layout.tsx nuevo en la misma carpeta en vez de tocar la página:
// Next.js permite que un layout defina metadata para todo lo que renderiza
// adentro, sin que la página en sí tenga que dejar de ser "use client".
//
// La consulta acá replica exactamente la misma lógica de qr_codes -> asset
// que ya usa la página (mismas columnas, mismo filtro deleted_at) para que
// el título/imagen coincidan con lo que la persona realmente va a ver.
// Usa la anon key (no getSupabaseAdmin) porque "assets: lectura pública
// total" ya permite este mismo read sin sesión -- ver supabase/schema.sql.

type AssetMetaRow = {
  asset_type: string;
  brand: string | null;
  model: string | null;
  nickname: string | null;
  photo_url: string | null;
};

const FALLBACK_IMAGE = { url: "/images/login-hero-desktop-light.png", width: 1672, height: 941 };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}): Promise<Metadata> {
  const { locale, code } = await params;
  const t = await getTranslations({ locale, namespace: "AssetMetadata" });

  const genericTitle = t("genericTitle");
  const genericDescription = t("genericDescription");
  const fallback: Metadata = {
    title: genericTitle,
    description: genericDescription,
    openGraph: { title: genericTitle, description: genericDescription, images: [FALLBACK_IMAGE], siteName: "MaintlyQR" },
    twitter: { card: "summary_large_image", title: genericTitle, description: genericDescription, images: [FALLBACK_IMAGE.url] },
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || !code) return fallback;

  try {
    const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    const { data: qrRow } = await supabase.from("qr_codes").select("asset_id").eq("code", code).single();
    if (!qrRow?.asset_id) return fallback; // código inexistente, o QR válido pero todavía sin asignar

    const { data } = await supabase
      .from("assets")
      .select("asset_type, brand, model, nickname, photo_url")
      .eq("id", qrRow.asset_id)
      .is("deleted_at", null)
      .single();
    const asset = data as AssetMetaRow | null;
    if (!asset) return fallback;

    // Mismo namespace/patrón dinámico que ya usa asset/[code]/page.tsx
    // (`tAssetTypes(asset.asset_type)`) para traducir el enum de la DB.
    const tAssetTypes = await getTranslations({ locale, namespace: "AssetTypes" });
    const typeLabel = tAssetTypes(asset.asset_type) || asset.asset_type;

    const displayName =
      asset.nickname?.trim() ||
      [asset.brand, asset.model].filter(Boolean).join(" ").trim() ||
      typeLabel;

    const title = t("assetTitle", { name: displayName });
    const description = t("assetDescription", { type: typeLabel });
    const image = asset.photo_url
      ? { url: asset.photo_url, alt: displayName }
      : { ...FALLBACK_IMAGE, alt: displayName };

    return {
      title,
      description,
      openGraph: { title, description, images: [image], siteName: "MaintlyQR" },
      twitter: { card: "summary_large_image", title, description, images: [image.url] },
    };
  } catch {
    // Cualquier falla de red/consulta cae al genérico -- nunca vale la pena
    // romper el render de la página real por esto.
    return fallback;
  }
}

export default function AssetCodeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
