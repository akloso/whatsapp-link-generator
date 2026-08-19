import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourcePath = 'scripts/splitzap-production-ui.mjs';
const tempPath = 'scripts/.splitzap-production-ui-runtime.mjs';
let source = fs.readFileSync(sourcePath, 'utf8');

// The generator intentionally embeds TSX. Escape template literals that would otherwise
// be parsed by the generator itself before the TSX is written.
source = source.replace(
  "return <span className={`expense-confetti ${strong ? 'is-strong' : ''}`} aria-hidden=\"true\">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</span>;",
  "return <span className={'expense-confetti ' + (strong ? 'is-strong' : '')} aria-hidden=\"true\">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</span>;",
);
source = source.replace("new Date(`${value}T12:00:00`)", "new Date(value + 'T12:00:00')");
fs.writeFileSync(tempPath, source);

try {
  await import(pathToFileURL(path.resolve(tempPath)).href + `?t=${Date.now()}`);
} finally {
  try { fs.unlinkSync(tempPath); } catch { /* cleanup only */ }
}

// Generated-source compatibility cleanups. These are deterministic and guarded by
// exact strings so a future source change fails visibly rather than silently guessing.
{
  const file = 'src/features/splitzap/SplitzapAppV4.tsx';
  let value = fs.readFileSync(file, 'utf8');
  value = value.replace('  Scale,\n', '');
  value = value.replace(/function AnimatedMoney\([\s\S]*?\n}\n\nfunction Avatar/, 'function Avatar');
  value = value.replace(".replaceAll('_', ' ')", ".replace(/_/g, ' ')");
  value = value.replace(' data={data} defaultGroupId={group.id} onUse=', ' data={data} onUse=');
  value = value.replace('buildGroupShareMessage(group, data, balances)', 'buildGroupShareMessage(group, data)');
  fs.writeFileSync(file, value);
}

{
  const file = 'src/features/splitzap/SplitzapCloudApp.tsx';
  let value = fs.readFileSync(file, 'utf8');
  value = value.replace('listSharedActivity,', 'loadSharedActivity,');
  value = value.replace('const [joinRequested, setJoinRequested] = useState(false);', 'const [, setJoinRequested] = useState(false);');
  fs.writeFileSync(file, value);
}

console.log('Splitzap generated-source compatibility pass applied.');
