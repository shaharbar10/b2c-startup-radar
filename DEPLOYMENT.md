# Going Live

The app is prepared for a public mobile web link and daily cloud updates.

## Recommended path

Use GitHub Pages first. It is simple, free for public repositories, and the workflow in `.github/workflows/daily-update-and-pages.yml` is already included.

## What still needs your account

I cannot publish to your personal hosting account without you connecting one. The missing step is authorization:

1. Create or choose a GitHub account.
2. Create a new repository for this folder.
3. Upload/push these files.
4. In the repository settings, enable GitHub Pages with GitHub Actions.

After that, GitHub will run the included daily workflow in the cloud at 06:30 UTC, update the data from public startup/funding sources, and publish the site. Your computer does not need to be open.

## One-time upload from Windows PowerShell

Open Windows PowerShell normally, then paste this block:

```powershell
cd "C:\Users\shaha\Documents\Codex\2026-05-27\i-want-to-find-a-job"
git config user.name "shaharbar10"
git config user.email "shaharbar10@users.noreply.github.com"
git add .
git commit -m "Initial B2C startup radar app"
git remote remove origin 2>$null
git remote add origin https://github.com/shaharbar10/b2c-startup-radar.git
git -c http.sslBackend=openssl push -u origin main
```

If GitHub opens a login window, sign in and approve. If PowerShell says there is nothing to commit, continue with the push command.

## What the daily updater does

- Reads public RSS feeds and public news/search APIs.
- Filters for B2C startup funding at pre-seed, seed, angel, or Series A.
- Avoids obvious B2B, infrastructure, enterprise SaaS, and Series B+ matches.
- Adds new public-source candidates to `data/startups.json`.
- Regenerates `data/startups.js` for direct browser fallback.
- Publishes the latest app with GitHub Pages.

## Better coverage later

For richer fields such as founders, employee counts, LinkedIn links, and hiring pages, add a paid or approved data source later:

- Dealroom API or subscription
- Crunchbase-style startup database
- A search API such as SerpAPI
- An approved LinkedIn data source
- Optional AI extraction API to turn articles into structured company cards
