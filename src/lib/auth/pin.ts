const pinHashKey = "lucky_list_pin_hash";
const pinSaltKey = "lucky_list_pin_salt";
const privateSessionKey = "lucky_private_session";

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}

export async function hashPin(pin: string, salt: string) {
  const payload = new TextEncoder().encode(`${salt}:${pin}`);
  return bytesToHex(await crypto.subtle.digest("SHA-256", payload));
}

export function newPinSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hasSavedPin() {
  return Boolean(localStorage.getItem(pinHashKey) && localStorage.getItem(pinSaltKey));
}

export function hasPrivateSession() {
  return localStorage.getItem(privateSessionKey) === "true";
}

export function unlockPrivateSession() {
  localStorage.setItem(privateSessionKey, "true");
}

export function lockPrivateSession() {
  localStorage.removeItem(privateSessionKey);
}

export async function savePin(pin: string) {
  const salt = newPinSalt();
  localStorage.setItem(pinSaltKey, salt);
  localStorage.setItem(pinHashKey, await hashPin(pin, salt));
  unlockPrivateSession();
}

export async function verifyPin(pin: string) {
  const salt = localStorage.getItem(pinSaltKey);
  const savedHash = localStorage.getItem(pinHashKey);
  if (!salt || !savedHash) return false;
  return (await hashPin(pin, salt)) === savedHash;
}

export function resetPin() {
  localStorage.removeItem(pinHashKey);
  localStorage.removeItem(pinSaltKey);
  lockPrivateSession();
}

