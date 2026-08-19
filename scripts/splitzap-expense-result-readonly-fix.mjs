import fs from 'node:fs';

const path = 'src/features/splitzap/SplitzapAppV4.tsx';
let source = fs.readFileSync(path, 'utf8');
const start = source.indexOf('function ExpenseResultSheet(');
const end = source.indexOf('function HistoryDialog(', start);
if (start < 0 || end < 0) throw new Error('Could not isolate ExpenseResultSheet.');
let block = source.slice(start, end);

const requiredSignature = `onEdit: () => void; onDelete?: () => void`;
if (block.includes(requiredSignature)) block = block.replace(requiredSignature, `onEdit?: () => void; onDelete?: () => void`);

const editButton = `<button type="button" onClick={onEdit} className="press rounded-2xl bg-surface-2 py-3.5 text-xs font-bold">Edit</button>`;
if (block.includes(editButton)) block = block.replace(editButton, `{onEdit ? ${editButton} : null}`);

const grid = `<div className="grid grid-cols-3 gap-2">`;
if (block.includes(grid)) block = block.replace(grid, `<div className={\`grid gap-2 \${onEdit ? 'grid-cols-3' : 'grid-cols-2'}\`}>`);

source = source.slice(0, start) + block + source.slice(end);
fs.writeFileSync(path, source);
console.log('Splitzap archived expense result made read-only.');
