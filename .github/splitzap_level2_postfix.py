from pathlib import Path

path = Path('src/features/splitzap/SplitzapAppV4.tsx')
text = path.read_text()

old = """  const groups = data.groups;
  const initialPayments = editing ? paymentsOf(editing) : {};
  const [groupId, setGroupId] = useState(editing?.groupId ?? seed?.groupId ?? defaultGroupId ?? groups[0]?.id ?? '');"""
new = """  const groups = data.groups;
  const initialPayments = editing ? paymentsOf(editing) : {};
  const startingGroupId = editing?.groupId ?? seed?.groupId ?? defaultGroupId ?? groups[0]?.id ?? '';
  const startingGroup = groups.find((item) => item.id === startingGroupId);
  const [groupId, setGroupId] = useState(startingGroupId);"""
if old not in text: raise SystemExit('missing AddExpense starting group target')
text = text.replace(old, new, 1)

old = """  const [paidBy, setPaidBy] = useState(editing?.paidBy ?? data.me);"""
new = """  const [paidBy, setPaidBy] = useState(editing?.paidBy ?? (startingGroup ? memberIdFor(startingGroup, data) : data.me));"""
if old not in text: raise SystemExit('missing paidBy target')
text = text.replace(old, new, 1)

old = """setPaidBy(nextGroup?.members.find((member) => member.id === data.me)?.id ?? nextGroup?.members[0]?.id ?? data.me);"""
new = """setPaidBy(nextGroup ? memberIdFor(nextGroup, data) : data.me);"""
if old not in text: raise SystemExit('missing group switch payer target')
text = text.replace(old, new, 1)

old = """    const creatorName = data.myName?.trim() || displayName(group, data, data.me);"""
new = """    const creatorName = data.myName?.trim() || displayName(group, data, memberIdFor(group, data));"""
if old not in text: raise SystemExit('missing duplicate creator target')
text = text.replace(old, new, 1)

old = """update((current) => ({ ...current, groups: [{ id: newId, name: name.trim(), emoji: group.emoji, currency: copyCurrency ? group.currency : '₹', members, createdAt: new Date().toISOString() }, ...current.groups], expenses: [...clonedExpenses, ...current.expenses] }));"""
new = """update((current) => ({ ...current, groups: [{ id: newId, name: name.trim(), emoji: group.emoji, currency: copyCurrency ? group.currency : '₹', members, createdAt: new Date().toISOString(), myMemberId: copyMembers ? memberIdFor(group, data) : undefined }, ...current.groups], expenses: [...clonedExpenses, ...current.expenses] }));"""
if old not in text: raise SystemExit('missing duplicate group target')
text = text.replace(old, new, 1)

path.write_text(text)

# Add a regression test for account-to-member mapping in shared groups.
path = Path('src/features/splitzap/splitStoreV4.test.ts')
text = path.read_text()
if 'memberIdFor,' not in text:
    text = text.replace('  groupBalances,\n', '  groupBalances,\n  memberIdFor,\n', 1)
needle = """describe('Splitzap calculation regression suite', () => {
"""
test = """describe('Splitzap calculation regression suite', () => {
  it('maps a signed-in account to its canonical member inside a shared group', () => {
    const sharedGroup: Group = { ...group, sharedId: 'shared-1', sharedRole: 'member', myMemberId: 'c' };
    expect(memberIdFor(sharedGroup, { me: 'device-user-id' })).toBe('c');
    expect(memberIdFor(group, { me: 'a' })).toBe('a');
  });

"""
if needle not in text: raise SystemExit('missing test suite target')
text = text.replace(needle, test, 1)
path.write_text(text)
