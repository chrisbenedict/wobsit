// Refreshes now-playing.json from Spotify.
//
// Required env:
//   SPOTIFY_CLIENT_ID       — Spotify app client id
//   SPOTIFY_CLIENT_SECRET   — Spotify app client secret
//   SPOTIFY_REFRESH_TOKEN   — long-lived user refresh token (see README)
//
// Writes a sanitized JSON: just title, artist, timestamps. No usernames,
// no profile IDs, no track URLs — nothing that links back to a Spotify
// account. Safe to commit publicly.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
} = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
  console.error('missing one of SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / SPOTIFY_REFRESH_TOKEN');
  process.exit(1);
}

const basic = Buffer
  .from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)
  .toString('base64');

async function getAccessToken() {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });
  if (!r.ok) throw new Error(`token request failed: ${r.status}`);
  const j = await r.json();
  if (!j.access_token) throw new Error('no access_token in response');
  return j.access_token;
}

function trackPayload(track, opts) {
  return {
    playing: !!opts.playing,
    title: track.name,
    artist: (track.artists || []).map(a => a.name).join(', '),
    played_at: opts.played_at || null,
    updated_at: new Date().toISOString(),
  };
}

async function fetchNow(accessToken) {
  // 204 = nothing playing
  const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (r.status === 204) return null;
  if (!r.ok) throw new Error(`currently-playing failed: ${r.status}`);
  const j = await r.json();
  if (!j || !j.item) return null;
  return trackPayload(j.item, { playing: !!j.is_playing });
}

async function fetchRecent(accessToken) {
  const r = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`recently-played failed: ${r.status}`);
  const j = await r.json();
  const item = j && j.items && j.items[0];
  if (!item) return null;
  return trackPayload(item.track, { playing: false, played_at: item.played_at });
}

async function main() {
  const token = await getAccessToken();
  let payload = await fetchNow(token);
  if (!payload) payload = await fetchRecent(token);
  if (!payload) {
    payload = {
      playing: false,
      title: null,
      artist: null,
      played_at: null,
      updated_at: new Date().toISOString(),
    };
  }

  // Avoid writing churn if only the timestamp changed.
  // Public path — Astro copies everything under public/ to dist/ at build time.
  const path = 'public/now-playing.json';
  if (existsSync(path)) {
    try {
      const prev = JSON.parse(readFileSync(path, 'utf8'));
      const same =
        prev.title === payload.title &&
        prev.artist === payload.artist &&
        prev.playing === payload.playing &&
        prev.played_at === payload.played_at;
      if (same) {
        console.log('no change');
        return;
      }
    } catch { /* fall through and write */ }
  }

  writeFileSync(path, JSON.stringify(payload, null, 2) + '\n');
  console.log('wrote', JSON.stringify(payload));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
