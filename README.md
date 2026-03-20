# Accomplishments Assistant

A local-first Next.js app for tracking daily accomplishments against company competencies and personal goals.

## What it does

- stores goals and competencies for categorization
- records daily accomplishments with assistant-style acknowledgment
- suggests categorization when the user does not manually assign links
- aggregates similar recent accomplishments into a stronger combined entry
- shows current-year summaries grouped by goal or competency

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

## Notes

- Data is stored in `localStorage`, so it stays in the current browser on the current device.
- The current-year summary is based on the current app year window and limited to entries from January 1 through the present date.
