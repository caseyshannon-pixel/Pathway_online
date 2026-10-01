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
