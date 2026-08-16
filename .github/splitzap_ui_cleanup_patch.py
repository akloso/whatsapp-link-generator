from pathlib import Path
import re

app_path = Path('src/features/splitzap/SplitzapAppV4.tsx')
css_path = Path('src/features/splitzap/splitzap.css')
app = app_path.read_text()
css = css_path.read_text()


def replace_once(old: str, new: str, label: str):
    global app
    count = app.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    app = app.replace(old, new, 1)


def regex_once(pattern: str, repl: str, label: str, flags=re.S):
    global app
    app, count = re.subn(pattern, repl, app, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex match, got {count}')

# 1) Friendlier field labels: sentence case, larger and calmer.
regex_once(
    r"function Field\(\{ label, children, compact = false \}: \{ label: string; children: ReactNode; compact\?: boolean \}\) \{.*?\n\}",
    """function Field({ label, children, compact = false }: { label: string; children: ReactNode; compact?: boolean }) {
  return <div className={compact ? 'mb-2' : 'mb-4'}><div className=\"mb-1.5 text-[12px] font-semibold text-muted-foreground\">{label}</div>{children}</div>;
}""",
    'Field component',
)

# 2) Auto category/icon from expense description until user manually overrides it.
marker = "const suggestGroupEmoji = (value: string) => {"
if marker not in app:
    raise SystemExit('suggestGroupEmoji marker missing')
helper = """const suggestExpenseCategory = (value: string) => {
  const text = value.trim().toLowerCase();
  if (!text) return 'general';
  if (/dinner|lunch|breakfast|food|restaurant|cafe|coffee|tea|drink|beer|pizza|burger|grocery|groceries|snack/.test(text)) return 'food';
  if (/hotel|stay|airbnb|hostel|room|resort|accommodation/.test(text)) return 'stay';
  if (/flight|airport|train|travel|trip|tour|visa/.test(text)) return 'travel';
  if (/uber|ola|cab|taxi|auto|metro|bus|fuel|petrol|diesel|parking|toll|transport/.test(text)) return 'transport';
  if (/movie|cinema|game|bowling|club|party|ticket|concert|fun|entertainment/.test(text)) return 'fun';
  if (/shopping|shop|clothes|shirt|shoes|gift|mall|purchase/.test(text)) return 'shopping';
  if (/rent|electricity|electric|wifi|internet|broadband|water|gas|bill|recharge|maintenance/.test(text)) return 'bills';
  return 'general';
};

"""
app = app.replace(marker, helper + marker, 1)

replace_once(
    "  const [category, setCategory] = useState(editing?.category ?? 'general');",
    "  const [category, setCategory] = useState(editing?.category ?? 'general');\n  const [categoryTouched, setCategoryTouched] = useState(Boolean(editing));",
    'category touched state',
)
replace_once(
    "  const [mode, setMode] = useState<SplitMode>(editing?.mode ?? 'equal');",
    "  const [mode, setMode] = useState<SplitMode>(editing?.mode ?? 'equal');\n  const [splitExpanded, setSplitExpanded] = useState((editing?.mode ?? 'equal') !== 'equal');",
    'split expanded state',
)
replace_once(
    '<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Dinner, cab…"',
    '<input value={description} onChange={(event) => { const next = event.target.value; setDescription(next); if (!categoryTouched) setCategory(suggestExpenseCategory(next)); }} placeholder="Dinner, cab…"',
    'description auto category',
)
replace_once(
    '<select value={category} onChange={(event) => setCategory(event.target.value)} className={`${inputClass} py-2.5 text-sm`}>',
    '<select value={category} onChange={(event) => { setCategory(event.target.value); setCategoryTouched(true); }} className={`${inputClass} py-2.5 text-sm`}>',
    'manual category override',
)
replace_once(
    "    setMode(next);\n    if (next === 'exact')",
    "    setMode(next);\n    setSplitExpanded(next !== 'equal');\n    if (next === 'exact')",
    'mode progressive disclosure',
)

# 3) Equal split: collapse people rows until the user asks to edit them.
replace_once(
    '<div className="divide-y divide-border overflow-hidden rounded-xl border border-border">{group?.members.map((member) => {',
    """{mode === 'equal' && !splitExpanded ? <button type=\"button\" onClick={() => setSplitExpanded(true)} className=\"press flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-3 text-left\"><div className=\"min-w-0 flex-1\"><p className=\"text-sm font-bold\">Split equally</p><p className=\"mt-0.5 truncate text-[11px] text-muted-foreground\">{group?.members.filter((member) => Number(activeSplit[member.id] ?? 0) > 0).map((member) => displayName(group, data, member.id)).join(', ') || 'Nobody selected'}</p></div><span className=\"tabular text-xs font-bold text-muted-foreground\">{money(sharedTotal, group?.currency)}</span><span className=\"text-xs font-extrabold text-primary\">Edit</span></button> : <div className=\"divide-y divide-border overflow-hidden rounded-xl border border-border\">{group?.members.map((member) => {""",
    'equal split collapsed start',
)
replace_once(
    "</div>{mode === 'exact' && baseTotal > 0 ?",
    "</div>}{mode === 'exact' && baseTotal > 0 ?",
    'equal split collapsed end',
)

# 4) Compact advanced controls and humanize Selective -> Some people in the UI.
pattern = r'<div className="mb-2 grid grid-cols-3 gap-2">.*?</div>\{chargeTotal > 0 \?'
advanced = """<div className=\"mb-3 grid grid-cols-3 gap-1.5\"><button type=\"button\" onClick={() => setPersonalOpen(true)} title=\"Personal item\" className={`press flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-bold ${personalItems.length ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface-2 text-foreground'}`}><span>👤</span><span>Personal</span>{personalItems.length ? <span className=\"grid min-w-5 place-items-center rounded-full bg-surface px-1.5 py-0.5 text-[10px]\">{personalItems.length}</span> : null}</button><button type=\"button\" onClick={() => setSelectiveOpen(true)} title=\"Split an item with only some people\" className={`press flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-bold ${selectiveItems.length ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface-2 text-foreground'}`}><span>👥</span><span>Some people</span>{selectiveItems.length ? <span className=\"grid min-w-5 place-items-center rounded-full bg-surface px-1.5 py-0.5 text-[10px]\">{selectiveItems.length}</span> : null}</button><button type=\"button\" onClick={() => { if (!charges.length) setCharges([{ id: uid(), description: '', amount: 0, distribution: 'equal' }]); setChargesOpen(true); }} title=\"Additional charges\" className={`press flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-bold ${charges.length ? 'border-primary/20 bg-secondary text-primary' : 'border-border bg-surface-2 text-foreground'}`}><span>🧾</span><span>Charges</span>{charges.length ? <span className=\"grid min-w-5 place-items-center rounded-full bg-surface px-1.5 py-0.5 text-[10px]\">{charges.length}</span> : null}</button></div>{chargeTotal > 0 ?"""
regex_once(pattern, advanced, 'advanced controls')
app = app.replace('title="Selective items"', 'title="Split with some people"')
app = app.replace('Save selective item', 'Save item')
app = app.replace('>Selective items<', '>Shared by some people<')
app = app.replace(' selective</span>', ' selected item</span>')

# 5) Home: simplify hero detail and remove duplicated + New group action.
old_hero = '<div className="mt-4 grid grid-cols-2 gap-3"><div className="hero-stat rounded-2xl bg-primary-foreground/12 p-3"><p className="text-[11px] font-semibold opacity-75">You are owed</p><p className="tabular text-lg font-bold"><AnimatedMoney value={totalOwed} /></p></div><div className="hero-stat rounded-2xl bg-primary-foreground/12 p-3"><p className="text-[11px] font-semibold opacity-75">You owe</p><p className="tabular text-lg font-bold"><AnimatedMoney value={totalOwe} /></p></div></div>'
new_hero = '<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold opacity-85"><span>Owed <b className="tabular text-primary-foreground">{money(totalOwed)}</b></span><span className="opacity-40">•</span><span>Owe <b className="tabular text-primary-foreground">{money(totalOwe)}</b></span></div>'
replace_once(old_hero, new_hero, 'home hero secondary balances')
old_groups_heading = '<div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Groups</p><p className="mt-0.5 text-xs text-muted-foreground">{data.groups.length} active {data.groups.length === 1 ? \'group\' : \'groups\'}</p></div><button type="button" onClick={() => setGroupOpen(true)} className="press text-xs font-bold text-primary">+ New group</button></div>'
new_groups_heading = '<div className="mb-2"><p className="text-sm font-extrabold">Groups</p><p className="mt-0.5 text-[11px] text-muted-foreground">{data.groups.length} active {data.groups.length === 1 ? \'group\' : \'groups\'}</p></div>'
replace_once(old_groups_heading, new_groups_heading, 'remove duplicated new group')

# 6) New group: keep auto icon, but hide customization until needed and compress currency.
new_group_fn = r'''function NewGroupSheet({ open, onClose, data, update, onCreated }: { open: boolean; onClose: () => void; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; onCreated?: (groupId: string) => void }) {
  const [name, setName] = useState('');
  const [creatorName, setCreatorName] = useState(data.myName?.trim() ?? '');
  const [emoji, setEmoji] = useState('👥');
  const [emojiTouched, setEmojiTouched] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [currency, setCurrency] = useState('₹');
  const [people, setPeople] = useState<string[]>(['']);
  const presets = useMemo(() => {
    const stats = new Map<string, { name: string; count: number; last: number }>();
    data.groups.forEach((group) => group.members.forEach((member) => { if (member.id === data.me) return; const clean = member.name.trim(); if (!clean) return; const key = clean.toLowerCase(); const current = stats.get(key); stats.set(key, { name: clean, count: (current?.count ?? 0) + 1, last: Math.max(current?.last ?? 0, +new Date(group.createdAt)) }); }));
    return [...stats.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, 8).map((item) => item.name);
  }, [data.groups, data.me]);
  useEffect(() => { if (open && data.myName?.trim() && !creatorName.trim()) setCreatorName(data.myName.trim()); }, [open, data.myName, creatorName]);
  const selectedPreset = (preset: string) => people.some((person) => person.trim().toLowerCase() === preset.toLowerCase());
  const togglePreset = (preset: string) => { if (selectedPreset(preset)) setPeople(people.filter((person) => person.trim().toLowerCase() !== preset.toLowerCase()).length ? people.filter((person) => person.trim().toLowerCase() !== preset.toLowerCase()) : ['']); else { const blank = people.findIndex((person) => !person.trim()); if (blank >= 0) setPeople(people.map((person, index) => index === blank ? preset : person)); else setPeople([...people, preset]); } };
  const valid = Boolean(name.trim() && creatorName.trim() && people.some((person) => person.trim()));
  const create = () => { if (!valid) return; const groupId = uid(); const creator = creatorName.trim(); const unique = [...new Map(people.map((person) => person.trim()).filter(Boolean).map((person) => [person.toLowerCase(), person])).values()]; update((current) => ({ ...current, myName: creator, groups: [{ id: groupId, name: name.trim(), emoji, currency, createdAt: new Date().toISOString(), members: [{ id: current.me, name: creator }, ...unique.map((person) => ({ id: uid(), name: person }))] }, ...current.groups.map((group) => ({ ...group, members: group.members.map((member) => member.id === current.me && (!member.name.trim() || member.name.toLowerCase() === 'you') ? { ...member, name: creator } : member) }))] })); onClose(); setName(''); setEmoji('👥'); setEmojiTouched(false); setIconOpen(false); setPeople(['']); onCreated?.(groupId); };
  return <SheetModal open={open} onClose={onClose} title="New group" footer={<PrimaryButton onClick={create} disabled={!valid}>Create group</PrimaryButton>}>
    <Field label="Group name"><input value={name} onChange={(event) => { const next = event.target.value; setName(next); if (!emojiTouched) setEmoji(suggestGroupEmoji(next)); }} placeholder="Trip, apartment, dinner crew…" className={inputClass} /></Field>
    <Field label="Your name"><input value={creatorName} onChange={(event) => setCreatorName(event.target.value)} placeholder="Your name" className={inputClass} /></Field>
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_112px] gap-2"><button type="button" onClick={() => setIconOpen((value) => !value)} className="press flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 text-left"><span className="text-2xl">{emoji}</span><span className="min-w-0 flex-1"><b className="block text-xs">Group icon</b><span className="block truncate text-[11px] text-muted-foreground">Auto-selected · Change</span></span></button><div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Currency</label><select value={currency} onChange={(event) => setCurrency(event.target.value)} className={`${inputClass} py-2.5 text-sm`}>{CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
    {iconOpen ? <div className="mb-4 rounded-xl border border-border bg-surface-2 p-3"><p className="mb-2 text-[11px] text-muted-foreground">Choose a different icon</p><div className="flex flex-wrap gap-2">{EMOJIS.map((item) => <button key={item} type="button" onClick={() => { setEmoji(item); setEmojiTouched(true); setIconOpen(false); }} className={`emoji-choice press grid size-10 place-items-center rounded-xl border text-lg ${emoji === item ? 'is-selected border-primary bg-secondary' : 'border-border bg-surface'}`}>{item}</button>)}</div></div> : null}
    {presets.length ? <Field label="Frequently added"><div className="flex flex-wrap gap-2">{presets.map((preset) => <button type="button" key={preset} onClick={() => togglePreset(preset)} className={`press rounded-full border px-3 py-2 text-xs font-bold ${selectedPreset(preset) ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface-2 text-muted-foreground'}`}>{selectedPreset(preset) ? '✓ ' : '+ '}{preset}</button>)}</div></Field> : null}
    <Field label="Other people"><div className="space-y-2">{people.map((person, index) => <div key={index} className="flex items-center gap-2"><input value={person} onChange={(event) => setPeople(people.map((item, personIndex) => personIndex === index ? event.target.value : item))} placeholder={`Person ${index + 1}`} className={inputClass} />{people.length > 1 ? <button type="button" onClick={() => setPeople(people.filter((_, personIndex) => personIndex !== index))} className="press grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><X size={15} /></button> : null}</div>)}<button type="button" onClick={() => setPeople([...people, ''])} className="press min-h-10 px-1 text-sm font-bold text-primary">+ Add another person</button></div></Field>
  </SheetModal>;
}
'''
regex_once(r'function NewGroupSheet\(.*?\n\}\n\nfunction SettleSheet', new_group_fn + '\nfunction SettleSheet', 'NewGroupSheet rewrite')

# 7) Result hierarchy: summary -> settlement -> supporting detail, one continuous document.
expense_breakdown_fn = r'''function ExpenseBreakdown({ expense, group, data, onHistory }: { expense: Expense; group: Group; data: SplitData; onHistory?: () => void }) {
  const debts = expenseSettlement(expense, group);
  const labels = group.members.flatMap((member) => {
    const name = displayName(group, data, member.id);
    const label = expense.mode === 'exact' ? expense.splitLabels?.[member.id]?.trim() : '';
    const personalItems = (expense.receiptItems?.length ? [] : expense.personalItems ?? []).filter((item) => item.memberId === member.id);
    return [...(label ? [{ key: `label-${member.id}`, text: `${name}: ${label}` }] : []), ...personalItems.map((item) => ({ key: item.id, text: `${name}: ${item.description} · ${shareMoney(item.amount, group.currency)}` }))];
  });
  const chargeLine = (expense.additionalCharges ?? []).filter((charge) => charge.amount > 0).map((charge) => `${charge.description} ${shareMoney(charge.amount, group.currency)}`).join(' · ');
  const historyCount = (data.history ?? []).filter((entry) => entry.expenseId === expense.id).length;
  const receiptItems = expense.receiptItems ?? [];
  const selectiveItems = expense.selectiveItems ?? [];
  return <div className="space-y-3"><div className="result-total rounded-2xl bg-surface-2 p-4"><p className="text-[12px] font-extrabold text-primary">💸 Splitzap</p><p className="mt-1.5 text-xl font-extrabold">{expense.description} · {shareMoney(expense.amount, group.currency)}</p>{chargeLine ? <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">Additional charges · {chargeLine}</p> : null}<p className="mt-1 text-[12px] text-muted-foreground">Paid by {payerSummary(expense, group, data, true)}</p></div><div className="result-document overflow-hidden rounded-2xl border border-border bg-surface"><section className="p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Settlement</p><span className="text-[11px] font-semibold text-muted-foreground">Who owes whom</span></div><div className="mt-3 space-y-2">{debts.length ? debts.map((debt) => <div key={`${debt.from}-${debt.to}`} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-3"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{displayName(group, data, debt.from)} → {displayName(group, data, debt.to)}</span><span className="tabular text-sm font-extrabold">{shareMoney(debt.amount, group.currency)}</span></div>) : <div className="rounded-xl bg-surface-2 px-3 py-3 text-sm font-semibold text-muted-foreground">Everyone is settled for this expense.</div>}</div></section>{selectiveItems.length ? <section className="border-t border-border p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Shared by some people</p><span className="text-[11px] text-muted-foreground">{selectiveItems.length} {selectiveItems.length === 1 ? 'item' : 'items'}</span></div><div className="mt-2 space-y-2">{selectiveItems.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 py-1"><div className="min-w-0"><p className="truncate text-xs font-bold">{item.description}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{item.memberIds.map((id) => displayName(group, data, id)).join(', ')} · {item.mode === 'equal' ? 'Equal' : item.mode === 'exact' ? 'Exact' : 'Percentage'}</p></div><span className="tabular shrink-0 text-xs font-extrabold">{shareMoney(item.amount, group.currency)}</span></div>)}</div></section> : null}{receiptItems.length ? <section className="border-t border-border p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Scanned bill items</p><span className="text-[11px] text-muted-foreground">{receiptItems.length} items</span></div><div className="mt-2 divide-y divide-border">{receiptItems.map((item) => <div key={item.id} className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.description}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{item.memberId ? displayName(group, data, item.memberId) : 'Shared'}</p></div><span className="tabular text-xs font-extrabold">{shareMoney(item.amount, group.currency)}</span></div>)}</div></section> : null}{labels.length ? <section className="border-t border-border p-4"><p className="text-sm font-extrabold">Details</p><div className="mt-2 divide-y divide-border">{labels.map((detail) => <div key={detail.key} className="py-2.5 text-[12px] text-muted-foreground">{detail.text}</div>)}</div></section> : null}</div>{historyCount && onHistory ? <button type="button" onClick={onHistory} className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface-2 px-3 text-xs font-bold text-muted-foreground"><History size={14} /> View edit history ({historyCount})</button> : null}</div>;
}
'''
regex_once(r'function ExpenseBreakdown\(.*?\n\}\n\nfunction ExpenseResultSheet', expense_breakdown_fn + '\nfunction ExpenseResultSheet', 'ExpenseBreakdown rewrite')

# 8) Tone down Insights without removing any visualization.
insights_fn = r'''function InsightsTab({ group, data, expenses }: { group: Group; data: SplitData; expenses: Expense[] }) {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const average = group.members.length ? total / group.members.length : 0;
  const categoryTotals = CATEGORIES.map((category) => ({ key: category.id, label: `${category.emoji} ${category.label}`, value: expenses.filter((expense) => expense.category === category.id).reduce((sum, expense) => sum + expense.amount, 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const memberRows = group.members.map((member) => ({ key: member.id, label: displayName(group, data, member.id), paid: expenses.reduce((sum, expense) => sum + (paymentsOf(expense)[member.id] ?? 0), 0), share: expenses.reduce((sum, expense) => sum + shareOf(expense, member.id, group.members.map((m) => m.id)), 0) }));
  const largest = [...expenses].sort((a, b) => b.amount - a.amount)[0];
  const personal = expenses.reduce((sum, expense) => sum + personalTotalOf(expense), 0);
  return <section className="space-y-3 px-5 pt-2"><div className="grid grid-cols-2 gap-2"><div className="card-soft p-4"><p className="text-[11px] font-semibold text-muted-foreground">Total spent</p><p className="mt-1 text-2xl font-extrabold text-primary">{money(total, group.currency)}</p><p className="mt-2 text-[11px] text-muted-foreground">{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</p></div><div className="card-soft p-4"><p className="text-[11px] font-semibold text-muted-foreground">Average per person</p><p className="mt-1 text-2xl font-extrabold">{money(average, group.currency)}</p><p className="mt-2 text-[11px] text-muted-foreground">{group.members.length} people</p></div></div><InsightDonut rows={categoryTotals} total={total} currency={group.currency} /><PaidShareChart rows={memberRows} currency={group.currency} /><div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-3 text-center"><div className="rounded-xl bg-surface-2 p-3"><p className="text-[11px] font-semibold text-muted-foreground">Expenses</p><p className="mt-1 text-lg font-extrabold">{expenses.length}</p></div><div className="rounded-xl bg-surface-2 p-3"><p className="text-[11px] font-semibold text-muted-foreground">Largest</p><p className="mt-1 truncate text-sm font-extrabold">{largest ? money(largest.amount, group.currency) : '—'}</p></div><div className="rounded-xl bg-surface-2 p-3"><p className="text-[11px] font-semibold text-muted-foreground">Personal</p><p className="mt-1 truncate text-sm font-extrabold">{money(personal, group.currency)}</p></div>{largest ? <p className="col-span-3 truncate px-2 pt-1 text-[11px] text-muted-foreground">Largest expense · {largest.description}</p> : null}</div></section>;
}
'''
regex_once(r'function InsightsTab\(.*?\n\}\n\nfunction InsightDonut', insights_fn + '\nfunction InsightDonut', 'InsightsTab rewrite')

# 9) Activity should scan like a timeline, not a stack of elevated cards.
app = app.replace('className="card-soft list-enter press flex w-full items-center gap-3 p-3.5 text-left" style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}', 'className="activity-row list-enter press flex w-full items-center gap-3 border-b border-border px-1 py-3.5 text-left" style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}')

# 10) Edit/share controls remain available but visually secondary; primary green stays for the main action/menu.
app = app.replace('aria-label="Share group" className="press grid size-9 place-items-center rounded-full bg-secondary text-primary"', 'aria-label="Share group" className="press grid size-10 place-items-center rounded-full bg-surface-2 text-muted-foreground"')
app = app.replace('aria-label="Edit group" className="press grid size-9 place-items-center rounded-full bg-surface-2 text-muted-foreground"', 'aria-label="Edit group" className="press grid size-10 place-items-center rounded-full bg-surface-2 text-muted-foreground"')
app = app.replace('aria-label="More group options" className="press relative z-40 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground"', 'aria-label="More group options" className="press relative z-40 grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"')

# 11) CSS calm-density pass: flatter repeated content, smaller radii, less perpetual motion, readable secondary text and larger tap targets.
marker_css = '/* Splitzap UI calm-density pass */'
if marker_css in css:
    css = css.split(marker_css)[0].rstrip() + '\n'
css += r'''

/* Splitzap UI calm-density pass */
.splitzap-root .rounded-xl { border-radius: 0.9rem; }
.splitzap-root .rounded-2xl { border-radius: 1.1rem; }
.splitzap-root .rounded-3xl { border-radius: 1.4rem; }
.splitzap-root .rounded-lg { border-radius: 0.75rem; }

.splitzap-root .group-card,
.splitzap-root .expense-card {
  border: 0;
  border-bottom: 1px solid oklch(var(--border) / 0.72);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.splitzap-root .group-card:last-child,
.splitzap-root .expense-card:last-child,
.splitzap-root .activity-row:last-child {
  border-bottom-color: transparent;
}

.splitzap-root .activity-row {
  background: transparent;
}

.splitzap-root .payment-row {
  border: 0;
  border-bottom: 1px solid oklch(var(--border) / 0.72);
  border-radius: 0;
  background: transparent;
}

.splitzap-root .result-section {
  border-radius: 0;
  box-shadow: none;
}

.splitzap-root .result-document {
  box-shadow: 0 8px 28px -24px oklch(0.3 0.04 165 / 0.25);
}

.splitzap-ambient {
  opacity: 0.5;
  animation: none;
}

.splitzap-fab {
  animation: none;
}

.splitzap-fab::after {
  display: none;
  animation: none;
}

.success-check::after {
  animation-iteration-count: 1;
}

.splitzap-root .text-\[9px\] { font-size: 0.6875rem; }
.splitzap-root .text-\[10px\] { font-size: 0.75rem; }

.splitzap-root button.size-7,
.splitzap-root button.size-8 {
  min-width: 2.5rem;
  min-height: 2.5rem;
}

.splitzap-root .splitzap-input {
  border-radius: 0.9rem;
}

@media (prefers-reduced-motion: reduce) {
  .splitzap-root *,
  .splitzap-root *::before,
  .splitzap-root *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
'''

# Sanity assertions.
for needle in [
    'suggestExpenseCategory',
    'categoryTouched',
    'splitExpanded',
    'Split equally',
    'Some people',
    'result-document',
    'Auto-selected · Change',
    'activity-row',
]:
    if needle not in app:
        raise SystemExit(f'missing expected UI marker: {needle}')

app_path.write_text(app)
css_path.write_text(css)
print('UI_PATCH_OK')
