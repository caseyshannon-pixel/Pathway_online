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

  const currentStepId = card.relationships?.current_step?.data?.id;
  const index = currentStepId ? stepIds.indexOf(currentStepId) : 0;
  const completed = card.attributes.completed_at ? total : Math.min(Math.max(index, 0), total);

  return { completed, total, cardId: card.id };
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

export type PersonResult = { id: string; name: string; avatar: string };

/** Searches Planning Center People by name (admin page). */
export async function searchPeople(query: string): Promise<PersonResult[]> {
  const json = await pco(
    `/people?where[search_name]=${encodeURIComponent(query)}&per_page=10`,
  );
  return ((json?.data ?? []) as {
    id: string;
    attributes: { name?: string; avatar?: string };
  }[]).map((p) => ({
    id: p.id,
    name: p.attributes.name ?? "(no name)",
    avatar: p.attributes.avatar?.startsWith("https://") ? p.attributes.avatar : "",
  }));
}

/** Admin action: moves a person's card one step forward, whatever session they're on. */
export async function advanceOneStep(personId: string): Promise<Progress> {
  const progress = await getProgress(personId);
  if (progress.completed >= progress.total) return progress;
  return completeSession(personId, progress.completed + 1);
}
