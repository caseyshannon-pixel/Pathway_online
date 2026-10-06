// Pure number-crunching for the admin dashboard (no network calls).

import type { CardInfo } from "./pcoWorkflow";

export type SessionStat = {
  number: number;
  title: string;
  finished: number;
  onNow: number;
  pctOfStarted: number;
  /** Share of the previous session's finishers who also finished this one. */
  pctOfPrevious: number | null;
};

export type Week = { label: string; joined: number; moved: number };

export type Stalled = CardInfo & { days: number };

export type Stats = {
  started: number;
  finishedAll: number;
  inProgress: number;
  sessions: SessionStat[];
  stalled: Stalled[];
  weeks: Week[];
  thisWeek: { joined: number; moved: number };
};

const DAY = 86_400_000;

function weekStart(d: Date) {
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday);
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

export function buildStats(
  cards: CardInfo[],
  titles: string[],
  stalledDays: number,
  now = new Date(),
): Stats {
  const total = titles.length;
  const started = cards.length;
  const finishedAll = cards.filter((c) => c.completed >= total).length;

  const sessions: SessionStat[] = titles.map((title, i) => {
    const k = i + 1;
    const finished = cards.filter((c) => c.completed >= k).length;
    const previous = k === 1 ? started : cards.filter((c) => c.completed >= k - 1).length;
    return {
      number: k,
      title,
      finished,
      onNow: cards.filter((c) => c.completed === k - 1).length,
      pctOfStarted: pct(finished, started),
      pctOfPrevious: previous > 0 ? pct(finished, previous) : null,
    };
  });

  const stalled = cards
    .filter((c) => c.completed < total && c.movedAt)
    .map((c) => ({ ...c, days: Math.floor((now.getTime() - Date.parse(c.movedAt)) / DAY) }))
    .filter((c) => Number.isFinite(c.days) && c.days >= stalledDays)
    .sort((a, b) => b.days - a.days);

  // Last 12 weeks, oldest first. "Moved" is each card's most recent move, so it
  // shows recent pace, not a full history.
  const thisWeekStart = weekStart(now);
  const weeks: Week[] = Array.from({ length: 12 }, (_, i) => {
    const start = thisWeekStart - (11 - i) * 7 * DAY;
    return {
      label: new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      joined: 0,
      moved: 0,
    };
  });
  const bucket = (iso: string) => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return -1;
    const i = 11 - Math.floor((thisWeekStart - weekStart(new Date(t))) / (7 * DAY));
    return i >= 0 && i < 12 ? i : -1;
  };
  for (const c of cards) {
    const j = bucket(c.createdAt);
    if (j >= 0) weeks[j].joined += 1;
    const movedLater = Date.parse(c.movedAt) - Date.parse(c.createdAt) > 60_000;
    const m = movedLater ? bucket(c.movedAt) : -1;
    if (m >= 0) weeks[m].moved += 1;
  }

  return {
    started,
    finishedAll,
    inProgress: started - finishedAll,
    sessions,
    stalled,
    weeks,
    thisWeek: { joined: weeks[11].joined, moved: weeks[11].moved },
  };
}
