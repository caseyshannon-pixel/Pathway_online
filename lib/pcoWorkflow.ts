// Server-only helpers that read and move a person's card in the Pathway
// workflow in Planning Center People.
//
// Progress lives in Planning Center itself: the workflow has one step per
// session (in order), then a final "Completed" step. A person's current step
// tells us how many sessions they have finished.

import { getSessions } from "./content";

const API = process.env.PCO_API_BASE ?? "https://api.planningcenteronline.com/people/v2";

export type Progress = {
  /** Number of sessions finished (0 to the number of sessions). */
  completed: number;
  total: number;
  cardId: string;
};

function authHeader() {
  const id = process.env.PCO_APP_ID;
  const secret = process.env.PCO_PAT_SECRET;
  if (!id || !secret) {
    throw new Error("PCO_APP_ID and PCO_PAT_SECRET must be set.");
  }
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

function workflowId() {
  const id = process.env.PATHWAY_WORKFLOW_ID;
  if (!id) throw new Error("PATHWAY_WORKFLOW_ID must be set.");
  return id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pco(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Planning Center ${init.method ?? "GET"} ${path} failed (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Step ids for the Pathway workflow, in order. */
async function getStepIds(): Promise<string[]> {
  const json = await pco(`/workflows/${workflowId()}/steps?per_page=100`);
  const steps = (json?.data ?? []) as {
    id: string;
    attributes: { sequence?: number };
  }[];
  return steps
    .slice()
    .sort((a, b) => (a.attributes.sequence ?? 0) - (b.attributes.sequence ?? 0))
    .map((s) => s.id);
}

type Card = {
  id: string;
  attributes: { completed_at?: string | null; removed_at?: string | null };
  relationships?: {
    workflow?: { data?: { id: string } | null };
    current_step?: { data?: { id: string } | null };
  };
};

async function findCard(personId: string): Promise<Card | null> {
  const json = await pco(
    `/people/${personId}/workflow_cards?include=current_step&per_page=100`,
  );
  const wid = workflowId();
  const cards = (json?.data ?? []) as Card[];
  return (
    cards.find(
      (c) => c.relationships?.workflow?.data?.id === wid && !c.attributes.removed_at,
    ) ?? null
  );
}

function completedFrom(card: Card | null, stepIds: string[], total: number) {
  if (!card) return 0;
  const currentStepId = card.relationships?.current_step?.data?.id;
  const index = currentStepId ? stepIds.indexOf(currentStepId) : 0;
  return card.attributes.completed_at ? total : Math.min(Math.max(index, 0), total);
}

async function createCard(personId: string): Promise<Card> {
  const json = await pco(`/workflows/${workflowId()}/cards`, {
    method: "POST",
    body: JSON.stringify({
      data: { type: "WorkflowCard", attributes: { person_id: Number(personId) } },
    }),
  });
  return json.data as Card;
}

/**
 * Reads progress, adding the person to the workflow on their first visit.
 * Pass `create: false` for look-ups that must not add anyone to the workflow;
 * a person with no card is then reported as `{ completed: 0, cardId: null }`.
 */
export async function getProgress(personId: string): Promise<Progress>;
export async function getProgress(
  personId: string,
  opts: { create: false },
): Promise<Omit<Progress, "cardId"> & { cardId: string | null }>;
export async function getProgress(personId: string, opts: { create?: boolean } = {}) {
  const [stepIds, existing, sessions] = await Promise.all([
    getStepIds(),
    findCard(personId),
    getSessions(),
  ]);
  const total = sessions.length;
  if (!existing && opts.create === false) {
    return { completed: 0, total, cardId: null };
  }
  const card = existing ?? (await createCard(personId));

  return { completed: completedFrom(card, stepIds, total), total, cardId: card.id };
}

/**
 * Marks a session finished. Only the person's next unfinished session counts;
 * anything else is ignored, so replaying old sessions never moves the card.
 */
export async function completeSession(personId: string, session: number): Promise<Progress> {
  const progress = await getProgress(personId);
  if (session !== progress.completed + 1) return progress;

  await pco(`/people/${personId}/workflow_cards/${progress.cardId}/promote`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { ...progress, completed: progress.completed + 1 };
}

export type PersonDetail = {
  id: string;
  name: string;
  avatar: string;
  status: string;
  membership: string;
  age: number | null;
  grade: string;
  campus: string;
  email: string;
  phone: string;
};

function ageFrom(birthdate?: string | null): number | null {
  const m = birthdate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdate) : null;
  if (!m) return null;
  const now = new Date();
  let age = now.getFullYear() - Number(m[1]);
  const month = now.getMonth() + 1;
  const birthdayPending =
    month < Number(m[2]) || (month === Number(m[2]) && now.getDate() < Number(m[3]));
  if (birthdayPending) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function gradeLabel(grade: unknown): string {
  if (typeof grade !== "number") return "";
  if (grade < 0) return "Pre-K";
  if (grade === 0) return "Kindergarten";
  return `Grade ${grade}`;
}

type Resource = { type: string; id: string; attributes?: Record<string, unknown> };
type Rel = { data?: { type: string; id: string } | { type: string; id: string }[] | null };

function peopleUrl(param: string, query: string) {
  return (
    `/people?where[${param}]=${encodeURIComponent(query)}` +
    `&include=emails,phone_numbers,primary_campus&per_page=10`
  );
}

/**
 * Searches Planning Center People (name, email or phone) for the admin pages.
 * Birthdates are turned into an age here and never sent on.
 */
export async function searchPeople(query: string): Promise<PersonDetail[]> {
  let json;
  try {
    json = await pco(peopleUrl("search_name_or_email_or_phone_number", query));
  } catch {
    json = await pco(peopleUrl("search_name", query));
  }

  const included = new Map<string, Resource>();
  for (const r of (json?.included ?? []) as Resource[]) included.set(`${r.type}:${r.id}`, r);
  const related = (rel?: Rel): Resource[] => {
    const d = rel?.data;
    return (Array.isArray(d) ? d : d ? [d] : [])
      .map((r) => included.get(`${r.type}:${r.id}`))
      .filter((r): r is Resource => Boolean(r));
  };
  const text = (v: unknown) => (typeof v === "string" ? v : "");

  return ((json?.data ?? []) as (Resource & { relationships?: Record<string, Rel> })[]).map((p) => {
    const a = p.attributes ?? {};
    const emails = related(p.relationships?.emails);
    const phones = related(p.relationships?.phone_numbers);
    const email = emails.find((e) => e.attributes?.primary) ?? emails[0];
    const phone = phones.find((n) => n.attributes?.primary) ?? phones[0];
    const avatar = text(a.avatar);
    return {
      id: p.id,
      name: text(a.name) || "(no name)",
      avatar: avatar.startsWith("https://") ? avatar : "",
      status: text(a.status),
      membership: text(a.membership),
      age: ageFrom(text(a.birthdate)),
      grade: gradeLabel(a.grade),
      campus: text(related(p.relationships?.primary_campus)[0]?.attributes?.name),
      email: text(email?.attributes?.address),
      phone: text(phone?.attributes?.number),
    };
  });
}

/** Sessions finished by each person, without adding anyone to the workflow. */
export async function getProgressMany(
  personIds: string[],
): Promise<Map<string, { completed: number; total: number }>> {
  const [stepIds, sessions, cards] = await Promise.all([
    getStepIds(),
    getSessions(),
    Promise.all(personIds.map((id) => findCard(id))),
  ]);
  const total = sessions.length;
  return new Map(
    personIds.map((id, i) => [id, { completed: completedFrom(cards[i], stepIds, total), total }]),
  );
}

/** Admin action: moves a person's card one step forward, whatever session they're on. */
export async function advanceOneStep(personId: string): Promise<Progress> {
  const progress = await getProgress(personId);
  if (progress.completed >= progress.total) return progress;
  return completeSession(personId, progress.completed + 1);
}

/** Looks up a person's name by Planning Center id; throws if they don't exist. */
export async function getPersonName(personId: string): Promise<string> {
  const json = await pco(`/people/${personId}`);
  return json?.data?.attributes?.name ?? "";
}
