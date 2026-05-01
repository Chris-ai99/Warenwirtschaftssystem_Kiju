const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export function normalizeBarcode(input: string) {
  return input.replace(CONTROL_CHARS, "").trim();
}

export function isLikelyScannerBurst(keys: string[]) {
  return keys.length >= 3 && keys.every((key) => key.length === 1);
}

export function isValidBarcode(input: string) {
  const normalized = normalizeBarcode(input);
  return normalized.length >= 3 && normalized.length <= 64;
}
