export function normalizeUsername(value: string) {
  return value.trim().replace(/^\/?u\//i, "");
}
