// Server-only helpers that read and move a person's card in the Pathway
// workflow in Planning Center People.
//
// Progress lives in Planning Center itself: the workflow has one step per
// session (in order), then a final "Completed" step. A person's current step
// tells us how many sessions they have finished.

import { getSessions } from "./content";
import { getCampusChoice, getCampusMap } from "./campusConfig";

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

/** The original Pathway workflow: used for people whose campus has no workflow of its own. */
export function defaultWorkflowId() {
  const id = process.env.PATHWAY_WORKFLOW_ID;
  if (!id) throw new Error("PATHWAY_WORKFLOW_ID must be set.");
  return id;
}

/** Every workflow Pathway uses: the original plus one per mapped campus. */
async function allWorkflowIds(): Promise<string[]> {
  const map = await getCampusMap();
  return [...new Set([defaultWorkflowId(), ...Object.values(map)])];
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

const stepCache = new Map<string, { at: number; ids: string[] }>();

/** Step ids for a workflow, in order (cached for 5 minutes; steps rarely change). */
async function getStepIds(workflowId: string): Promise<string[]> {
  const hit = stepCache.get(workflowId);
  if (hit && Date.now() - hit.at < 300_000) return hit.ids;
  const json = await pco(`/workflows/${workflowId}/steps?per_page=100`);
  const steps = (json?.data ?? []) as {
    id: string;
    attributes: { sequence?: number };
  }[];
  const ids = steps
    .slice()
    .sort((a, b) => (a.attributes.sequence ?? 0) - (b.attributes.sequence ?? 0))
    .map((s) => s.id);
  stepCache.set(workflowId, { at: Date.now(), ids });
  return ids;
}

type Card = {
  id: string;
  attributes: {
    completed_at?: string | null;
    removed_at?: string | null;
    created_at?: string | null;
    moved_to_step_at?: string | null;
  };
  relationships?: {
    workflow?: { data?: { id: string } | null };
    current_step?: { data?: { id: string } | null };
    person?: { data?: { id: string } | null };
  };
};

const workflowOf = (card: Card) => card.relationships?.workflow?.data?.id ?? "";

/**
 * The person's active card in any Pathway workflow. An existing card always wins,
 * so someone who changes campus keeps their progress. If they somehow have more
 * than one, the most recently moved is used.
 */
async function findCard(personId: string): Promise<Card | null> {
  const [json, wids] = await Promise.all([
    pco(`/people/${personId}/workflow_cards?include=current_step&per_page=100`),
    allWorkflowIds(),
  ]);
  const allowed = new Set(wids);
  const stamp = (c: Card) => Date.parse(c.attributes.moved_to_step_at ?? c.attributes.created_at ?? "") || 0;
  const cards = ((json?.data ?? []) as Card[])
    .filter((c) => !c.attributes.removed_at && allowed.has(workflowOf(c)))
    .sort((a, b) => stamp(b) - stamp(a));
  return cards[0] ?? null;
}

/** Thrown when a new person has no campus yet and must choose one before starting. */
export class CampusRequiredError extends Error {
  constructor() {
    super("CAMPUS_REQUIRED");
  }
}

/**
 * The workflow a new person should start in: their Primary Campus in Planning
 * Center, else the campus they chose in the app. With `askCampus`, a person with
 * neither gets a CampusRequiredError so they can be asked; otherwise (admin
 * actions) they go in the original workflow. Nothing changes until at least one
 * campus has its own workflow.
 */
async function workflowForPerson(personId: string, askCampus = false): Promise<string> {
  const map = await getCampusMap();
  if (Object.keys(map).length === 0) return defaultWorkflowId();

  let campusId = "";
  try {
    const json = await pco(`/people/${personId}`);
    campusId = String(json?.data?.relationships?.primary_campus?.data?.id ?? "");
  } catch (err) {
    console.error("Could not read primary campus:", err);
  }
  if (!campusId) campusId = (await getCampusChoice(personId)) ?? "";

  if (!campusId) {
    if (askCampus) throw new CampusRequiredError();
    return defaultWorkflowId();
  }
  return map[campusId] ?? defaultWorkflowId();
}

function completedFrom(card: Card | null, stepIds: string[], total: number) {
  if (!card) return 0;
  const currentStepId = card.relationships?.current_step?.data?.id;
  const index = currentStepId ? stepIds.indexOf(currentStepId) : 0;
  return card.attributes.completed_at ? total : Math.min(Math.max(index, 0), total);
}

async function createCard(personId: string, workflowId: string): Promise<Card> {
  const json = await pco(`/workflows/${workflowId}/cards`, {
    method: "POST",
    body: JSON.stringify({
      data: { type: "WorkflowCard", attributes: { person_id: Number(personId) } },
    }),
  });
  const card = json.data as Card;
  // Make sure the card says which workflow it is in, whatever the response included.
  return {
    ...card,
    relationships: { ...card.relationships, workflow: { data: { id: workflowId } } },
  };
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
export async function getProgress(personId: string, opts: { askCampus: true }): Promise<Progress>;
export async function getProgress(
  personId: string,
  opts: { create?: boolean; askCampus?: boolean } = {},
) {
  const [existing, sessions] = await Promise.all([findCard(personId), getSessions()]);
  const total = sessions.length;
  if (!existing && opts.create === false) {
    return { completed: 0, total, cardId: null };
  }
  const card = existing ?? (await createCard(personId, await workflowForPerson(personId, opts.askCampus)));
  const stepIds = await getStepIds(workflowOf(card) || defaultWorkflowId());

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
  const [sessions, cards] = await Promise.all([
    getSessions(),
    Promise.all(personIds.map((id) => findCard(id))),
  ]);
  const total = sessions.length;
  const wids = [...new Set(cards.filter((c): c is Card => c !== null).map(workflowOf))];
  const steps = new Map(await Promise.all(wids.map(async (w) => [w, await getStepIds(w)] as const)));
  return new Map(
    personIds.map((id, i) => {
      const card = cards[i];
      return [id, { completed: completedFrom(card, card ? steps.get(workflowOf(card)) ?? [] : [], total), total }];
    }),
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

export type CardInfo = {
  cardId: string;
  personId: string;
  name: string;
  avatar: string;
  /** Which workflow (campus) the card is in. */
  workflowId: string;
  /** Sessions finished (0 to total). */
  completed: number;
  createdAt: string;
  /** When the card last moved to its current step. */
  movedAt: string;
};

export type WorkflowLabel = { id: string; label: string; steps: number };

export type WorkflowSnapshot = {
  total: number;
  titles: string[];
  cards: CardInfo[];
  workflows: WorkflowLabel[];
};

let snapshotCache: { at: number; value: WorkflowSnapshot } | null = null;

export type Campus = { id: string; name: string };

let campusCache: { at: number; list: Campus[] } | null = null;

/** Campuses in Planning Center People (cached for 5 minutes). */
export async function listCampuses(): Promise<Campus[]> {
  if (campusCache && Date.now() - campusCache.at < 300_000) return campusCache.list;
  const json = await pco(`/campuses?per_page=100`);
  const list = ((json?.data ?? []) as { id: string; attributes?: { name?: string } }[]).map((c) => ({
    id: c.id,
    name: c.attributes?.name ?? `Campus ${c.id}`,
  }));
  campusCache = { at: Date.now(), list };
  return list;
}

export type WorkflowOption = { id: string; name: string; steps: number };

/** Workflows in Planning Center People, with their step counts (for the campus settings page). */
export async function listWorkflows(): Promise<WorkflowOption[]> {
  const json = await pco(`/workflows?per_page=100`);
  const flows = (json?.data ?? []) as { id: string; attributes?: { name?: string } }[];
  return Promise.all(
    flows.map(async (w) => ({
      id: w.id,
      name: w.attributes?.name ?? `Workflow ${w.id}`,
      steps: (await getStepIds(w.id).catch(() => [])).length,
    })),
  );
}

/** Every active card across all Pathway workflows (admin dashboard). Cached for a minute. */
export async function getWorkflowSnapshot(): Promise<WorkflowSnapshot> {
  if (snapshotCache && Date.now() - snapshotCache.at < 60_000) return snapshotCache.value;

  const [sessions, wids, map] = await Promise.all([getSessions(), allWorkflowIds(), getCampusMap()]);
  const total = sessions.length;
  const cards: CardInfo[] = [];

  for (const wid of wids) {
    const stepIds = await getStepIds(wid);
    const PAGE = 100;
    for (let offset = 0; offset < 5000; offset += PAGE) {
      const json = await pco(
        `/workflows/${wid}/cards?include=current_step,person&per_page=${PAGE}&offset=${offset}`,
      );
      const data = (json?.data ?? []) as (Card & { id: string })[];
      const people = new Map<string, { name?: string; avatar?: string }>();
      for (const inc of (json?.included ?? []) as { type: string; id: string; attributes?: { name?: string; avatar?: string } }[]) {
        if (inc.type === "Person") people.set(inc.id, inc.attributes ?? {});
      }
      for (const c of data) {
        if (c.attributes.removed_at) continue;
        const personId = c.relationships?.person?.data?.id ?? "";
        const person = people.get(personId);
        const avatar = person?.avatar ?? "";
        const created = c.attributes.created_at ?? "";
        cards.push({
          cardId: c.id,
          personId,
          name: person?.name ?? "(unknown)",
          avatar: avatar.startsWith("https://") ? avatar : "",
          workflowId: wid,
          completed: completedFrom(c, stepIds, total),
          createdAt: created,
          movedAt: c.attributes.moved_to_step_at ?? created,
        });
      }
      if (data.length < PAGE) break;
    }
  }

  // Label each workflow by the campuses that use it.
  const campuses = Object.keys(map).length > 0 ? await listCampuses().catch(() => []) : [];
  const names = new Map(campuses.map((c) => [c.id, c.name]));
  const workflows: WorkflowLabel[] = await Promise.all(
    wids.map(async (wid) => {
      const used = Object.entries(map)
        .filter(([, w]) => w === wid)
        .map(([campusId]) => names.get(campusId) ?? `Campus ${campusId}`);
      const label = wid === defaultWorkflowId() ? (used.length ? `${used.join(", ")} + others` : "All campuses") : used.join(", ") || `Workflow ${wid}`;
      return { id: wid, label, steps: (await getStepIds(wid)).length };
    }),
  );

  const value = { total, titles: sessions.map((s) => s.title), cards, workflows };
  snapshotCache = { at: Date.now(), value };
  return value;
}
