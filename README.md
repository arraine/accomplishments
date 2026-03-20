# Accomplishments Assistant

A local-first Next.js app for tracking daily accomplishments against company competencies and personal goals.

## What it does

- stores goals and competencies for categorization
- records daily accomplishments with assistant-style acknowledgment
- suggests categorization when the user does not manually assign links
- aggregates similar recent accomplishments into a stronger combined entry
- shows current-year summaries grouped by goal or competency
- supports Supabase email/password sign-in with per-user cloud save

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. In Supabase SQL Editor, run [supabase/schema.sql](/Users/arraine.siefert/Desktop/sparkles/accomplishments/supabase/schema.sql).
4. In Supabase Auth, enable Email provider.
5. Add your local and deployed app URLs to the Supabase Auth URL settings.

When a user signs in, the app stores goals, competencies, and accomplishments in the `user_state` table under their own account.

## Notes

- Data is stored in `localStorage`, so it stays in the current browser on the current device.
- If Supabase is configured and the user signs in, the same state is also saved to their cloud account.
- The current-year summary is based on the current app year window and limited to entries from January 1 through the present date.
