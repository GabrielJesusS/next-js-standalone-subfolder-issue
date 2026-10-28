// Opt-in proof of the root cause: replaces `||` with `??` in Next's relativeProjectDir
// fallback inside node_modules. `npm ci` restores the original files.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dist = path.join(__dirname, '..', 'node_modules', 'next', 'dist');
const buggy = /(['"]relativeProjectDir['"]\))(\s*)\|\|(\s*)(this\.relativeProjectDir)/g;
const dirs = ['server/route-modules', 'esm/server/route-modules', 'compiled/next-server'];

let changed = 0;
for (const dir of dirs) {
  const absolute = path.join(dist, dir);
  if (!fs.existsSync(absolute)) continue;
  for (const name of fs.readdirSync(absolute).filter((n) => n.endsWith('.js'))) {
    const file = path.join(absolute, name);
    const source = fs.readFileSync(file, 'utf8');
    if (!buggy.test(source)) continue;
    buggy.lastIndex = 0;
    fs.writeFileSync(file, source.replace(buggy, '$1$2??$3$4'));
    if (!dir.startsWith('esm')) execFileSync(process.execPath, ['--check', file]);
    changed++;
  }
}

if (!changed) {
  console.error('apply-fix: no `relativeProjectDir || this.relativeProjectDir` found (already fixed, or Next changed)');
  process.exit(1);
}
console.log(`apply-fix: patched ${changed} file(s) in node_modules/next`);
