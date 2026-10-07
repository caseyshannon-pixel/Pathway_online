// Where to send someone after they sign in again. Only course pages are allowed,
// so a crafted link can't redirect people somewhere else.
export function safeNext(value: unknown): string | null {
  const s = typeof value === "string" ? value : "";
  return /^\/course(\/\d{1,3})?$/.test(s) ? s : null;
}
