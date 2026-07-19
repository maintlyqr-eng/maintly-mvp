// Facu (19 jul 2026): "qué pasa si una persona por hacer bromas o daño
// escribe cosas impropias?" — a lightweight, dependency-free profanity
// filter for free-text fields. First (and currently only) consumer is the
// "Notas" field on Agregar Servicio: since a logged service can no longer
// be edited afterwards (see the comment above `viewRow` in
// dashboard/services/page.tsx), catching obviously inappropriate text at
// save time is the only real chance to keep it out of a permanent record.
//
// Deliberately NOT pulling in an external package (e.g. leo-profanity):
// this repo has zero content-moderation dependencies today, and adding one
// means a new package-lock.json entry that has to survive Facu's next
// `npm install` + Vercel build before this even works. A curated word list
// covers the 3 supported locales without that risk, and is just an array
// to extend later.
//
// Matching approach: lowercase + strip accents + collapse common
// leetspeak substitutions (@ -> a, 0 -> o, 1/! -> i, 3 -> e, $ -> s), then
// a word-boundary regex per single-word term (so "clasico" doesn't trip on
// "asco") or a plain substring check for multi-word phrases (where a
// boundary-perfect regex is more trouble than it's worth).
//
// This is intentionally a blunt, best-effort filter — not a moderation
// system. It WILL miss creative misspellings and WILL occasionally false-
// positive on an innocent word that happens to contain a blocked
// substring; if that becomes a real problem the fix is to trim the list,
// not to over-engineer the matcher.

const BLOCKLIST: Record<"es" | "en" | "pt", string[]> = {
  es: [
    "puto", "puta", "putos", "putas", "pendejo", "pendeja", "boludo", "boluda",
    "gil", "forro", "forra", "cornudo", "hijo de puta", "hdp",
    "concha de tu madre", "la concha", "pelotudo", "pelotuda", "imbecil",
    "idiota", "estupido", "estupida", "mierda", "carajo", "cagada", "verga",
    "chupapija", "chupame", "andate a la mierda", "andate a cagar", "sorete",
    "trolo", "trola", "puta madre", "reputisima", "conchudo", "malparido",
    "malparida", "hijueputa",
  ],
  en: [
    "fuck", "fucking", "fucker", "shit", "bullshit", "bitch", "asshole",
    "ass hole", "bastard", "cunt", "dick", "dickhead", "piss off",
    "damn you", "retard", "retarded", "faggot", "nigger", "nigga", "whore",
    "slut", "cock", "twat", "motherfucker", "douchebag", "prick",
  ],
  pt: [
    "puta", "putinha", "puto", "caralho", "porra", "merda", "bosta",
    "cacete", "desgraca", "desgracado", "desgracada", "corno", "corna",
    "vagabundo", "vagabunda", "filho da puta", "fdp", "arrombado",
    "arrombada", "idiota", "imbecil", "otario", "otaria", "viado", "cuzao",
    "cuzona", "vai tomar no cu", "vsf",
  ],
};

const ALL_TERMS: string[] = [...BLOCKLIST.es, ...BLOCKLIST.en, ...BLOCKLIST.pt];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (accented vowels, ñ, etc. via NFD)
    .replace(/[@]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[$]/g, "s");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `text` contains a blocked term (checked across es/en/pt at once). */
export function containsInappropriateContent(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return false;
  const normalized = normalize(text);
  return ALL_TERMS.some((term) => {
    const normTerm = normalize(term);
    if (normTerm.includes(" ")) return normalized.includes(normTerm);
    return new RegExp(`\\b${escapeRegex(normTerm)}\\b`, "i").test(normalized);
  });
}
