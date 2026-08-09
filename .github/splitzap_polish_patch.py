from pathlib import Path

path = Path('src/features/splitzap/SplitzapAppV4.tsx')
s = path.read_text()


def replace_once(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'Missing patch target: {label}')
    s = s.replace(old, new, 1)

# Add validation-attempt state.
replace_once(
    "  const [savedExpense, setSavedExpense] = useState<Expense | null>(null);\n  const [shareOpen, setShareOpen] = useState(false);",
    "  const [savedExpense, setSavedExpense] = useState<Expense | null>(null);\n  const [shareOpen, setShareOpen] = useState(false);\n  const [submitAttempted, setSubmitAttempted] = useState(false);",
    'submitAttempted state',
)

# Make split section validation explicit, including equal mode with nobody selected.
replace_once(
    "  const splitValid = mode === 'exact' ? Math.abs(exactRemaining) < 0.01 : mode === 'percentage' ? Math.abs(percentageRemaining) < 0.01 : true;\n  const valid = !!group && description.trim().length > 0 && baseTotal > 0 && personalOver <= 0.009 && (!hasSharedAmount || hasSharedPeople) && splitValid && payerValid;",
    "  const splitValid = mode === 'exact' ? Math.abs(exactRemaining) < 0.01 : mode === 'percentage' ? Math.abs(percentageRemaining) < 0.01 : true;\n  const splitSectionValid = splitValid && (!hasSharedAmount || hasSharedPeople);\n  const valid = !!group && description.trim().length > 0 && baseTotal > 0 && personalOver <= 0.009 && splitSectionValid && payerValid;",
    'split section validation',
)

# No longer render the automatic-primary-payer helper below Paid by, so remove unused local amount.
replace_once(
    "  const primaryPaidAmount = Math.max(0, grandTotal - otherPaidTotal);\n",
    "",
    'remove primaryPaidAmount helper',
)

# Clicking Add Expense must validate instead of being blocked silently.
replace_once(
    "  const save = () => {\n    if (!group || !valid) return;",
    "  const save = () => {\n    setSubmitAttempted(true);\n    if (!group || !valid) return;",
    'save validation trigger',
)
replace_once(
    "footer={<PrimaryButton onClick={save} disabled={!valid}>{editing ? 'Save changes' : 'Add expense'}</PrimaryButton>}",
    "footer={<PrimaryButton onClick={save}>{editing ? 'Save changes' : 'Add expense'}</PrimaryButton>}",
    'enable add expense validation click',
)

# Description field-level validation.
replace_once(
    '<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Dinner, cab…" className={inputClass} />',
    '<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Dinner, cab…" aria-invalid={submitAttempted && !description.trim()} className={`${inputClass} ${submitAttempted && !description.trim() ? \'border-negative ring-2 ring-negative/15\' : \'\'}`} />{submitAttempted && !description.trim() ? <p className="mt-1 text-[11px] font-bold text-negative">Enter a description.</p> : null}',
    'description validation',
)

# Amount field-level validation.
replace_once(
    '<input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, \'\'))} placeholder="0" className={`${inputClass} tabular text-right font-bold`} />',
    '<input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, \'\'))} placeholder="0" aria-invalid={submitAttempted && baseTotal <= 0} className={`${inputClass} tabular text-right font-bold ${submitAttempted && baseTotal <= 0 ? \'border-negative ring-2 ring-negative/15\' : \'\'}`} />{submitAttempted && baseTotal <= 0 ? <p className="mt-1 text-right text-[11px] font-bold text-negative">Enter an amount.</p> : null}',
    'amount validation',
)

# Remove the automatic-primary-payer helper after the Paid by control.
replace_once(
    "</div>{multiPayer ? <p className=\"mt-2 text-[11px] font-semibold text-muted-foreground\">{displayName(group, data, paidBy)} pays the remaining {money(primaryPaidAmount, group.currency)} automatically.</p> : null}</Field>",
    "</div></Field>",
    'paid by automatic helper',
)

# Highlight split field after a failed submit.
replace_once(
    '<Field label={`Split shared amount · ${money(sharedTotal, group?.currency)}`}><div className="splitzap-segment mb-2 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">',
    '<Field label={`Split shared amount · ${money(sharedTotal, group?.currency)}`}><div className={`splitzap-segment mb-2 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 ${submitAttempted && !splitSectionValid ? \'ring-2 ring-negative/25\' : \'\'}`}>',
    'split highlight',
)
replace_once(
    "${splitValid && personalOver <= 0.009 && payerValid ? 'bg-secondary text-primary' : 'bg-surface-2 text-negative'}",
    "${splitSectionValid && personalOver <= 0.009 && payerValid ? 'bg-secondary text-primary' : 'bg-surface-2 text-negative'}",
    'assignment status wrapper',
)
replace_once(
    "${splitValid && personalOver <= 0.009 && payerValid ? 'bg-primary text-primary-foreground' : 'bg-surface text-negative'}",
    "${splitSectionValid && personalOver <= 0.009 && payerValid ? 'bg-primary text-primary-foreground' : 'bg-surface text-negative'}",
    'assignment status icon wrapper',
)
replace_once(
    "{splitValid && personalOver <= 0.009 && payerValid ? <Check size={13} /> : '!'}",
    "{splitSectionValid && personalOver <= 0.009 && payerValid ? <Check size={13} /> : '!'}",
    'assignment status icon',
)
replace_once(
    "<span>{personalOver > 0.009 ? `Personal items exceed the expense by ${money(personalOver, group?.currency)}` : !payerValid ? 'Check payer amounts' : splitValid ? 'Fully assigned' : mode === 'percentage' ? `${Math.abs(percentageRemaining).toFixed(2)}% left to fix` : `${money(Math.abs(exactRemaining), group?.currency)} left to fix`}</span>",
    "<span>{personalOver > 0.009 ? `Personal items exceed the expense by ${money(personalOver, group?.currency)}` : !payerValid ? 'Check payer amounts' : hasSharedAmount && !hasSharedPeople ? 'Select at least one person to split with' : splitValid ? 'Fully assigned' : mode === 'percentage' ? `${Math.abs(percentageRemaining).toFixed(2)}% left to fix` : `${money(Math.abs(exactRemaining), group?.currency)} left to fix`}</span>",
    'assignment status message',
)

# Additional Charges opens with one blank editable row and descriptive placeholder.
replace_once(
    'onClick={() => setChargesOpen(true)} className={`press rounded-2xl border px-3 py-3 text-left ${charges.length ?',
    "onClick={() => { if (!charges.length) setCharges([{ id: uid(), description: '', amount: 0, distribution: 'equal' }]); setChargesOpen(true); }} className={`press rounded-2xl border px-3 py-3 text-left ${charges.length ?",
    'open charges with blank row',
)
replace_once(
    "  const add = () => onChange([...charges, { id: uid(), description: 'Tax', amount: 0, distribution: 'equal' }]);",
    "  const add = () => onChange([...charges, { id: uid(), description: '', amount: 0, distribution: 'equal' }]);",
    'blank additional charge row',
)
replace_once(
    'placeholder="GST" className="min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-xs"',
    'placeholder="Tax, service…" className="min-w-0 rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-xs"',
    'additional charge placeholder',
)

# Multiple-payer helper copy cleanup.
replace_once(
    '<p className="text-[11px] text-muted-foreground">Primary payer · automatically pays the remaining amount</p>',
    '<p className="text-[11px] text-muted-foreground">Primary payer</p>',
    'primary payer subtitle',
)
replace_once(
    '<div className="mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-xs font-semibold text-muted-foreground">Others paid {money(otherTotal, group.currency)} · {displayName(group, data, primaryPayerId)} automatically pays {money(primaryAmount, group.currency)}</div>',
    '',
    'multiple payer bottom helper',
)

# Better success state for saved/updated expense.
replace_once(
    '<p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">All balanced</p>',
    '<p className="mt-3 text-sm font-extrabold text-primary">{editing ? \'Expense updated\' : \'Expense saved\'}</p><p className="mt-1 text-xs text-muted-foreground">Balances and settlements are updated instantly.</p>',
    'expense success state',
)

# Better group-expense empty state with direct action.
replace_once(
    '<div className="card-soft empty-state p-8 text-center"><p className="text-4xl">🧾</p><p className="mt-2 font-bold">No expenses yet</p><p className="mt-1 text-sm text-muted-foreground">Tap the + button to add the first one.</p></div>',
    '<div className="card-soft empty-state overflow-hidden p-7 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-2xl">🧾</div><p className="mt-3 text-base font-extrabold">Start your first split</p><p className="mx-auto mt-1 max-w-[260px] text-xs leading-5 text-muted-foreground">Add an expense and Splitzap will calculate everyone\'s share automatically.</p><button type="button" onClick={() => setAddOpen(true)} className="press mt-4 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"><Plus size={13} className="mr-1 inline" /> Add first expense</button></div>',
    'group empty state',
)

# Better activity empty state.
replace_once(
    '<div className="card-soft empty-state p-8 text-center"><p className="text-4xl">📭</p><p className="mt-3 font-bold">Nothing here yet</p></div>',
    '<div className="card-soft empty-state p-8 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-2xl">📭</div><p className="mt-3 font-extrabold">No activity yet</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Expenses and payments from your groups will appear here.</p></div>',
    'activity empty state',
)

# Better hydration/loading visual for Activity total.
replace_once(
    "{hydrated ? <AnimatedMoney value={monthTotal} /> : '—'}",
    '{hydrated ? <AnimatedMoney value={monthTotal} /> : <span aria-label="Loading" className="inline-block h-7 w-24 animate-pulse rounded-lg bg-surface-2 align-middle" />}',
    'activity loading skeleton',
)

# Better edit-history empty state.
replace_once(
    '<p className="text-sm text-muted-foreground">No edits recorded.</p>',
    '<div className="rounded-3xl bg-surface-2 p-6 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><History size={20} /></div><p className="mt-3 text-sm font-extrabold">No edits yet</p><p className="mt-1 text-xs text-muted-foreground">Changes to this expense will appear here.</p></div>',
    'history empty state',
)

path.write_text(s)
print('Splitzap polish patch applied successfully')
