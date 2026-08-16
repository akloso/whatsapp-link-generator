from pathlib import Path
import re

app_path = Path('src/features/splitzap/SplitzapAppV4.tsx')
store_path = Path('src/features/splitzap/splitStoreV4.ts')
app = app_path.read_text()
store = store_path.read_text()


def once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing patch target: {label}')
    return text.replace(old, new, 1)

# ---------------- STORE ----------------
store = once(store, "export type PersonalItem = {\n  id: string;\n  memberId: string;\n  description: string;\n  amount: number;\n};\n", "export type PersonalItem = {\n  id: string;\n  memberId: string;\n  description: string;\n  amount: number;\n};\n\nexport type SelectiveItem = {\n  id: string;\n  description: string;\n  amount: number;\n  memberIds: string[];\n  mode: SplitMode;\n  split: Record<string, number>;\n};\n", 'SelectiveItem type')
store = once(store, "  personalItems?: PersonalItem[];\n  additionalCharges?: AdditionalCharge[];", "  personalItems?: PersonalItem[];\n  selectiveItems?: SelectiveItem[];\n  additionalCharges?: AdditionalCharge[];", 'Expense selectiveItems')

personal_block = """  const personalItems: PersonalItem[] = (Array.isArray(raw.personalItems) ? raw.personalItems : [])
    .map(recordOf)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : uid(),
      memberId: typeof item.memberId === 'string' ? item.memberId : '',
      description: typeof item.description === 'string' && item.description.trim() ? item.description.trim() : 'Personal item',
      amount: Math.max(0, Number(item.amount) || 0),
    }))
    .filter((item) => item.memberId && item.amount > 0);
"""
selective_norm = personal_block + """  const selectiveItems: SelectiveItem[] = (Array.isArray(raw.selectiveItems) ? raw.selectiveItems : [])
    .map(recordOf)
    .map((item) => {
      const itemMode: SplitMode = item.mode === 'exact' ? 'exact' : item.mode === 'percentage' ? 'percentage' : 'equal';
      const split = numberRecord(item.split);
      const memberIds = (Array.isArray(item.memberIds) ? item.memberIds : Object.keys(split))
        .filter((id): id is string => typeof id === 'string' && Boolean(id));
      return {
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        description: typeof item.description === 'string' && item.description.trim() ? item.description.trim() : 'Selective item',
        amount: Math.max(0, Number(item.amount) || 0),
        memberIds: [...new Set(memberIds)],
        mode: itemMode,
        split,
      };
    })
    .filter((item) => item.amount > 0 && item.memberIds.length > 0);
"""
store = once(store, personal_block, selective_norm, 'normalize selective items')
store = once(store, "    personalItems,\n    additionalCharges: normalizedCharges,", "    personalItems,\n    selectiveItems,\n    additionalCharges: normalizedCharges,", 'return selective items')

store = once(store, """export function personalTotalOf(expense: Expense) {
  return (expense.personalItems ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
}

export function sharedAmountOf(expense: Expense) {
  return Math.max(0, baseAmountOf(expense) - personalTotalOf(expense));
}
""", """export function personalTotalOf(expense: Expense) {
  return (expense.personalItems ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
}

export function selectiveItemsTotal(expense: Expense) {
  return (expense.selectiveItems ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
}

export function selectiveItemShare(item: SelectiveItem, memberId: string) {
  if (!item.memberIds.includes(memberId) || !item.memberIds.length) return 0;
  const amount = Math.max(0, Number(item.amount) || 0);
  if (item.mode === 'exact') return Math.max(0, Number(item.split[memberId]) || 0);
  if (item.mode === 'percentage') return amount * Math.max(0, Number(item.split[memberId]) || 0) / 100;
  return amount / item.memberIds.length;
}

export function selectiveShareOf(expense: Expense, memberId: string) {
  return (expense.selectiveItems ?? []).reduce((sum, item) => sum + selectiveItemShare(item, memberId), 0);
}

export function sharedAmountOf(expense: Expense) {
  return Math.max(0, baseAmountOf(expense) - personalTotalOf(expense) - selectiveItemsTotal(expense));
}
""", 'selective math helpers')
store = once(store, """export function baseShareOf(expense: Expense, memberId: string) {
  return sharedShareOf(expense, memberId) + personalShareOf(expense, memberId);
}
""", """export function baseShareOf(expense: Expense, memberId: string) {
  return sharedShareOf(expense, memberId) + personalShareOf(expense, memberId) + selectiveShareOf(expense, memberId);
}
""", 'baseShare selective math')

# ---------------- APP IMPORTS / TYPES ----------------
app = once(app, "  personalTotalOf,\n  shareOf,", "  personalTotalOf,\n  selectiveItemShare,\n  shareOf,", 'selectiveItemShare import')
app = once(app, "  type ReceiptItem,\n  type SplitData,", "  type ReceiptItem,\n  type SelectiveItem,\n  type SplitData,", 'SelectiveItem type import')
app = once(app, "type PersonalDraft = { id?: string; memberId: string; description: string; amount: string };", "type PersonalDraft = { id?: string; memberId: string; description: string; amount: string };\ntype SelectiveDraft = { id?: string; description: string; amount: string; memberIds: string[]; mode: SplitMode; split: Record<string, number> };", 'SelectiveDraft type')

# ---------------- RESULT / HISTORY / DUPLICATE ----------------
app = once(app, "  if (JSON.stringify(before.personalItems ?? []) !== JSON.stringify(after.personalItems ?? [])) add('Personal items', 'Previous items', 'Updated items');\n  if (JSON.stringify(before.additionalCharges ?? []) !== JSON.stringify(after.additionalCharges ?? []))", "  if (JSON.stringify(before.personalItems ?? []) !== JSON.stringify(after.personalItems ?? [])) add('Personal items', 'Previous items', 'Updated items');\n  if (JSON.stringify(before.selectiveItems ?? []) !== JSON.stringify(after.selectiveItems ?? [])) add('Selective items', 'Previous items', 'Updated items');\n  if (JSON.stringify(before.additionalCharges ?? []) !== JSON.stringify(after.additionalCharges ?? []))", 'selective history')
app = once(app, "personalItems: (expense.personalItems ?? []).map((item) => ({ ...item, id: uid() })), additionalCharges:", "personalItems: (expense.personalItems ?? []).map((item) => ({ ...item, id: uid() })), selectiveItems: (expense.selectiveItems ?? []).map((item) => ({ ...item, id: uid(), memberIds: [...item.memberIds], split: { ...item.split } })), additionalCharges:", 'duplicate selective items')

app = once(app, "  const receiptItems = expense.receiptItems ?? [];\n  return <div className=\"space-y-3\">", "  const receiptItems = expense.receiptItems ?? [];\n  const selectiveItems = expense.selectiveItems ?? [];\n  return <div className=\"space-y-3\">", 'breakdown selective items variable')
settlement_marker = '<div className="result-section rounded-3xl border border-border bg-surface p-4"><p className="text-sm font-extrabold">Settlement</p>'
selective_section = '''{selectiveItems.length ? <div className="result-section rounded-3xl border border-border bg-surface p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Selective items</p><span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-primary">{selectiveItems.length}</span></div><div className="mt-3 space-y-2">{selectiveItems.map((item) => <div key={item.id} className="rounded-2xl bg-surface-2 px-3 py-2.5"><div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate text-xs font-extrabold">{item.description}</p><span className="tabular shrink-0 text-xs font-extrabold">{shareMoney(item.amount, group.currency)}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{item.mode === 'equal' ? 'Equal' : item.mode === 'exact' ? 'Exact' : 'Percentage'} · {item.memberIds.map((id) => displayName(group, data, id)).join(', ')}</p></div>)}</div></div> : null}'''
app = once(app, settlement_marker, selective_section + settlement_marker, 'breakdown selective section')

# ---------------- SELECTIVE ITEM DIALOG ----------------
selective_dialog = r'''
function SelectiveItemsDialog({ open, onClose, items, onChange, group, data }: { open: boolean; onClose: () => void; items: SelectiveItem[]; onChange: (items: SelectiveItem[]) => void; group: Group; data: SplitData }) {
  const makeDraft = (): SelectiveDraft => ({ description: '', amount: '', memberIds: group.members.map((member) => member.id), mode: 'equal', split: {} });
  const [draft, setDraft] = useState<SelectiveDraft | null>(null);
  useEffect(() => { if (open && !items.length) setDraft((current) => current ?? makeDraft()); }, [open, items.length, group.id]);

  const redistribute = (mode: SplitMode, memberIds: string[], amount: number) => {
    if (!memberIds.length || mode === 'equal') return {};
    const value = mode === 'percentage' ? 100 / memberIds.length : amount / memberIds.length;
    return Object.fromEntries(memberIds.map((id) => [id, value]));
  };
  const startAdd = () => { if (!draft) setDraft(makeDraft()); };
  const editItem = (item: SelectiveItem) => setDraft({ id: item.id, description: item.description, amount: String(item.amount), memberIds: [...item.memberIds], mode: item.mode, split: { ...item.split } });
  const amountValue = Number(draft?.amount) || 0;
  const allocationTotal = draft ? draft.memberIds.reduce((sum, id) => sum + Math.max(0, Number(draft.split[id]) || 0), 0) : 0;
  const allocationValid = !draft || draft.mode === 'equal' || (draft.mode === 'exact' ? Math.abs(allocationTotal - amountValue) < 0.01 : Math.abs(allocationTotal - 100) < 0.01);
  const draftValid = Boolean(draft && amountValue > 0 && draft.memberIds.length >= 2 && allocationValid);

  const toggleMember = (memberId: string) => {
    if (!draft) return;
    const memberIds = draft.memberIds.includes(memberId) ? draft.memberIds.filter((id) => id !== memberId) : [...draft.memberIds, memberId];
    setDraft({ ...draft, memberIds, split: redistribute(draft.mode, memberIds, amountValue) });
  };
  const changeMode = (mode: SplitMode) => { if (draft) setDraft({ ...draft, mode, split: redistribute(mode, draft.memberIds, amountValue) }); };
  const changeAmount = (raw: string) => {
    if (!draft) return;
    const clean = raw.replace(/[^0-9.]/g, '');
    const nextAmount = Number(clean) || 0;
    setDraft({ ...draft, amount: clean, split: draft.mode === 'exact' ? redistribute('exact', draft.memberIds, nextAmount) : draft.split });
  };
  const saveDraft = () => {
    if (!draft || !draftValid) return;
    const saved: SelectiveItem = { id: draft.id ?? uid(), description: draft.description.trim() || 'Selective item', amount: amountValue, memberIds: [...draft.memberIds], mode: draft.mode, split: draft.mode === 'equal' ? {} : Object.fromEntries(draft.memberIds.map((id) => [id, Math.max(0, Number(draft.split[id]) || 0)])) };
    onChange(draft.id ? items.map((item) => item.id === draft.id ? saved : item) : [...items, saved]);
    setDraft(null);
  };

  return <SheetModal open={open} onClose={onClose} title="Selective items" footer={<div className="grid grid-cols-2 gap-2"><button type="button" onClick={startAdd} className="press rounded-2xl bg-surface-2 py-3.5 text-xs font-bold text-primary">+ Add item</button><PrimaryButton onClick={onClose}>Done</PrimaryButton></div>}>
    {items.length ? <div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{item.description}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.memberIds.map((id) => displayName(group, data, id)).join(', ')} · {item.mode === 'equal' ? 'Equal' : item.mode === 'exact' ? 'Exact' : 'Percentage'}</p></div><p className="tabular text-sm font-extrabold">{money(item.amount, group.currency)}</p><button type="button" onClick={() => editItem(item)} className="press grid size-8 place-items-center rounded-full bg-surface"><Pencil size={13} /></button><button type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))} className="press grid size-8 place-items-center rounded-full bg-surface text-negative"><Trash2 size={13} /></button></div>)}</div> : null}
    {draft ? <div className="mt-3 rounded-3xl border border-primary/20 bg-secondary p-3"><div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2"><div><p className="mb-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Item</p><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Drinks, dessert…" className="min-w-0 w-full rounded-xl border border-border bg-surface px-2.5 py-2.5 text-xs" /></div><div><p className="mb-1 text-right text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Amount</p><input value={draft.amount} onChange={(event) => changeAmount(event.target.value)} inputMode="decimal" placeholder="0" className="tabular w-full rounded-xl border border-border bg-surface px-2 py-2.5 text-right text-xs font-bold" /></div></div><p className="mb-1.5 mt-3 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Split between</p><div className="flex flex-wrap gap-1.5">{group.members.map((member) => { const selected = draft.memberIds.includes(member.id); return <button type="button" key={member.id} onClick={() => toggleMember(member.id)} className={`press rounded-full border px-2.5 py-2 text-[11px] font-bold ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground'}`}>{selected ? '✓ ' : '+ '}{displayName(group, data, member.id)}</button>; })}</div>{draft.memberIds.length < 2 ? <p className="mt-1.5 text-[10px] font-bold text-negative">Select at least two people.</p> : null}<p className="mb-1.5 mt-3 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Split method</p><div className="splitzap-segment grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">{([['equal', 'Equal'], ['exact', 'Exact'], ['percentage', '%']] as const).map(([mode, label]) => <button type="button" key={mode} onClick={() => changeMode(mode)} className={`press rounded-lg py-2 text-[11px] font-bold ${draft.mode === mode ? 'bg-secondary text-primary shadow-sm' : 'text-muted-foreground'}`}>{label}</button>)}</div>{draft.mode !== 'equal' ? <div className="mt-2 space-y-1.5">{draft.memberIds.map((memberId) => <div key={memberId} className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-2"><span className="truncate text-xs font-semibold">{displayName(group, data, memberId)}</span><div className="flex items-center gap-1"><input value={draft.split[memberId] ? String(Number(draft.split[memberId].toFixed(2))) : ''} onChange={(event) => setDraft({ ...draft, split: { ...draft.split, [memberId]: Number(event.target.value.replace(/[^0-9.]/g, '')) || 0 } })} inputMode="decimal" placeholder="0" className="tabular min-w-0 w-full rounded-lg border border-border bg-surface px-2 py-2 text-right text-xs font-bold" />{draft.mode === 'percentage' ? <span className="text-xs font-bold text-muted-foreground">%</span> : null}</div></div>)}<p className={`text-right text-[10px] font-bold ${allocationValid ? 'text-positive' : 'text-negative'}`}>{draft.mode === 'exact' ? `${money(allocationTotal, group.currency)} / ${money(amountValue, group.currency)}` : `${allocationTotal.toFixed(2)}% / 100%`}</p></div> : draft.memberIds.length >= 2 && amountValue > 0 ? <p className="mt-2 text-right text-[10px] font-semibold text-muted-foreground">{money(amountValue / draft.memberIds.length, group.currency)} each</p> : null}<button type="button" onClick={saveDraft} disabled={!draftValid} className="press mt-3 w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40">Save selective item</button></div> : null}
  </SheetModal>;
}

'''
app = once(app, "function AdditionalChargesDialog(", selective_dialog + "function AdditionalChargesDialog(", 'insert selective dialog')

# ---------------- ADD EXPENSE STATE / MATH ----------------
app = once(app, "  const [personalOpen, setPersonalOpen] = useState(false);\n  const [charges, setCharges]", "  const [personalOpen, setPersonalOpen] = useState(false);\n  const [selectiveItems, setSelectiveItems] = useState<SelectiveItem[]>(editing?.selectiveItems ?? []);\n  const [selectiveOpen, setSelectiveOpen] = useState(false);\n  const [charges, setCharges]", 'selective state')
app = once(app, "  const personalTotal = personalItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);\n  const sharedTotal = Math.max(0, baseTotal - personalTotal);\n  const personalOver = personalTotal - baseTotal;", "  const personalTotal = personalItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);\n  const selectiveTotal = selectiveItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);\n  const sharedTotal = Math.max(0, baseTotal - personalTotal - selectiveTotal);\n  const personalOver = personalTotal + selectiveTotal - baseTotal;", 'selective totals')
app = once(app, "      date: editing?.date ?? new Date().toISOString(), personalItems, additionalCharges:", "      date: editing?.date ?? new Date().toISOString(), personalItems, selectiveItems, additionalCharges:", 'payload selective items')
app = once(app, "setSplit({}); setPersonalItems([]); setCharges([]);", "setSplit({}); setPersonalItems([]); setSelectiveItems([]); setCharges([]);", 'clear selective on group change')
app = once(app, "const personal = personalItems.filter((item) => item.memberId === member.id).reduce((sum, item) => sum + item.amount, 0); const sharedOwed", "const personal = personalItems.filter((item) => item.memberId === member.id).reduce((sum, item) => sum + item.amount, 0); const selective = selectiveItems.reduce((sum, item) => sum + selectiveItemShare(item, member.id), 0); const sharedOwed", 'member selective share')
app = once(app, "const responsibility = sharedOwed + personal;", "const responsibility = sharedOwed + personal + selective;", 'member responsibility selective')
app = once(app, "{personal > 0 ? <span className=\"text-[10px] font-bold text-primary\">+ {money(personal, group.currency)} personal</span> : null}{coPayerPaid", "{personal > 0 ? <span className=\"text-[10px] font-bold text-primary\">+ {money(personal, group.currency)} personal</span> : null}{selective > 0 ? <span className=\"block text-[10px] font-bold text-primary\">+ {money(selective, group.currency)} selective</span> : null}{coPayerPaid", 'member selective label')
app = once(app, "`Personal items exceed the expense by ${money(personalOver, group?.currency)}`", "`Personal + selective items exceed the expense by ${money(personalOver, group?.currency)}`", 'allocation overflow message')

old_cards = '''<div className="mb-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setPersonalOpen(true)} className={`press rounded-2xl border px-3 py-3 text-left ${personalItems.length ? 'border-primary/20 bg-secondary' : 'border-border bg-surface-2'}`}><p className="text-xs font-extrabold text-foreground">👤 {personalItems.length ? `Personal items · ${personalItems.length}` : 'Personal item'}</p><p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{personalItems.length ? `${money(personalTotal, group?.currency)} · Edit` : 'Optional · Add'}</p></button><button type="button" onClick={() => { if (!charges.length) setCharges([{ id: uid(), description: '', amount: 0, distribution: 'equal' }]); setChargesOpen(true); }} className={`press rounded-2xl border px-3 py-3 text-left ${charges.length ? 'border-primary/20 bg-secondary' : 'border-border bg-surface-2'}`}><p className="text-xs font-extrabold text-foreground">🧾 {charges.length ? `Additional charges · ${charges.length}` : 'Additional charge'}</p><p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{charges.length ? `${money(chargeTotal, group?.currency)} · Edit` : 'Tax, service, tip · Add'}</p></button></div>'''
new_cards = '''<div className="mb-2 grid grid-cols-3 gap-2"><button type="button" onClick={() => setPersonalOpen(true)} className={`press rounded-2xl border px-2 py-3 text-left ${personalItems.length ? 'border-primary/20 bg-secondary' : 'border-border bg-surface-2'}`}><p className="text-[11px] font-extrabold text-foreground">👤 Personal</p><p className="mt-0.5 truncate text-[9px] font-semibold text-muted-foreground">{personalItems.length ? `${personalItems.length} · ${money(personalTotal, group?.currency)}` : 'Optional'}</p></button><button type="button" onClick={() => setSelectiveOpen(true)} className={`press rounded-2xl border px-2 py-3 text-left ${selectiveItems.length ? 'border-primary/20 bg-secondary' : 'border-border bg-surface-2'}`}><p className="text-[11px] font-extrabold text-foreground">👥 Selective</p><p className="mt-0.5 truncate text-[9px] font-semibold text-muted-foreground">{selectiveItems.length ? `${selectiveItems.length} · ${money(selectiveTotal, group?.currency)}` : 'Subset split'}</p></button><button type="button" onClick={() => { if (!charges.length) setCharges([{ id: uid(), description: '', amount: 0, distribution: 'equal' }]); setChargesOpen(true); }} className={`press rounded-2xl border px-2 py-3 text-left ${charges.length ? 'border-primary/20 bg-secondary' : 'border-border bg-surface-2'}`}><p className="text-[11px] font-extrabold text-foreground">🧾 Charges</p><p className="mt-0.5 truncate text-[9px] font-semibold text-muted-foreground">{charges.length ? `${charges.length} · ${money(chargeTotal, group?.currency)}` : 'Tax, service'}</p></button></div>'''
app = once(app, old_cards, new_cards, 'advanced cards')
app = once(app, "{group ? <PersonalItemsDialog open={personalOpen}", "{group ? <PersonalItemsDialog open={personalOpen}", 'personal dialog anchor')
app = once(app, "</>;<\n", "</>;<\n", 'noop placeholder') if False else app
# Mount selective dialog directly after PersonalItemsDialog.
mount_old = "{group ? <PersonalItemsDialog open={personalOpen} onClose={() => setPersonalOpen(false)} items={personalItems} onChange={setPersonalItems} group={group} data={data} /> : null}{group ? <AdditionalChargesDialog"
mount_new = "{group ? <PersonalItemsDialog open={personalOpen} onClose={() => setPersonalOpen(false)} items={personalItems} onChange={setPersonalItems} group={group} data={data} /> : null}{group ? <SelectiveItemsDialog open={selectiveOpen} onClose={() => setSelectiveOpen(false)} items={selectiveItems} onChange={setSelectiveItems} group={group} data={data} /> : null}{group ? <AdditionalChargesDialog"
app = once(app, mount_old, mount_new, 'mount selective dialog')

# ---------------- AUTO GROUP ICON ----------------
auto_icon = """const EMOJIS = ['👥', '🏖️', '🏠', '🍽️', '✈️', '🎓', '🎉', '🚗', '💼'];

const suggestGroupEmoji = (value: string) => {
  const name = value.trim().toLowerCase();
  if (!name) return '👥';
  if (/goa|beach|vacation|holiday|resort|sea|ocean/.test(name)) return '🏖️';
  if (/trip|travel|flight|airport|tour/.test(name)) return '✈️';
  if (/flat|home|house|apartment|rent|roommate/.test(name)) return '🏠';
  if (/dinner|lunch|food|restaurant|cafe|meal|party dinner/.test(name)) return '🍽️';
  if (/birthday|party|celebration|wedding|event/.test(name)) return '🎉';
  if (/college|school|class|study|course/.test(name)) return '🎓';
  if (/car|cab|taxi|drive|road/.test(name)) return '🚗';
  if (/office|work|team|company|business/.test(name)) return '💼';
  return '👥';
};
"""
app = once(app, "const EMOJIS = ['👥', '🏖️', '🏠', '🍽️', '✈️', '🎓', '🎉', '🚗', '💼'];\n", auto_icon, 'auto icon helper')
app = once(app, "  const [emoji, setEmoji] = useState('👥');\n  const [currency", "  const [emoji, setEmoji] = useState('👥');\n  const [emojiTouched, setEmojiTouched] = useState(false);\n  const [currency", 'emoji touched state')
app = once(app, "<input value={name} onChange={(event) => setName(event.target.value)} placeholder=\"Trip, apartment, dinner crew…\" className={inputClass} />", "<input value={name} onChange={(event) => { const next = event.target.value; setName(next); if (!emojiTouched) setEmoji(suggestGroupEmoji(next)); }} placeholder=\"Trip, apartment, dinner crew…\" className={inputClass} />", 'auto icon group name')
app = once(app, "onClick={() => setEmoji(item)} className={`emoji-choice", "onClick={() => { setEmoji(item); setEmojiTouched(true); }} className={`emoji-choice", 'manual icon override')
app = once(app, "setName(''); setEmoji('👥'); setPeople(['']);", "setName(''); setEmoji('👥'); setEmojiTouched(false); setPeople(['']);", 'reset auto icon')

# Add subtle auto hint to new group Icon label area.
app = once(app, '<Field label="Icon"><div className="flex flex-wrap gap-2">', '<Field label="Icon"><p className="mb-2 text-[10px] font-semibold text-muted-foreground">Auto-selected from the group name · tap any icon to override.</p><div className="flex flex-wrap gap-2">', 'auto icon hint')

app_path.write_text(app)
store_path.write_text(store)
print('Selective items + auto group icon patch applied')
