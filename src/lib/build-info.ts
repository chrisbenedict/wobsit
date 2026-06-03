// Build-time git metadata. Runs in Astro frontmatter (Node) during the
// build, so the "built / last touched / version" stamps reflect the actual
// last commit instead of whatever day the site happened to be rebuilt.
//
// CI checks out full history (fetch-depth: 0 in deploy.yml) specifically so
// this can read `git log`. If git is unavailable for any reason we fall back
// to the current date rather than break the build.
import { execSync } from 'node:child_process';

// Returns the last commit's calendar date as { yyyy, mm, dd }.
//
// `git log -1 --format=%cI` is strict ISO 8601 carrying the committer's own
// timezone offset (e.g. 2026-05-23T17:59:19-07:00), so the leading
// YYYY-MM-DD already *is* the commit's local calendar date. We read those
// digits straight off the string rather than `new Date(iso).getDate()` —
// the latter re-interprets the instant in the build machine's timezone,
// which would shift the stamp by a day when CI (UTC) builds a commit made
// in the evening Pacific time.
function commitDateParts(): { yyyy: string; mm: string; dd: string } {
  try {
    const iso = execSync('git log -1 --format=%cI', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) return { yyyy: m[1], mm: m[2], dd: m[3] };
  } catch {
    /* no git / no history — fall through */
  }
  const d = new Date();
  return {
    yyyy: String(d.getFullYear()),
    mm: String(d.getMonth() + 1).padStart(2, '0'),
    dd: String(d.getDate()).padStart(2, '0'),
  };
}

const { yyyy, mm, dd } = commitDateParts();
const yy = yyyy.slice(2);

// `built` mirrors the old yy.mm.dd stamp; `touched` keeps the ISO form.
// both derive from the same commit so they stay in step with git activity.
export const buildStamp = `${yy}.${mm}.${dd}`;
export const touchedStamp = `${yyyy}-${mm}-${dd}`;
export const version = `0.${yy}.${mm}`;
