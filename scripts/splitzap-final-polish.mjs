import fs from 'node:fs';

const replaceOnce = (source, from, to, label) => {
  if (!source.includes(from)) throw new Error(`Splitzap final polish could not find ${label}.`);
  return source.replace(from, to);
};

const replaceAllChecked = (source, from, to, minimum, label) => {
  const count = source.split(from).length - 1;
  if (count < minimum) throw new Error(`Splitzap final polish expected at least ${minimum} ${label} occurrence(s), found ${count}.`);
  return source.split(from).join(to);
};

const cloudPath = 'src/features/splitzap/SplitzapCloudApp.tsx';
let cloud = fs.readFileSync(cloudPath, 'utf8');
const oldSyncCard = `<ProfileSection title="Data & Privacy"><div className="rounded-xl bg-slate-50 px-3 py-3"><p className="text-xs font-bold">Cloud sync</p><p className="mt-0.5 text-[10px] text-slate-500">{status === 'synced' ? \`Up to date\${lastSyncedAt ? \` · \${new Date(lastSyncedAt).toLocaleString()}\` : ''}\` : statusMessage}</p></div><div className="mt-2 grid grid-cols-2 gap-2">`;
const newSyncCard = `<ProfileSection title="Data & Privacy">{status === 'offline' || status === 'error' ? <div className={\`rounded-xl px-3 py-3 \${status === 'offline' ? 'bg-amber-50' : 'bg-red-50'}\`}><p className={\`text-xs font-bold \${status === 'offline' ? 'text-amber-800' : 'text-red-800'}\`}>{status === 'offline' ? 'Offline' : 'Sync problem'}</p><p className={\`mt-0.5 text-[10px] \${status === 'offline' ? 'text-amber-700' : 'text-red-700'}\`}>{statusMessage}{lastSyncedAt ? \` · Last synced \${new Date(lastSyncedAt).toLocaleString()}\` : ''}</p></div> : null}<div className="mt-2 grid grid-cols-2 gap-2">`;
cloud = replaceOnce(cloud, oldSyncCard, newSyncCard, 'profile sync-status card');
fs.writeFileSync(cloudPath, cloud);

const v4Path = 'src/features/splitzap/SplitzapAppV4.tsx';
let v4 = fs.readFileSync(v4Path, 'utf8');

v4 = replaceOnce(
  v4,
  `    case 'expense_deleted': return { icon: '−', title: \`\${actor} deleted \${String(before.description ?? 'an expense')}\`, detail: amount ? money(amount, currency) : '' };`,
  `    case 'expense_deleted': return { icon: '−', title: \`\${actor} deleted \${String(before.description ?? 'an expense')}\`, detail: amount ? money(amount, currency) : '' };\n    case 'expense_restored': return { icon: '↶', title: \`\${actor} restored \${String(after.description ?? 'an expense')}\`, detail: amount ? money(amount, currency) : '' };`,
  'expense restored activity copy',
);

v4 = replaceAllChecked(
  v4,
  `<AddExpenseSheet open={addOpen}`,
  `<AddExpenseSheet key={addOpen ? 'expense-open' : 'expense-closed'} open={addOpen}`,
  3,
  'AddExpenseSheet',
);

v4 = replaceOnce(
  v4,
  `  const groups = data.groups;\n  const initialPayments = editing ? paymentsOf(editing) : {};`,
  `  const groups = data.groups.filter((item) => (item.status ?? item.sharedStatus ?? 'active') !== 'archived' || editing?.groupId === item.id);\n  const initialPayments = editing ? paymentsOf(editing) : {};`,
  'active expense-group filter',
);

const scannerStart = v4.indexOf('function ReceiptScanner(');
const scannerEnd = v4.indexOf('function makeHistoryChanges(', scannerStart);
if (scannerStart < 0 || scannerEnd < 0) throw new Error('Splitzap final polish could not isolate ReceiptScanner.');
let scanner = v4.slice(scannerStart, scannerEnd);
scanner = scanner.split('data.groups').join('availableGroups');
scanner = scanner.replace(
  `function ReceiptScanner({ open, onClose, data, onUse }: { open: boolean; onClose: () => void; data: SplitData; onUse: (seed: ScanExpenseSeed) => void }) {\n`,
  `function ReceiptScanner({ open, onClose, data, onUse }: { open: boolean; onClose: () => void; data: SplitData; onUse: (seed: ScanExpenseSeed) => void }) {\n  const availableGroups = data.groups.filter((item) => (item.status ?? item.sharedStatus ?? 'active') !== 'archived');\n`,
);
v4 = v4.slice(0, scannerStart) + scanner + v4.slice(scannerEnd);

v4 = replaceAllChecked(
  v4,
  `onAddExpense={() => data.groups.length ? setAddOpen(true) : setGroupOpen(true)}`,
  `onAddExpense={() => activeGroups.length ? setAddOpen(true) : setGroupOpen(true)}`,
  2,
  'active Add expense quick action',
);
v4 = replaceAllChecked(
  v4,
  `onScanReceipt={() => data.groups.length ? setScannerOpen(true) : setGroupOpen(true)}`,
  `onScanReceipt={() => activeGroups.length ? setScannerOpen(true) : setGroupOpen(true)}`,
  2,
  'active Scan receipt quick action',
);
v4 = replaceAllChecked(
  v4,
  `{data.groups.length ? <AddExpenseSheet`,
  `{activeGroups.length ? <AddExpenseSheet`,
  2,
  'active AddExpenseSheet rendering',
);

const editButton = `<button type="button" onClick={() => { setMenuOpen(false); setEditGroupOpen(true); }} className="press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold"><Pencil size={14} /> Edit group</button>`;
v4 = replaceOnce(v4, editButton, `{!isArchived ? ${editButton} : null}`, 'archived edit-group guard');
const inviteButton = `<button type="button" onClick={() => { setMenuOpen(false); collaboration?.onInviteGroup(group.id); }} className="press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold"><Share2 size={14} /> {group.sharedId ? 'Invite people' : 'Share group live'}</button>`;
v4 = replaceOnce(v4, inviteButton, `{!isArchived ? ${inviteButton} : null}`, 'archived invite guard');
const archiveButton = `<button type="button" onClick={() => void archive()} className="press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold"><Archive size={14} /> {isArchived ? 'Unarchive group' : 'Archive group'}</button>`;
v4 = replaceOnce(v4, archiveButton, `{(!group.sharedId || isOwner) ? ${archiveButton} : null}`, 'shared archive-owner guard');

v4 = replaceOnce(
  v4,
  `onEdit={() => { if (!selectedExpense) return; setEditingExpense(selectedExpense); setSelectedExpense(null); setAddOpen(true); }} onDelete={selectedExpense ? () => removeExpense(selectedExpense) : undefined}`,
  `onEdit={isArchived ? undefined : () => { if (!selectedExpense) return; setEditingExpense(selectedExpense); setSelectedExpense(null); setAddOpen(true); }} onDelete={!isArchived && selectedExpense ? () => removeExpense(selectedExpense) : undefined}`,
  'archived expense edit/delete guard',
);

v4 = replaceOnce(
  v4,
  `})}{!group.sharedId ? <div className="rounded-2xl border border-dashed border-border bg-surface p-3.5">`,
  `})}{(group.status ?? group.sharedStatus ?? 'active') === 'archived' ? null : !group.sharedId ? <div className="rounded-2xl border border-dashed border-border bg-surface p-3.5">`,
  'archived balance-member guard',
);

fs.writeFileSync(v4Path, v4);
console.log('Splitzap final production polish applied.');
