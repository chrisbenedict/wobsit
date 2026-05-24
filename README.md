# wobsit

Source for [chrisbenedict.me](https://chrisbenedict.me) — a small static site
built with [Astro](https://astro.build), deployed to GitHub Pages, fronted by
Cloudflare.

## Local development

```sh
npm install
npm run dev      # → http://127.0.0.1:4321 with HMR
npm run build    # → ./dist (what gets deployed)
npm run preview  # serve the built dist/ locally
```

Requires Node 18+.

## Project layout

```
src/
  layouts/Base.astro          ← <html>/<head> shell, imports global.css
  components/
    Frame.astro               ← outer wrapper + corner crop marks
    TopBar.astro              ← status bar (host · clock · timezone)
    Hero.astro                ← name + tagline
    SiteNav.astro             ← [1] [2] [3] tabs
    SiteFooter.astro          ← build/touched + key legend
    NowPlaying.astro          ← Spotify feed block (hidden until JSON loads)
    panels/
      Home.astro              ← readme + now-playing
      About.astro             ← edit `rows` to fill in
      Contact.astro           ← edit `links` to add channels
  pages/index.astro           ← composes everything
  scripts/site.js             ← clock, tab routing, kbd, fetch
  styles/global.css           ← all visual styling

public/                       ← copied verbatim into dist/
  CNAME                       ← chrisbenedict.me
  now-playing.json            ← written by the GitHub Action

.github/workflows/
  deploy.yml                  ← build + publish to GH Pages on push to main
  now-playing.yml             ← cron: refresh public/now-playing.json every 30m

scripts/update-now-playing.mjs ← what the cron runs
```

## Adding content

Most edits live in the panel files:

- **About rows** — open `src/components/panels/About.astro`, edit the `rows`
  array. Set `v` to a string or leave `null` for `— tbd —`.
- **Contact links** — open `src/components/panels/Contact.astro`, edit the
  `links` array. Use `external: true` for outbound links.
- **A new tab** — append an entry to the array in `src/components/SiteNav.astro`,
  add a matching `<section class="panel" data-tab="…">` in `src/pages/index.astro`,
  and add it to `keyMap` in `src/scripts/site.js`.
- **A new route** (e.g. `/uses`) — drop `src/pages/uses.astro` and it's live.

## Deploying

A push to `main` triggers `.github/workflows/deploy.yml`, which builds Astro
and publishes `dist/` via the official Pages action.

**One-time setup** (only needed when migrating from the old "serve from main
branch" mode): in this repo on GitHub → **Settings → Pages → Build and
deployment → Source → GitHub Actions**.

## "now playing" — Spotify wiring (one-time)

The site shows the last track played without exposing any Spotify identifiers.
A GitHub Action calls Spotify server-side using a refresh token stored as a
repo secret, then commits a sanitized `public/now-playing.json` (title +
artist + timestamps only — no IDs, no URLs).

### 1. Create a Spotify app

1. Go to https://developer.spotify.com/dashboard → **Create app**
2. Name: anything (e.g. `chrisbenedict.me now-playing`)
3. Redirect URI: `http://127.0.0.1:8888/callback` (only used once, locally)
4. APIs/SDKs: check **Web API** only
5. Save → open the app → **Settings** to reveal Client ID + Secret

### 2. Get a refresh token (one-time, local)

Open this URL in a browser, replacing `<CLIENT_ID>`:

```
https://accounts.spotify.com/authorize?client_id=<CLIENT_ID>&response_type=code&redirect_uri=http://127.0.0.1:8888/callback&scope=user-read-currently-playing%20user-read-recently-played
```

Click **Agree**. The redirect to `127.0.0.1:8888/callback?code=…` will fail to
load — that's fine. Copy the `code` value out of the URL bar.

Exchange the code for a refresh token (codes expire in ~10 min):

```sh
curl -s https://accounts.spotify.com/api/token \
  -u "<CLIENT_ID>:<CLIENT_SECRET>" \
  -d grant_type=authorization_code \
  -d code=<THE_CODE> \
  -d redirect_uri=http://127.0.0.1:8888/callback
```

Save the `refresh_token` from the response.

### 3. Add the three secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

### 4. Kick it off

**Actions → now-playing → Run workflow.** ~15 seconds later
`public/now-playing.json` should have a real song in it. The cron takes over
from there (every 30 min).

### What ends up public

Only `public/now-playing.json`, shape:

```json
{
  "playing": false,
  "title": "Song Name",
  "artist": "Artist Name",
  "played_at": "2026-05-22T18:33:11Z",
  "updated_at": "2026-05-22T19:00:02Z"
}
```

No usernames, profile IDs, or Spotify URLs. To pause the feed, disable the
workflow under **Actions**.
