// Server-only. A short log of failed sign-ins for the dashboard (Admin > Dashboard, bottom).
//
// Only the last 300 problems from the last 30 days are kept. Email addresses are saved
// masked (like j***@gmail.com), enough to spot a typo or a domain without keeping
// a list of addresses. Logging is best effort: it never blocks or breaks a sign-in.

import { privateStorageConfigured, readSecure, storageConfigured, writeSecure } from "./blobStore";

export type FailureReason =
  | "no_profile"
  | "send_failed"
  | "send_error"
  | "rate_limited"
  | "link_expired"
  | "link_error"
  | "pick_expired"
  | "pco_denied"
  | "pco_state"
  | "pco_failed";

/** Plain-English labels, and a hint about what usually causes each. */
export const FAILURE_LABELS: Record<FailureReason, { label: string; hint: string }> = {
  no_profile: { label: "Email not found", hint: "No Planning Center profile has that email. Usually a typo or a different email than the church has." },
  send_failed: { label: "Email wouldn't send", hint: "Resend refused the message. Check the Resend domain and key." },
  send_error: { label: "Couldn't start sign-in", hint: "Something failed before the email went out (Planning Center or storage)." },
  rate_limited: { label: "Too many tries", hint: "Someone asked for links too quickly and was slowed down." },
  link_expired: { label: "Link expired or already used", hint: "The link was older than 30 minutes, or was already opened (often by an email scanner or a second tap)." },
  link_error: { label: "Link failed", hint: "Something broke while checking the link." },
  pick_expired: { label: "Name list timed out", hint: "On a shared email, they waited too long to choose who they are." },
  pco_denied: { label: "Planning Center: cancelled", hint: "They backed out of the Planning Center login." },
  pco_state: { label: "Planning Center: expired", hint: "The Planning Center sign-in took too long or was opened in a different browser." },
  pco_failed: { label: "Planning Center: failed", hint: "Planning Center sign-in didn't finish." },
};

export type Failure = { at: string; reason: FailureReason; email: string };

const PATH = "pathway/login-failures.json";
const MAX = 300;
const KEEP_MS = 30 * 86_400_000;

export function maskEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return "";
  return `${local[0]}***@${domain}`.slice(0, 80);
}

function clean(data: unknown): Failure[] {
  if (!Array.isArray(data)) return [];
  const cutoff = Date.now() - KEEP_MS;
  return (data as Record<string, unknown>[])
    .map((r) => ({ at: String(r?.at ?? ""), reason: String(r?.reason ?? "") as FailureReason, email: String(r?.email ?? "") }))
    .filter((r) => Date.parse(r.at) > cutoff && r.reason in FAILURE_LABELS);
}

const available = () => storageConfigured() || privateStorageConfigured();

export async function getFailures(): Promise<Failure[]> {
  if (!available()) return [];
  try {
    return clean(await readSecure(PATH));
  } catch (err) {
    console.error("Could not read the sign-in problems log:", err);
    return [];
  }
}

export async function recordFailure(reason: FailureReason, email = "") {
  if (!available()) return;
  try {
    const list = clean(await readSecure(PATH));
    list.push({ at: new Date().toISOString(), reason, email: email ? maskEmail(email) : "" });
    await writeSecure(PATH, list.slice(-MAX));
  } catch (err) {
    console.error("Could not record a sign-in problem:", err);
  }
}
