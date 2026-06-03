// Build-time git metadata. Runs in Astro frontmatter (Node) during the
// build, so the "built / last touched / version" stamps reflect the actual
// last commit instead of whatever day the site happened to be rebuilt.
//
// CI checks out full history (fetch-depth: 0 in deploy.yml) specifically so
// this can read `git log`. If git is unavailable for any reason we fall back
// to the current date rather than break the build.
import { execSync } from 'node:child_process';

function lastCommitDate(): Date {
  try {
    const iso = execSync('git log -1 --format=%cI', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  } catch {
    /* no git / no history — fall through */
  }
  return new Date();
}

const commit = lastCommitDate();

const yy = String(commit.getFullYear()).slice(2);
const mm = String(commit.getMonth() + 1).padStart(2, '0');
const dd = String(commit.getDate()).padStart(2, '0');

// `built` mirrors the old yy.mm.dd stamp; `touched` keeps the ISO form.
// both derive from the same commit so they stay in step with git activity.
export const buildStamp = `${yy}.${mm}.${dd}`;
export const touchedStamp = `${commit.getFullYear()}-${mm}-${dd}`;
export const version = `0.${yy}.${mm}`;
