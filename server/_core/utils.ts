export function ensureNullIfEmpty(
  value: string | null | undefined
): Date | null | undefined {
  if (value === null || value === undefined) return value;
  if (value === "") return null;
  return new Date(value);
}
