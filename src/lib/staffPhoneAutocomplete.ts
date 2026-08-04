export function defaultNormalize(value: string) {
  return value.replace(/[^0-9+]/g, "");
}

export function normalizeLocalPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function toLocalPhone(phone: string) {
  return phone.startsWith("+84") ? `0${phone.slice(3)}` : phone;
}

export function formatPhone(local: string): string {
  if (/^0\d{9}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return local;
}

export function selectedSuggestionPhone(
  entry: { local: string },
  normalize: (value: string) => string = defaultNormalize,
  maxLength = 13,
) {
  return normalize(entry.local).slice(0, maxLength);
}
