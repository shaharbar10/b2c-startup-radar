# B2C Startup Radar

A mobile-first prototype for tracking global B2C startups that are newly founded or recently funded at Series A or earlier.

## What is here

- `index.html` is the app shell.
- `styles.css` contains the mobile-first design.
- `app.js` powers search, filters, source notes, and cards.
- `data/startups.json` is the daily data file.
- `data/startups.js` is a local-preview fallback so the app still works when opened directly from this folder.

## Daily update path

The app is designed so a hosted daily job can replace `data/startups.json` every morning. The practical always-on setup is:

1. Host the app on Vercel, Netlify, or GitHub Pages.
2. Store the data file in GitHub, Airtable, Supabase, or a small hosted database.
3. Run a daily hosted job that checks public sources such as Dealroom public pages, TechCrunch, Crunchbase/Tracxn-style public snippets, FinSMEs, Sifted, Tech.eu, EU-Startups, BusinessWire, GlobeNewswire, regional startup publications, niche B2C publications, investor posts, company pages, LinkedIn public pages, and careers pages.
4. The job updates the data file, then the mobile web app reads the newest file.

For stronger coverage, add paid or approved APIs later, especially Dealroom or Crunchbase. LinkedIn data should stay best-effort unless you have approved LinkedIn API access.

This folder now includes a GitHub Pages workflow at `.github/workflows/daily-update-and-pages.yml` and a public-source updater at `scripts/update-from-public-sources.mjs`.

## What is needed for a real phone app link

The prototype works locally now. To make it a real link on your phone that updates while your computer is closed, it needs:

- A hosting account: Vercel, Netlify, or GitHub Pages.
- A place to store daily data: the JSON file in GitHub is enough for a first version.
- A scheduled updater: Codex daily automation for research, or a hosted scheduled job if you want the website to update without any manual step.
- Optional paid data: Dealroom, Crunchbase, or another startup database API for better coverage.

Recommended first live version: host the site on Vercel or Netlify, keep the data file in GitHub, and use the existing daily Codex automation to produce app-ready updates until you decide whether a paid startup database is worth it.

See `DEPLOYMENT.md` for the public-link setup.
