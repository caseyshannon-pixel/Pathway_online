import type { Session } from "./session";

/**
 * Admins are listed by Planning Center person id in the ADMIN_PERSON_IDS
 * environment variable (comma-separated). With it unset, nobody is an admin.
 */
export function isAdmin(session: Session | null): boolean {
  if (!session) return false;
  const ids = (process.env.ADMIN_PERSON_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(session.personId);
}
