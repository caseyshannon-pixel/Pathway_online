const AUTHORIZE_URL = "https://api.planningcenteronline.com/oauth/authorize";
const TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";
const ME_URL = "https://api.planningcenteronline.com/people/v2/me";

export const CALLBACK_PATH = "/api/auth/callback/planning-center";

export function appOrigin(requestOrigin: string) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  return configured || requestOrigin;
}

export function buildAuthorizeUrl(origin: string, state: string) {
  const clientId = process.env.PCO_CLIENT_ID;
  if (!clientId) throw new Error("PCO_CLIENT_ID is not set.");
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", origin + CALLBACK_PATH);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "people");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(origin: string, code: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.PCO_CLIENT_ID ?? "",
      client_secret: process.env.PCO_CLIENT_SECRET ?? "",
      redirect_uri: origin + CALLBACK_PATH,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function fetchMe(accessToken: string) {
  const res = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not load profile (${res.status})`);
  const json = (await res.json()) as {
    data: {
      id: string;
      attributes: { name?: string; first_name?: string };
    };
  };
  const a = json.data.attributes;
  return {
    personId: json.data.id,
    name: a.name ?? "",
    firstName: a.first_name ?? a.name ?? "",
  };
}
