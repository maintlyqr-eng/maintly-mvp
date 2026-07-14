// Hasheo de contraseñas para admin_users (incremento 11, migración 035).
//
// Se usa scrypt del módulo nativo `crypto` de Node en vez de sumar una
// dependencia (bcrypt/argon2): este proyecto ya usa `crypto` para todo lo
// de auth (ver src/lib/adminAuth.ts, hmac + timingSafeEqual), scrypt viene
// incluido sin instalar nada nuevo, y es una función de hasheo de
// contraseñas reconocida (recomendada por OWASP como alternativa a bcrypt)
// — no es "inventar criptografía propia", es usar la primitiva ya provista
// por Node para justamente este caso de uso.
//
// Formato de almacenamiento: "scrypt$<salt hex>$<hash hex>" — el salt va
// en el mismo string guardado (no en una columna aparte) para no tener que
// tocar el schema si el día de mañana cambia el algoritmo; verifyPassword
// lee el salt del string antes de recalcular.

import crypto from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }

  const actual = crypto.scryptSync(password, salt, KEY_LENGTH);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
