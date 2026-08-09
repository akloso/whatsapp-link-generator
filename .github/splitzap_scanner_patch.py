from pathlib import Path

app_path = Path('src/features/splitzap/SplitzapAppV4.tsx')
store_path = Path('src/features/splitzap/splitStoreV4.ts')
app = app_path.read_text()
store = store_path.read_text()


def app_replace(old: str, new: str, label: str):
    global app
    if old not in app:
        raise SystemExit(f'Missing app patch target: {label}')
    app = app.replace(old, new, 1)


def store_replace(old: str, new: str, label: str):
    global store
    if old not in store:
        raise SystemExit(f'Missing store patch target: {label}')
    store = store.replace(old, new, 1)

# Icons for scanner UI.
app_replace(
    "  BarChart3,\n  Check,",
    "  BarChart3,\n  Camera,\n  Check,",
    'camera import',
)
app_replace(
    "  Home,\n  MessageCircle,",
    "  Home,\n  ImagePlus,\n  Loader2,\n  MessageCircle,",
    'scanner helper imports',
)

# Receipt item type from store.
app_replace(
    "  type PersonalItem,\n  type SplitData,",
    "  type PersonalItem,\n  type ReceiptItem,\n  type SplitData,",
    'ReceiptItem type import',
)

# Scanner seed type.
app_replace(
    "type PersonalDraft = { id?: string; memberId: string; description: string; amount: string };",
    "type PersonalDraft = { id?: string; memberId: string; description: string; amount: string };\ntype ScanExpenseSeed = { groupId: string; description: string; amount: number; personalItems: PersonalItem[]; additionalCharges: AdditionalCharge[]; receiptItems: ReceiptItem[] };\ntype ParsedReceipt = { merchant: string; detectedTotal: number | null; items: ReceiptItem[]; charges: AdditionalCharge[] };",
    'scanner types',
)

# Home scanner state.
app_replace(
    "  const [groupOpen, setGroupOpen] = useState(false);\n  const [showIntro, setShowIntro] = useState(false);",
    "  const [groupOpen, setGroupOpen] = useState(false);\n  const [scannerOpen, setScannerOpen] = useState(false);\n  const [scanSeed, setScanSeed] = useState<ScanExpenseSeed | null>(null);\n  const [showIntro, setShowIntro] = useState(false);",
    'home scanner state',
)

# Scanner icon immediately before + Group.
old_header = "right={<button type=\"button\" onClick={() => setGroupOpen(true)} className=\"press flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground\"><Plus size={14} /> Group</button>}"
new_header = "right={<div className=\"flex items-center gap-1.5\"><button type=\"button\" onClick={() => data.groups.length ? setScannerOpen(true) : setGroupOpen(true)} aria-label=\"Scan a bill\" title=\"Scan bill\" className=\"press grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm\"><Camera size={16} /></button><button type=\"button\" onClick={() => setGroupOpen(true)} className=\"press flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground\"><Plus size={14} /> Group</button></div>}"
app_replace(old_header, new_header, 'home scanner button')

# Scanner -> seeded Add Expense flow.
old_home_tail = "{data.groups.length ? <AddExpenseSheet open={addOpen} onClose={() => setAddOpen(false)} data={data} update={update} /> : null}<NewGroupSheet open={groupOpen} onClose={() => setGroupOpen(false)} data={data} update={update} onCreated={(groupId) => navigate({ name: 'group', groupId })} /></AppShell>;"
new_home_tail = "{data.groups.length ? <AddExpenseSheet open={addOpen} onClose={() => { setAddOpen(false); setScanSeed(null); }} data={data} update={update} seed={scanSeed} /> : null}<ReceiptScanner open={scannerOpen} onClose={() => setScannerOpen(false)} data={data} onUse={(seed) => { setScanSeed(seed); setScannerOpen(false); setAddOpen(true); }} /><NewGroupSheet open={groupOpen} onClose={() => setGroupOpen(false)} data={data} update={update} onCreated={(groupId) => navigate({ name: 'group', groupId })} /></AppShell>;"
app_replace(old_home_tail, new_home_tail, 'home scanner integration')

# AddExpense supports scanner seed.
app_replace(
    "function AddExpenseSheet({ open, onClose, data, update, defaultGroupId, editing }: { open: boolean; onClose: () => void; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; defaultGroupId?: string; editing?: Expense | null }) {",
    "function AddExpenseSheet({ open, onClose, data, update, defaultGroupId, editing, seed }: { open: boolean; onClose: () => void; data: SplitData; update: (fn: (data: SplitData) => SplitData) => void; defaultGroupId?: string; editing?: Expense | null; seed?: ScanExpenseSeed | null }) {",
    'AddExpense seed signature',
)
app_replace(
    "  const [groupId, setGroupId] = useState(editing?.groupId ?? defaultGroupId ?? groups[0]?.id ?? '');\n  const [description, setDescription] = useState(editing?.description ?? '');\n  const [amount, setAmount] = useState(editing ? String(baseAmountOf(editing)) : '');",
    "  const [groupId, setGroupId] = useState(editing?.groupId ?? seed?.groupId ?? defaultGroupId ?? groups[0]?.id ?? '');\n  const [description, setDescription] = useState(editing?.description ?? seed?.description ?? '');\n  const [amount, setAmount] = useState(editing ? String(baseAmountOf(editing)) : seed ? String(seed.amount) : '');",
    'seed core fields',
)
app_replace(
    "  const [personalItems, setPersonalItems] = useState<PersonalItem[]>(editing?.personalItems ?? []);\n  const [personalOpen, setPersonalOpen] = useState(false);\n  const [charges, setCharges] = useState<AdditionalCharge[]>(editing?.additionalCharges ?? []);",
    "  const [personalItems, setPersonalItems] = useState<PersonalItem[]>(editing?.personalItems ?? seed?.personalItems ?? []);\n  const [personalOpen, setPersonalOpen] = useState(false);\n  const [charges, setCharges] = useState<AdditionalCharge[]>(editing?.additionalCharges ?? seed?.additionalCharges ?? []);\n  const [receiptItems] = useState<ReceiptItem[]>(editing?.receiptItems ?? seed?.receiptItems ?? []);",
    'seed advanced fields',
)
app_replace(
    "      date: editing?.date ?? new Date().toISOString(), personalItems, additionalCharges: charges.filter((charge) => charge.amount > 0).map((charge) => ({ ...charge, description: charge.description.trim() || 'Charge' })),",
    "      date: editing?.date ?? new Date().toISOString(), personalItems, additionalCharges: charges.filter((charge) => charge.amount > 0).map((charge) => ({ ...charge, description: charge.description.trim() || 'Charge' })), receiptItems,",
    'save receipt items',
)

# Track itemized bill changes in local edit history.
app_replace(
    "  if (JSON.stringify(before.additionalCharges ?? []) !== JSON.stringify(after.additionalCharges ?? [])) add('Additional charges', 'Previous charges', 'Updated charges');\n  if (JSON.stringify(before.splitLabels ?? {}) !== JSON.stringify(after.splitLabels ?? {})) add('Labels', 'Previous labels', 'Updated labels');",
    "  if (JSON.stringify(before.additionalCharges ?? []) !== JSON.stringify(after.additionalCharges ?? [])) add('Additional charges', 'Previous charges', 'Updated charges');\n  if (JSON.stringify(before.receiptItems ?? []) !== JSON.stringify(after.receiptItems ?? [])) add('Scanned bill items', 'Previous items', 'Updated items');\n  if (JSON.stringify(before.splitLabels ?? {}) !== JSON.stringify(after.splitLabels ?? {})) add('Labels', 'Previous labels', 'Updated labels');",
    'receipt history',
)

# Personal Items opens immediately with an editable blank row when empty.
app_replace(
    "  const [draft, setDraft] = useState<PersonalDraft | null>(null);\n  const startAdd = () => { if (!draft) setDraft({ memberId: group.members[0]?.id ?? data.me, description: '', amount: '' }); };",
    "  const [draft, setDraft] = useState<PersonalDraft | null>(null);\n  useEffect(() => { if (open && !items.length) setDraft((current) => current ?? { memberId: group.members[0]?.id ?? data.me, description: '', amount: '' }); }, [open, items.length, group.members, data.me]);\n  const startAdd = () => { if (!draft) setDraft({ memberId: group.members[0]?.id ?? data.me, description: '', amount: '' }); };",
    'personal default row',
)

old_personal_draft = "{draft ? <div className=\"mt-3 rounded-3xl border border-primary/20 bg-secondary p-3\"><div className=\"grid gap-2\"><select value={draft.memberId} onChange={(event) => setDraft({ ...draft, memberId: event.target.value })} className={`${inputClass} py-2.5 text-sm`}>{group.members.map((member) => <option key={member.id} value={member.id}>{displayName(group, data, member.id)}</option>)}</select><div className=\"grid grid-cols-[1.3fr_.7fr] gap-2\"><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder=\"Beer, dessert…\" className={`${inputClass} py-2.5 text-sm`} /><input value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value.replace(/[^0-9.]/g, '') })} inputMode=\"decimal\" placeholder=\"0\" className={`${inputClass} tabular py-2.5 text-right text-sm font-bold`} /></div><button type=\"button\" disabled={!(Number(draft.amount) > 0)} onClick={saveDraft} className=\"press rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40\">Save item</button></div></div> : null}"
new_personal_draft = "{draft ? <div className=\"mt-3 rounded-3xl border border-primary/20 bg-secondary p-3\"><div className=\"grid grid-cols-[92px_minmax(0,1fr)_76px] gap-1.5 px-1 pb-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground\"><span>Person</span><span>Item</span><span className=\"text-right\">Amount</span></div><div className=\"grid grid-cols-[92px_minmax(0,1fr)_76px] gap-1.5\"><select value={draft.memberId} onChange={(event) => setDraft({ ...draft, memberId: event.target.value })} className=\"min-w-0 rounded-xl border border-border bg-surface px-1.5 py-2.5 text-[10px] font-semibold\">{group.members.map((member) => <option key={member.id} value={member.id}>{displayName(group, data, member.id)}</option>)}</select><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder=\"Beer, dessert…\" className=\"min-w-0 rounded-xl border border-border bg-surface px-2 py-2.5 text-xs\" /><input value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value.replace(/[^0-9.]/g, '') })} inputMode=\"decimal\" placeholder=\"0\" className=\"tabular min-w-0 rounded-xl border border-border bg-surface px-2 py-2.5 text-right text-xs font-bold\" /></div><button type=\"button\" disabled={!(Number(draft.amount) > 0)} onClick={saveDraft} className=\"press mt-2 w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40\">Save item</button></div> : null}"
app_replace(old_personal_draft, new_personal_draft, 'personal compact blank row')

# Fix Additional Charges Split label alignment exactly above dropdown.
app_replace(
    '<span>Item</span><span className="text-right">Amount</span><span>Split</span><span />',
    '<span>Item</span><span className="text-right">Amount</span><span className="text-center">Split</span><span />',
    'charge split header alignment',
)
app_replace(
    'className="min-w-0 rounded-xl border border-border bg-surface-2 px-1.5 py-2.5 text-[10px] font-semibold"><option value="equal">Equal</option>',
    'className="min-w-0 rounded-xl border border-border bg-surface-2 px-1.5 py-2.5 text-center text-[10px] font-semibold"><option value="equal">Equal</option>',
    'charge split dropdown alignment',
)

# Persist itemized receipt items in expense model.
store_replace(
    "export type AdditionalCharge = {\n  id: string;\n  description: string;\n  amount: number;\n  distribution: ChargeDistribution;\n};",
    "export type AdditionalCharge = {\n  id: string;\n  description: string;\n  amount: number;\n  distribution: ChargeDistribution;\n};\n\nexport type ReceiptItem = {\n  id: string;\n  description: string;\n  amount: number;\n  /** Empty/undefined means shared by the group; a member id means personal to that member. */\n  memberId?: string;\n};",
    'ReceiptItem type',
)
store_replace(
    "  personalItems?: PersonalItem[];\n  additionalCharges?: AdditionalCharge[];",
    "  personalItems?: PersonalItem[];\n  additionalCharges?: AdditionalCharge[];\n  receiptItems?: ReceiptItem[];",
    'Expense receiptItems property',
)
store_replace(
    "  const chargeTotal = normalizedCharges.reduce((sum, charge) => sum + charge.amount, 0);",
    "  const receiptItems: ReceiptItem[] = (Array.isArray(raw.receiptItems) ? raw.receiptItems : [])\n    .map(recordOf)\n    .map((item) => ({\n      id: typeof item.id === 'string' && item.id ? item.id : uid(),\n      description: typeof item.description === 'string' && item.description.trim() ? item.description.trim() : 'Bill item',\n      amount: Math.max(0, Number(item.amount) || 0),\n      memberId: typeof item.memberId === 'string' && item.memberId ? item.memberId : undefined,\n    }))\n    .filter((item) => item.amount > 0);\n  const chargeTotal = normalizedCharges.reduce((sum, charge) => sum + charge.amount, 0);",
    'normalize receipt items',
)
store_replace(
    "    personalItems,\n    additionalCharges: normalizedCharges,",
    "    personalItems,\n    additionalCharges: normalizedCharges,\n    receiptItems,",
    'normalized expense receipt items',
)

# Itemized bill appears in result, while avoiding duplicate personal-item details.
app_replace(
    "    const personalItems = (expense.personalItems ?? []).filter((item) => item.memberId === member.id);",
    "    const personalItems = (expense.receiptItems?.length ? [] : expense.personalItems ?? []).filter((item) => item.memberId === member.id);",
    'avoid duplicate scanner personal details',
)
app_replace(
    "  const historyCount = (data.history ?? []).filter((entry) => entry.expenseId === expense.id).length;\n  return <div className=\"space-y-3\"><div className=\"result-total",
    "  const historyCount = (data.history ?? []).filter((entry) => entry.expenseId === expense.id).length;\n  const receiptItems = expense.receiptItems ?? [];\n  return <div className=\"space-y-3\"><div className=\"result-total",
    'result receipt items local',
)
app_replace(
    "</p></div><div className=\"result-section rounded-3xl border border-border bg-surface p-4\"><p className=\"text-sm font-extrabold\">Settlement</p>",
    "</p></div>{receiptItems.length ? <div className=\"result-section rounded-3xl border border-border bg-surface p-4\"><div className=\"flex items-center justify-between\"><p className=\"text-sm font-extrabold\">Scanned bill items</p><span className=\"rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-primary\">{receiptItems.length} items</span></div><div className=\"mt-3 space-y-1.5\">{receiptItems.map((item) => <div key={item.id} className=\"grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl bg-surface-2 px-3 py-2.5\"><div className=\"min-w-0\"><p className=\"truncate text-xs font-bold\">{item.description}</p><p className=\"mt-0.5 text-[10px] text-muted-foreground\">{item.memberId ? displayName(group, data, item.memberId) : 'Shared'}</p></div><span className=\"tabular text-xs font-extrabold\">{shareMoney(item.amount, group.currency)}</span></div>)}</div></div> : null}<div className=\"result-section rounded-3xl border border-border bg-surface p-4\"><p className=\"text-sm font-extrabold\">Settlement</p>",
    'result scanned bill section',
)

# WhatsApp expense share gets reviewed bill items.
app_replace(
    "  const chargeLine = (expense.additionalCharges ?? []).filter((charge) => charge.amount > 0).map((charge) => `${charge.description} ${shareMoney(charge.amount, group.currency)}`).join(' · ');\n  const lines = ['*💸 Splitzap*', `*${expense.description} · ${shareMoney(expense.amount, group.currency)}*`];",
    "  const chargeLine = (expense.additionalCharges ?? []).filter((charge) => charge.amount > 0).map((charge) => `${charge.description} ${shareMoney(charge.amount, group.currency)}`).join(' · ');\n  const receiptLines = (expense.receiptItems ?? []).map((item) => `• ${item.description} — ${shareMoney(item.amount, group.currency)}${item.memberId ? ` · ${displayName(group, data, item.memberId)}` : ' · Shared'}`);\n  const lines = ['*💸 Splitzap*', `*${expense.description} · ${shareMoney(expense.amount, group.currency)}*`];",
    'share receipt lines local',
)
app_replace(
    "  lines.push(`Paid by: ${payerSummary(expense, group, data, true)}`, '', '*Settlement*', ...settlementLines);\n  if (detailLines.length) lines.push('', '*Details*', ...detailLines);",
    "  lines.push(`Paid by: ${payerSummary(expense, group, data, true)}`);\n  if (receiptLines.length) lines.push('', '*Bill items*', ...receiptLines);\n  lines.push('', '*Settlement*', ...settlementLines);\n  if (detailLines.length) lines.push('', '*Details*', ...detailLines);",
    'share receipt items output',
)

# Browser-only receipt scanner helpers and UI.
scanner_code = r'''

function receiptAmount(raw: string) {
  const clean = raw.replace(/[,\s]/g, '').replace(/[^0-9.-]/g, '');
  const value = Number(clean);
  return Number.isFinite(value) ? value : 0;
}

function parseReceiptText(text: string): ParsedReceipt {
  const rawLines = text.split(/\r?\n/).map((line) => line.replace(/[|]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const totalPattern = /\b(grand\s*total|net\s*total|total\s*amount|amount\s*(due|payable)|payable\s*amount|total)\b/i;
  const subTotalPattern = /\b(sub\s*total|subtotal)\b/i;
  const chargePattern = /\b(cgst|sgst|igst|gst|vat|tax|cess|service\s*(charge|fee)|tip|packing\s*(charge|fee)|delivery\s*(charge|fee))\b/i;
  const discountPattern = /\b(discount|coupon|saving|savings|promo)\b/i;
  const headerPattern = /\b(qty|quantity|rate|price|amount|description|item)\b/i;
  const pricePattern = /(?:₹|rs\.?|inr)?\s*(-?\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/i;
  let detectedTotal: number | null = null;
  const items: ReceiptItem[] = [];
  const charges: AdditionalCharge[] = [];

  const merchant = rawLines.find((line) => /[a-z]{3}/i.test(line) && !pricePattern.test(line) && line.length <= 70 && !/invoice|receipt|tax\s*invoice|phone|gstin|date|time/i.test(line))?.slice(0, 60) ?? 'Scanned bill';

  rawLines.forEach((line) => {
    const match = line.match(pricePattern);
    if (!match || match.index == null) return;
    const amount = receiptAmount(match[1] ?? '');
    if (amount <= 0 || amount > 10000000) return;
    const description = line.slice(0, match.index).replace(/[.:\-–—]+$/g, '').trim();
    if (!description) return;
    if (subTotalPattern.test(description)) return;
    if (totalPattern.test(description)) { detectedTotal = amount; return; }
    if (discountPattern.test(description)) return;
    if (headerPattern.test(description) && description.split(' ').length <= 3) return;
    if (chargePattern.test(description)) {
      charges.push({ id: uid(), description, amount, distribution: 'equal' });
      return;
    }
    items.push({ id: uid(), description, amount });
  });

  if (!items.length && detectedTotal && detectedTotal > 0) items.push({ id: uid(), description: 'Bill total', amount: detectedTotal });
  return { merchant, detectedTotal, items, charges };
}

async function preprocessReceiptImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not read this image.')); image.src = url; });
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const targetWidth = Math.min(1800, Math.max(1200, sourceWidth));
    const scale = targetWidth / sourceWidth;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = pixels.data[index]! * 0.299 + pixels.data[index + 1]! * 0.587 + pixels.data[index + 2]! * 0.114;
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.28 + 128));
      pixels.data[index] = contrasted;
      pixels.data[index + 1] = contrasted;
      pixels.data[index + 2] = contrasted;
    }
    context.putImageData(pixels, 0, 0);
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.94));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ReceiptScanner({ open, onClose, data, onUse }: { open: boolean; onClose: () => void; data: SplitData; onUse: (seed: ScanExpenseSeed) => void }) {
  const [groupId, setGroupId] = useState(data.groups[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'scanning' | 'review' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Preparing image…');
  const [error, setError] = useState('');
  const [merchant, setMerchant] = useState('Scanned bill');
  const [detectedTotal, setDetectedTotal] = useState<number | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);
  const [rawText, setRawText] = useState('');
  const group = data.groups.find((entry) => entry.id === groupId) ?? data.groups[0];
  const baseTotal = items.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const chargeTotal = charges.reduce((sum, charge) => sum + Math.max(0, Number(charge.amount) || 0), 0);
  const reviewedTotal = baseTotal + chargeTotal;
  const mismatch = detectedTotal != null && Math.abs(detectedTotal - reviewedTotal) > 0.05;

  useEffect(() => {
    if (open && !groupId && data.groups[0]) setGroupId(data.groups[0].id);
  }, [open, groupId, data.groups]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const chooseFile = (next: File | null) => {
    if (!next) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setStatus('idle');
    setProgress(0);
    setError('');
    setRawText('');
    setItems([]);
    setCharges([]);
    setDetectedTotal(null);
    setMerchant('Scanned bill');
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(''); setStatus('idle'); setProgress(0); setError(''); setRawText(''); setItems([]); setCharges([]); setDetectedTotal(null); setMerchant('Scanned bill');
  };

  const close = () => { reset(); onClose(); };

  const scan = async () => {
    if (!file) return;
    setStatus('scanning'); setProgress(0.03); setError(''); setProgressLabel('Cleaning up the receipt…');
    let worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>> | null = null;
    try {
      const processed = await preprocessReceiptImage(file);
      setProgress(0.12); setProgressLabel('Loading on-device OCR…');
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('eng', 1, { logger: (message) => {
        if (message.status === 'recognizing text') {
          setProgress(Math.max(0.15, Math.min(0.98, 0.15 + (message.progress ?? 0) * 0.83)));
          setProgressLabel(`Reading bill… ${Math.round((message.progress ?? 0) * 100)}%`);
        }
      } });
      const result = await worker.recognize(processed);
      const text = result.data.text ?? '';
      const parsed = parseReceiptText(text);
      setRawText(text);
      setMerchant(parsed.merchant);
      setDetectedTotal(parsed.detectedTotal);
      setItems(parsed.items);
      setCharges(parsed.charges);
      setProgress(1);
      setStatus('review');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not scan this bill. Try a clearer, straighter photo.');
      setStatus('error');
    } finally {
      await worker?.terminate().catch(() => undefined);
    }
  };

  const changeGroup = (nextId: string) => {
    setGroupId(nextId);
    setItems((current) => current.map((item) => ({ ...item, memberId: undefined })));
  };

  const useBill = () => {
    if (!group || baseTotal <= 0) return;
    const cleanItems = items.filter((item) => item.amount > 0).map((item) => ({ ...item, description: item.description.trim() || 'Bill item' }));
    const receiptIds = new Set(cleanItems.map((item) => item.id));
    const personalItems: PersonalItem[] = cleanItems.filter((item) => item.memberId).map((item) => ({ id: item.id, memberId: item.memberId!, description: item.description, amount: item.amount }));
    const cleanCharges = charges.filter((charge) => charge.amount > 0).map((charge) => ({ ...charge, description: charge.description.trim() || 'Charge' }));
    onUse({ groupId: group.id, description: merchant.trim() || 'Scanned bill', amount: cleanItems.reduce((sum, item) => sum + item.amount, 0), personalItems: personalItems.filter((item) => receiptIds.has(item.id)), additionalCharges: cleanCharges, receiptItems: cleanItems });
    reset();
  };

  if (!open) return null;
  return <SheetModal open={open} onClose={close} title="Scan a bill" footer={status === 'review' ? <div className="grid grid-cols-[.8fr_1.2fr] gap-2"><button type="button" onClick={reset} className="press rounded-2xl bg-surface-2 py-3.5 text-xs font-bold">Scan another</button><PrimaryButton onClick={useBill} disabled={!group || baseTotal <= 0}>Use this bill</PrimaryButton></div> : undefined}>
    {!data.groups.length ? <div className="rounded-3xl bg-surface-2 p-6 text-center"><Camera size={24} className="mx-auto text-primary" /><p className="mt-3 font-extrabold">Create a group first</p><p className="mt-1 text-xs text-muted-foreground">A scanned bill needs a group so items can be shared or assigned.</p></div> : <>
      <Field label="Group"><select value={group?.id ?? ''} onChange={(event) => changeGroup(event.target.value)} className={`${inputClass} py-2.5 text-sm`}>{data.groups.map((entry) => <option key={entry.id} value={entry.id}>{entry.emoji} {entry.name}</option>)}</select></Field>
      {status !== 'review' ? <>
        <div className="grid grid-cols-2 gap-2"><label className="press flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-3 py-3.5 text-xs font-bold text-primary-foreground"><Camera size={16} /> Camera<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label><label className="press flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-secondary px-3 py-3.5 text-xs font-bold text-primary"><ImagePlus size={16} /> Photo library<input type="file" accept="image/*" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} /></label></div>
        {previewUrl ? <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-surface-2"><img src={previewUrl} alt="Receipt preview" className="max-h-72 w-full object-contain" /></div> : <div className="mt-3 rounded-3xl border border-dashed border-border bg-surface-2 p-7 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><Camera size={24} /></div><p className="mt-3 text-sm font-extrabold">Photograph the full receipt</p><p className="mx-auto mt-1 max-w-[290px] text-xs leading-5 text-muted-foreground">Keep it flat, well lit and readable. Splitzap processes the image on this device.</p></div>}
        {status === 'scanning' ? <div className="mt-3 rounded-2xl bg-secondary p-3"><div className="flex items-center gap-2 text-xs font-bold text-primary"><Loader2 size={15} className="animate-spin" /> {progressLabel}</div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(4, progress * 100)}%` }} /></div></div> : null}
        {status === 'error' ? <div className="mt-3 rounded-2xl border border-negative/20 bg-negative/5 p-3 text-xs font-semibold text-negative">{error}</div> : null}
        <button type="button" disabled={!file || status === 'scanning'} onClick={scan} className="press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-40">{status === 'scanning' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {status === 'scanning' ? 'Scanning…' : 'Scan bill'}</button>
      </> : <>
        <div className="rounded-2xl bg-secondary p-3"><p className="text-xs font-extrabold text-primary">Review before adding</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">OCR can make mistakes. Edit anything that does not match the receipt.</p></div>
        <Field label="Expense name"><input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="Restaurant, groceries…" className={inputClass} /></Field>
        <div className="mb-1 grid grid-cols-[minmax(100px,1fr)_76px_108px_28px] gap-1.5 px-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground"><span>Item</span><span className="text-right">Amount</span><span className="text-center">For</span><span /></div>
        <div className="space-y-1.5">{items.map((item) => <div key={item.id} className="grid grid-cols-[minmax(100px,1fr)_76px_108px_28px] items-center gap-1.5"><input value={item.description} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, description: event.target.value } : entry))} placeholder="Item" className="min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-xs" /><input value={item.amount || ''} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, amount: Number(event.target.value.replace(/[^0-9.]/g, '')) || 0 } : entry))} inputMode="decimal" placeholder="0" className="tabular min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-right text-xs font-bold" /><select value={item.memberId ?? ''} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, memberId: event.target.value || undefined } : entry))} className="min-w-0 rounded-xl border border-border bg-surface-2 px-1 py-2.5 text-center text-[10px] font-semibold"><option value="">Shared</option>{group?.members.map((member) => <option key={member.id} value={member.id}>{displayName(group, data, member.id)}</option>)}</select><button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="press grid size-7 place-items-center rounded-full bg-surface-2 text-negative"><X size={12} /></button></div>)}</div>
        <button type="button" onClick={() => setItems((current) => [...current, { id: uid(), description: '', amount: 0 }])} className="press mt-2 w-full rounded-xl border border-dashed border-border bg-surface-2 py-2.5 text-xs font-bold text-primary">+ Add item</button>
        {charges.length ? <div className="mt-4"><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Detected charges</p><div className="grid grid-cols-[minmax(100px,1fr)_82px_106px_28px] gap-1.5 px-1 pb-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground"><span>Item</span><span className="text-right">Amount</span><span className="text-center">Split</span><span /></div><div className="space-y-1.5">{charges.map((charge) => <div key={charge.id} className="grid grid-cols-[minmax(100px,1fr)_82px_106px_28px] items-center gap-1.5"><input value={charge.description} onChange={(event) => setCharges((current) => current.map((entry) => entry.id === charge.id ? { ...entry, description: event.target.value } : entry))} className="min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-xs" /><input value={charge.amount || ''} onChange={(event) => setCharges((current) => current.map((entry) => entry.id === charge.id ? { ...entry, amount: Number(event.target.value.replace(/[^0-9.]/g, '')) || 0 } : entry))} inputMode="decimal" className="tabular min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-right text-xs font-bold" /><select value={charge.distribution} onChange={(event) => setCharges((current) => current.map((entry) => entry.id === charge.id ? { ...entry, distribution: event.target.value === 'proportional' ? 'proportional' : 'equal' } : entry))} className="min-w-0 rounded-xl border border-border bg-surface-2 px-1 py-2.5 text-center text-[10px] font-semibold"><option value="equal">Equal</option><option value="proportional">Proportional</option></select><button type="button" onClick={() => setCharges((current) => current.filter((entry) => entry.id !== charge.id))} className="press grid size-7 place-items-center rounded-full bg-surface-2 text-negative"><X size={12} /></button></div>)}</div></div> : null}
        <div className={`mt-4 rounded-2xl p-3 ${mismatch ? 'border border-amber-300 bg-amber-50' : 'bg-secondary'}`}><div className="flex items-center justify-between text-xs"><span className="font-semibold text-muted-foreground">Reviewed total</span><span className="tabular text-base font-extrabold text-primary">{money(reviewedTotal, group?.currency)}</span></div>{detectedTotal != null ? <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground"><span>Receipt total detected</span><span className="tabular font-bold">{money(detectedTotal, group?.currency)}</span></div> : null}{mismatch ? <p className="mt-2 text-[10px] font-bold text-amber-700">Totals do not match. Review missing items, discounts or OCR mistakes before continuing.</p> : null}</div>
        {rawText ? <details className="mt-3 rounded-2xl bg-surface-2 p-3"><summary className="cursor-pointer text-xs font-bold text-muted-foreground">View raw OCR text</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-muted-foreground">{rawText}</pre></details> : null}
      </>}
    </>}
  </SheetModal>;
}
'''
app_replace("\nfunction PersonalItemsDialog(", scanner_code + "\nfunction PersonalItemsDialog(", 'insert scanner component')

app_path.write_text(app)
store_path.write_text(store)
print('Splitzap scanner patch applied')
