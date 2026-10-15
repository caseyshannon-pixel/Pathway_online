// Where "Need help?" emails go, and what they say. Pure helpers, safe to use anywhere.

export const HELP_EMAIL = "info@rockc3.com";
export const HELP_SUBJECT = "I need help with pathway online";

/** A friendly name for the page someone was on, from its address. */
export function pageLabel(path: string): string {
  const session = /^\/course\/(\d+)\/?$/.exec(path);
  if (session) return `Session ${session[1]} (${path})`;
  if (path === "/course") return "Course page (/course)";
  if (path === "/" || path === "") return "Sign-in page";
  return path;
}

/**
 * A mailto: link addressed to the help inbox, with the subject filled in and a short
 * message that says who is writing and which page they were on. They can edit it all
 * before sending.
 */
export function helpHref(opts: { name?: string; path?: string } = {}): string {
  const lines = ["Hi, I need help with Pathway Online.", ""];
  if (opts.name) lines.push(`Name: ${opts.name}`);
  if (opts.path) lines.push(`Page: ${pageLabel(opts.path)}`);
  lines.push("", "What's going wrong:", "");
  const body = encodeURIComponent(lines.join("\r\n"));
  return `mailto:${HELP_EMAIL}?subject=${encodeURIComponent(HELP_SUBJECT)}&body=${body}`;
}
