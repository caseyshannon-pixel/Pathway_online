// Server-only. Finds people who have gone quiet and sends them a nudge email
// through Planning Center. Run on a schedule by /api/cron/nudge.

import { readSecure, writeSecure } from "./blobStore";
import { getAddedAdmins, ownerIds } from "./admin";
import { appOrigin } from "./pco";
import { getWorkflowSnapshot, sendCardEmail } from "./pcoWorkflow";
import { getNudgeSettings, type NudgeSettings } from "./nudgeSettings";

type State = { count: number; lastAt: string; anchor: string };

export type Due = { personId: string; name: string; sessionTitle: string; hoursQuiet: number; nudgeNumber: number };

const HOUR = 3_600_000;
const MAX_PER_RUN = 25;
const stateFile = (personId: string) => `pathway/nudges/${personId}.json`;

/** Fills in {firstName}, {sessionTitle} and {link}. */
export function renderNudge(template: string, v: { firstName: string; sessionTitle: string; link: string }) {
  return template
    .split("{firstName}").join(v.firstName)
    .split("{sessionTitle}").join(v.sessionTitle)
    .split("{link}").join(v.link);
}

export function courseLink() {
  return `${appOrigin("https://pathway.rockc3.com")}/course`;
}

export function easternHour(d = new Date()): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(d);
  return Number(h) % 24;
}

export function windowOpen(s: NudgeSettings, d = new Date()) {
  const h = easternHour(d);
  return h >= s.sendFromHour && h < s.sendToHour;
}

async function readState(personId: string): Promise<State | null> {
  try {
    const data = (await readSecure(stateFile(personId))) as Partial<State> | null;
    if (!data) return null;
    return { count: Number(data.count) || 0, lastAt: String(data.lastAt ?? ""), anchor: String(data.anchor ?? "") };
  } catch {
    return null;
  }
}

/** Everyone due for a nudge right now, longest quiet first. */
export async function findDue(settings: NudgeSettings, now = new Date()) {
  const snapshot = await getWorkflowSnapshot();
  const adminIds = new Set([...ownerIds(), ...(await getAddedAdmins()).map((a) => a.id)]);
  const due: (Due & { cardId: string; anchor: string; firstName: string; completed: number })[] = [];

  for (const c of snapshot.cards) {
    if (!c.personId || c.completed >= snapshot.total || adminIds.has(c.personId)) continue;
    const anchor = c.movedAt || c.createdAt;
    const since = Date.parse(anchor);
    if (!Number.isFinite(since)) continue;
    const quiet = now.getTime() - since;
    if (quiet < settings.inactiveHours * HOUR) continue;

    const state = await readState(c.personId);
    const sameStretch = state && state.anchor === anchor; // no new activity since the last nudge
    const count = sameStretch ? state.count : 0;
    if (count >= settings.maxNudges) continue;
    if (count > 0 && now.getTime() - Date.parse(state!.lastAt) < settings.spacingDays * 24 * HOUR) continue;

    due.push({
      personId: c.personId,
      name: c.name,
      firstName: c.name.split(" ")[0] || "there",
      sessionTitle: snapshot.titles[c.completed] ?? `Session ${c.completed + 1}`,
      completed: c.completed,
      hoursQuiet: Math.floor(quiet / HOUR),
      nudgeNumber: count + 1,
      cardId: c.cardId,
      anchor,
    });
  }
  return due.sort((a, b) => b.hoursQuiet - a.hoursQuiet);
}

/** Preview of who would be nudged, without sending anything. */
export async function previewDue() {
  const settings = await getNudgeSettings();
  const due = await findDue(settings);
  return {
    windowOpen: windowOpen(settings),
    due: due.map(({ personId, name, sessionTitle, hoursQuiet, nudgeNumber }) => ({ personId, name, sessionTitle, hoursQuiet, nudgeNumber })),
  };
}

/** One scheduled pass: sends nudges if they are turned on and the sending window is open. */
export async function runNudges() {
  const settings = await getNudgeSettings();
  if (!settings.enabled) return { skipped: "Nudges are off." };
  if (!windowOpen(settings)) return { skipped: "Outside the sending window." };

  const due = (await findDue(settings)).slice(0, MAX_PER_RUN);
  const link = courseLink();
  let sent = 0;
  let failed = 0;
  for (const d of due) {
    try {
      const vars = { firstName: d.firstName, sessionTitle: d.sessionTitle, link };
      await sendCardEmail(d.personId, d.cardId, renderNudge(settings.subject, vars), renderNudge(settings.message, vars));
      await writeSecure(stateFile(d.personId), {
        count: d.nudgeNumber,
        lastAt: new Date().toISOString(),
        anchor: d.anchor,
      } satisfies State);
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`Nudge failed for person ${d.personId}:`, err);
      if (failed >= 3) break; // something is wrong: stop rather than keep trying
    }
  }
  const summary = { at: new Date().toISOString(), sent, failed, dueNow: due.length };
  try {
    await writeSecure("pathway/nudge-last-run.json", summary);
  } catch {
    /* the summary is only for display */
  }
  console.log(`Nudge run: ${sent} sent, ${failed} failed, ${due.length} were due.`);
  return summary;
}

export async function getLastRun(): Promise<{ at: string; sent: number; failed: number; dueNow: number } | null> {
  try {
    return (await readSecure("pathway/nudge-last-run.json")) as { at: string; sent: number; failed: number; dueNow: number } | null;
  } catch {
    return null;
  }
}
