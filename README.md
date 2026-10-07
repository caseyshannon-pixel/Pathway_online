# Pathway Online

Course site for The Rock. People sign in with Planning Center, watch Sessions 1-6,
and their card moves through a Planning Center People workflow as they finish.

## Planning Center workflow

Create a workflow in People with these steps, in this order:

1. Session 1
2. Session 2
3. Session 3
4. Session 4
5. Session 5
6. Session 6
7. Completed

A person's card sits on the session they are working on. Finishing a session moves
the card to the next step. The order matters; the names are only for your team.

## Environment variables (Vercel > Settings > Environment Variables)

| Name | What it is |
|---|---|
| PCO_CLIENT_ID / PCO_CLIENT_SECRET | From your Planning Center OAuth app |
| SESSION_SECRET | Long random string |
| APP_URL | Site address only, e.g. https://pathway-online.vercel.app |
| PCO_APP_ID / PCO_PAT_SECRET | Personal access token (api.planningcenteronline.com/personal_access_tokens) |
| PATHWAY_WORKFLOW_ID | The number in the workflow's address in People |

## Adding videos

Edit `lib/course.ts` and paste each YouTube video ID (the part after `v=`).

## Campus workflows

Each campus can have its own Pathway workflow (Admin > Campus Workflows). A new person starts in the
workflow for their Primary Campus in Planning Center; if they have none, they choose a campus in the app
(saved in the app, not written back to Planning Center, which doesn't allow it through its API).
Campuses without a workflow use the original one (`PATHWAY_WORKFLOW_ID`). Anyone who already has a card
keeps it. Every workflow needs one step per session plus a final "Completed" step.

## Security notes

- Secrets live only in Vercel environment variables. `.env*` files are git-ignored; never commit one.
- `SESSION_SECRET` should be a long random string (32+ characters). Changing it signs everyone out.
- Admins are the Planning Center person ids in `ADMIN_PERSON_IDS` (owners, only changeable in Vercel) plus anyone added on the Admin > Manage admins page.
- Every response carries security headers (see `next.config.mjs`). Admin actions also check that the request came from this site (`lib/security.ts`) and are rate limited per person.
- Session progress is reported by the browser when a video ends, so a determined signed-in person could mark a session finished without watching it. Treat completions as honor-system, not proof.
- The list of added admins is stored in a separate **private** Blob store. Set `PRIVATE_BLOB_STORE_ID` to its store id in Vercel; the first time it loads, the app moves any existing list out of the public store and deletes the public copy.
