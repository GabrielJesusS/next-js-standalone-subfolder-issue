// Finds the first published `next` release whose route-module.js contains the
// `getRequestMeta(req, 'relativeProjectDir') || this.relativeProjectDir` fallback.
// It reads the published files from the npm CDN, so nothing is installed or built.
//
// Usage: node scripts/bisect-versions.mjs [regex for the versions to search]
// Default: the canaries between 15.4.0 and 15.5.0 (15.4.x-canary.N).

const BUGGY = /'relativeProjectDir'\) \|\| this\.relativeProjectDir/;
const series = new RegExp(process.argv[2] ?? '^15\\.4\\.\\d+-canary\\.\\d+$');

async function hasBug(version) {
  const url = `https://cdn.jsdelivr.net/npm/next@${version}/dist/server/route-modules/route-module.js`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${version}: ${res.status} fetching ${url}`);
  return BUGGY.test(await res.text());
}

const registry = await (await fetch('https://registry.npmjs.org/next')).json();
// Publish order, which is release order within a canary series.
const versions = Object.keys(registry.time)
  .filter((v) => series.test(v))
  .sort((a, b) => new Date(registry.time[a]) - new Date(registry.time[b]));

if (versions.length < 2) throw new Error(`fewer than 2 versions match ${series}`);
console.log(`${versions.length} versions: ${versions[0]} ... ${versions.at(-1)}`);

let lo = 0;
let hi = versions.length - 1;
if (await hasBug(versions[lo])) throw new Error(`${versions[lo]} already has the bug; widen the range`);
if (!(await hasBug(versions[hi]))) throw new Error(`${versions[hi]} does not have the bug; widen the range`);

while (hi - lo > 1) {
  const mid = (lo + hi) >> 1;
  const bug = await hasBug(versions[mid]);
  console.log(`  ${versions[mid]}: ${bug ? 'has the bug' : 'ok'}`);
  if (bug) hi = mid;
  else lo = mid;
}

console.log(`last without the bug: ${versions[lo]}`);
console.log(`first with the bug:   ${versions[hi]} (published ${registry.time[versions[hi]]})`);
