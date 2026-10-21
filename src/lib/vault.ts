import crypto from "crypto";

// Cifrado de secretos de la bóveda de Marketing (migración 059). Solo
// servidor. AES-256-GCM con una clave derivada de ADMIN_VAULT_KEY (env de
// Vercel). Formato guardado: "v1.<iv b64>.<tag b64>.<cipher b64>".
// Si falta la variable, guardar falla con un error claro (nunca se guarda
// en texto plano como "fallback").

function key(): Buffer {
  const raw = process.env.ADMIN_VAULT_KEY;
  if (!raw || raw.length < 24) throw new Error("ADMIN_VAULT_KEY is not configured.");
  return crypto.createHash("sha256").update(raw).digest();
}

export function vaultConfigured(): boolean {
  const raw = process.env.ADMIN_VAULT_KEY;
  return !!raw && raw.length >= 24;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [v, ivB, tagB, encB] = stored.split(".");
  if (v !== "v1" || !ivB || !tagB || !encB) throw new Error("Bad secret format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
}
