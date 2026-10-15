// Server-only. A searchable list of Church Center links from Planning Center
// (People forms, Registrations, Groups, Publishing series, and a few general pages).

import { pcoGetUrl } from "./pcoWorkflow";

export type ProductKey = "people" | "registrations" | "groups" | "publishing" | "general";

export type LinkItem = {
  id: string;
  product: ProductKey;
  productLabel: string;
  name: string;
  url: string;
  detail: string;
};

export const PRODUCT_LABELS: Record<ProductKey, string> = {
  people: "People forms",
  registrations: "Registrations",
  groups: "Groups",
  publishing: "Publishing",
  general: "Church Center pages",
};

const API = "https://api.planningcenteronline.com";
const CHURCH_CENTER = (process.env.CHURCH_CENTER_URL ?? "https://rockc3.churchcenter.com").replace(/\/$/, "");
const CACHE_MS = 300_000;
const cache = new Map<ProductKey, { at: number; items: LinkItem[] }>();

type Row = { id: string; attributes: Record<string, unknown> };

async function fetchAll(path: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const sep = path.includes("?") ? "&" : "?";
    const json = await pcoGetUrl(`${API}${path}${sep}per_page=100&offset=${offset}`);
    const data = (json?.data ?? []) as Row[];
    rows.push(...data);
    if (data.length < 100) break;
  }
  return rows;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

async function load(product: ProductKey): Promise<LinkItem[]> {
  const label = PRODUCT_LABELS[product];
  const item = (id: string, name: string, url: string, detail = ""): LinkItem => ({
    id: `${product}:${id}`,
    product,
    productLabel: label,
    name: name || "(untitled)",
    url,
    detail,
  });

  if (product === "people") {
    const rows = await fetchAll("/people/v2/forms");
    return rows
      .filter((r) => r.attributes.active !== false && !r.attributes.archived && text(r.attributes.public_url))
      .map((r) => item(r.id, text(r.attributes.name), text(r.attributes.public_url)));
  }
  if (product === "registrations") {
    const rows = await fetchAll("/registrations/v2/signups");
    return rows
      .filter((r) => !r.attributes.archived && text(r.attributes.new_registration_url))
      .map((r) => {
        const close = text(r.attributes.close_at);
        const closed = close && Date.parse(close) < Date.now();
        return item(
          r.id,
          text(r.attributes.name),
          text(r.attributes.new_registration_url),
          closed ? "Closed" : close ? `Closes ${day(close)}` : "Open",
        );
      });
  }
  if (product === "groups") {
    const rows = await fetchAll("/groups/v2/groups");
    return rows
      .filter((r) => !r.attributes.archived_at && text(r.attributes.public_church_center_web_url))
      .map((r) =>
        item(r.id, text(r.attributes.name), text(r.attributes.public_church_center_web_url), r.attributes.listed === false ? "Unlisted" : ""),
      );
  }
  if (product === "publishing") {
    const rows = await fetchAll("/publishing/v2/series");
    return rows
      .filter((r) => text(r.attributes.church_center_url))
      .map((r) => item(r.id, text(r.attributes.title), text(r.attributes.church_center_url), "Series"));
  }
  return [
    item("giving", "Giving", `${CHURCH_CENTER}/giving`),
    item("groups", "All groups", `${CHURCH_CENTER}/groups`),
    item("registrations", "All registrations", `${CHURCH_CENTER}/registrations`),
    item("calendar", "Calendar", `${CHURCH_CENTER}/calendar`),
  ];
}

async function get(product: ProductKey): Promise<LinkItem[]> {
  const hit = cache.get(product);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  const items = await load(product);
  cache.set(product, { at: Date.now(), items });
  return items;
}

/** Items matching the search, from one product or all. `failed` names products that couldn't be loaded. */
export async function searchLinks(product: ProductKey | "all", query: string) {
  const keys: ProductKey[] =
    product === "all" ? ["people", "registrations", "groups", "publishing", "general"] : [product];
  const results = await Promise.allSettled(keys.map((k) => get(k)));
  const failed: string[] = [];
  let items: LinkItem[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items = items.concat(r.value);
    else {
      console.error(`Could not load ${keys[i]} links:`, r.reason);
      failed.push(PRODUCT_LABELS[keys[i]]);
    }
  });
  const q = query.trim().toLowerCase();
  if (q) items = items.filter((i) => i.name.toLowerCase().includes(q) || i.productLabel.toLowerCase().includes(q));
  items.sort((a, b) => a.name.localeCompare(b.name));
  return { items: items.slice(0, 60), failed };
}
