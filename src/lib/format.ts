export function euro(value: unknown) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(number) ? number : 0);
}

export function dateTime(value: string | Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
