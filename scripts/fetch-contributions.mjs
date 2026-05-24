// Fetches the GitHub contribution calendar for USER and writes it to
// src/data/contributions.json. Read at build time by About.astro.
//
// Auth: any token with read access works. In CI the default GITHUB_TOKEN
// is fine (we're only reading public contribution data). Locally, set
// GH_TOKEN in your environment with a PAT that has `read:user`.
//
// If no token is available, the script writes a deterministic sample
// (so local dev still shows the visual) and exits with code 0.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const USER   = 'chrisbenedict';
const OUT    = 'src/data/contributions.json';
const TOKEN  = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const MONTHS = 3;     // how far back the heatmap goes

function ensureDir(p) {
  const d = dirname(p);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function rangeFrom() {
  const from = new Date();
  from.setMonth(from.getMonth() - MONTHS);
  // snap to start of the week (Sunday) so the grid aligns
  from.setDate(from.getDate() - from.getDay());
  from.setHours(0, 0, 0, 0);
  return from;
}

function sample() {
  // deterministic-ish sample so local dev shows the heatmap.
  const today = new Date();
  const start = rangeFrom();
  const totalDays = Math.ceil((today.getTime() - start.getTime()) / 86400000);
  const totalWeeks = Math.ceil(totalDays / 7);

  let seed = 1234567;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const weeks = [];
  let total = 0;
  for (let w = 0; w < totalWeeks; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + w * 7 + d);
      if (date > today) break;

      const r = rand();
      let level = 0;
      if (r > 0.45) level = 1;
      if (r > 0.72) level = 2;
      if (r > 0.88) level = 3;
      if (r > 0.97) level = 4;
      const count = level === 0 ? 0 : Math.max(1, Math.floor(rand() * (level * 4)));
      total += count;
      week.push({ c: count, l: level, d: date.toISOString().slice(0, 10) });
    }
    if (week.length) weeks.push(week);
  }

  return { total, weeks, fetched_at: new Date().toISOString(), source: 'sample' };
}

async function real() {
  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                contributionLevel
                date
              }
            }
          }
        }
      }
    }
  `;

  const from = rangeFrom();
  const to = new Date();
  const variables = {
    login: USER,
    from: from.toISOString(),
    to: to.toISOString(),
  };

  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'chrisbenedict.me-build',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`graphql ${r.status}: ${body.slice(0, 200)}`);
  }

  const data = await r.json();
  const cal = data?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) throw new Error(`no calendar in response: ${JSON.stringify(data).slice(0, 200)}`);

  const LEVELS = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
  };

  const weeks = cal.weeks.map(w =>
    w.contributionDays.map(d => ({
      c: d.contributionCount,
      l: LEVELS[d.contributionLevel] ?? 0,
      d: d.date,
    })),
  );

  return {
    total: cal.totalContributions,
    weeks,
    fetched_at: new Date().toISOString(),
    source: 'github',
  };
}

async function main() {
  ensureDir(OUT);

  let payload;
  if (!TOKEN) {
    console.warn('[contributions] no GH_TOKEN / GITHUB_TOKEN — writing sample data');
    payload = sample();
  } else {
    try {
      payload = await real();
    } catch (err) {
      console.error('[contributions] fetch failed:', err.message);
      console.warn('[contributions] falling back to sample data');
      payload = sample();
    }
  }

  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.log(`[contributions] wrote ${payload.total} contributions (${payload.source})`);
}

main();
