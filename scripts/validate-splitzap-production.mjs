import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const logPath = 'scripts/splitzap-upgrade-diagnostic.log';
const lines = [];
const run = (label, command, args) => {
  lines.push(`== ${label} ==`);
  const result = spawnSync(command, args, { encoding: 'utf8', env: process.env });
  if (result.stdout) lines.push(result.stdout.trimEnd());
  if (result.stderr) lines.push(result.stderr.trimEnd());
  lines.push(`exit=${result.status ?? 1}`);
  return result.status ?? 1;
};

const checks = [
  ['data patch', 'node', ['scripts/splitzap-production-upgrade.mjs']],
  ['product patch', 'node', ['scripts/run-splitzap-production-ui.mjs']],
  ['final product polish', 'node', ['scripts/splitzap-final-polish.mjs']],
  ['archived expense read-only fix', 'node', ['scripts/splitzap-expense-result-readonly-fix.mjs']],
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['splitzap tests', 'npm', ['run', 'test:splitzap']],
  ['production build', 'npm', ['run', 'build']],
  ['production dependency audit', 'npm', ['audit', '--omit=dev', '--audit-level=high']],
];

let failed = false;
for (const [label, command, args] of checks) {
  if (failed) {
    lines.push(`== ${label} ==`, 'skipped because an earlier validation failed');
    continue;
  }
  const status = run(label, command, args);
  if (status !== 0) failed = true;
}

if (failed) {
  const output = lines.join('\n') + '\n';
  // Never leave generated source in testing when validation fails.
  spawnSync('git', ['reset', '--hard', 'HEAD'], { stdio: 'inherit' });
  fs.writeFileSync(logPath, output);
  console.error(output);
  process.exit(1);
}

try { fs.unlinkSync(logPath); } catch { /* may not exist */ }
console.log(lines.join('\n'));
console.log('Splitzap production validation succeeded.');
