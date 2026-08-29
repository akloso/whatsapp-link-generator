import {
  groupBalances,
  paymentsOf,
  shareOf,
  type Expense,
  type Group,
  type Settlement,
  type SplitData,
} from './splitStoreV4';
import type { SharedGroupSnapshot } from './splitzapShared';

export type SplitzapIntegrityIssue = {
  code: string;
  message: string;
  entityType: 'group' | 'expense' | 'settlement' | 'data';
  entityId?: string;
};

const MONEY_TOLERANCE = 0.02;

const closeMoney = (left: number, right: number) => Math.abs(left - right) <= MONEY_TOLERANCE;
const finiteMoney = (value: unknown) => Number.isFinite(Number(value)) && Number(value) >= 0;

function duplicateIds(ids: string[]) {
  const seen = new Set<string>();
  return [...new Set(ids.filter((id) => {
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  }))];
}

function validateGroupLedger(group: Group, expenses: Expense[], settlements: Settlement[]) {
  const issues: SplitzapIntegrityIssue[] = [];
  const memberIds = group.members.map((member) => member.id);
  const memberSet = new Set(memberIds);

  if (!group.id) issues.push({ code: 'group-id-missing', message: 'A group is missing its permanent ID.', entityType: 'group' });
  if (!group.members.length) issues.push({ code: 'group-members-empty', message: 'A group has no members.', entityType: 'group', entityId: group.id });
  for (const id of duplicateIds(memberIds)) {
    issues.push({ code: 'member-id-duplicate', message: `Member ID ${id} appears more than once.`, entityType: 'group', entityId: group.id });
  }

  for (const expense of expenses) {
    const id = expense.id;
    if (!id) issues.push({ code: 'expense-id-missing', message: 'An expense is missing its permanent ID.', entityType: 'expense' });
    if (expense.groupId !== group.id) issues.push({ code: 'expense-group-mismatch', message: 'An expense points to the wrong group.', entityType: 'expense', entityId: id });
    if (!finiteMoney(expense.amount)) issues.push({ code: 'expense-amount-invalid', message: 'An expense has an invalid amount.', entityType: 'expense', entityId: id });

    const payments = paymentsOf(expense);
    const paymentTotal = Object.values(payments).reduce((sum, amount) => sum + amount, 0);
    for (const payerId of Object.keys(payments)) {
      if (!memberSet.has(payerId)) issues.push({ code: 'expense-payer-unknown', message: 'An expense references a payer who is not in the group.', entityType: 'expense', entityId: id });
    }
    if (finiteMoney(expense.amount) && !closeMoney(paymentTotal, Number(expense.amount))) {
      issues.push({ code: 'expense-payment-total', message: 'Expense payments do not add up to the expense total.', entityType: 'expense', entityId: id });
    }

    for (const splitId of Object.keys(expense.split ?? {})) {
      if (!memberSet.has(splitId)) issues.push({ code: 'expense-split-unknown', message: 'An expense split references someone who is not in the group.', entityType: 'expense', entityId: id });
    }
    for (const item of expense.personalItems ?? []) {
      if (!memberSet.has(item.memberId)) issues.push({ code: 'personal-item-member-unknown', message: 'A personal item references someone who is not in the group.', entityType: 'expense', entityId: id });
    }
    for (const item of expense.selectiveItems ?? []) {
      for (const memberId of item.memberIds) {
        if (!memberSet.has(memberId)) issues.push({ code: 'selective-item-member-unknown', message: 'A selective item references someone who is not in the group.', entityType: 'expense', entityId: id });
      }
    }

    if (finiteMoney(expense.amount) && group.members.length) {
      const shareTotal = memberIds.reduce((sum, memberId) => sum + shareOf(expense, memberId, memberIds), 0);
      if (!closeMoney(shareTotal, Number(expense.amount))) {
        issues.push({ code: 'expense-share-total', message: 'Expense shares do not add up to the expense total.', entityType: 'expense', entityId: id });
      }
    }
  }

  for (const settlement of settlements) {
    const id = settlement.id;
    if (!id) issues.push({ code: 'settlement-id-missing', message: 'A settlement is missing its permanent ID.', entityType: 'settlement' });
    if (settlement.groupId !== group.id) issues.push({ code: 'settlement-group-mismatch', message: 'A settlement points to the wrong group.', entityType: 'settlement', entityId: id });
    if (!Number.isFinite(Number(settlement.amount)) || Number(settlement.amount) <= 0) {
      issues.push({ code: 'settlement-amount-invalid', message: 'A settlement has an invalid amount.', entityType: 'settlement', entityId: id });
    }
    if (!memberSet.has(settlement.from) || !memberSet.has(settlement.to)) {
      issues.push({ code: 'settlement-member-unknown', message: 'A settlement references someone who is not in the group.', entityType: 'settlement', entityId: id });
    }
    if (settlement.from === settlement.to) {
      issues.push({ code: 'settlement-self', message: 'A settlement cannot pay the same person.', entityType: 'settlement', entityId: id });
    }
  }

  if (group.members.length) {
    const net = Object.values(groupBalances(group, expenses, settlements)).reduce((sum, value) => sum + value, 0);
    if (Math.abs(net) > MONEY_TOLERANCE) {
      issues.push({ code: 'group-net-nonzero', message: 'The group ledger is not financially balanced.', entityType: 'group', entityId: group.id });
    }
  }

  return issues;
}

export function inspectSharedSnapshotIntegrity(snapshot: SharedGroupSnapshot) {
  const issues = validateGroupLedger(snapshot.group, snapshot.expenses, snapshot.settlements);
  for (const id of duplicateIds(snapshot.expenses.map((expense) => expense.id))) {
    issues.push({ code: 'expense-id-duplicate', message: `Expense ID ${id} appears more than once.`, entityType: 'expense', entityId: id });
  }
  for (const id of duplicateIds(snapshot.settlements.map((settlement) => settlement.id))) {
    issues.push({ code: 'settlement-id-duplicate', message: `Settlement ID ${id} appears more than once.`, entityType: 'settlement', entityId: id });
  }
  return issues;
}

export function inspectSplitDataIntegrity(data: SplitData) {
  const issues: SplitzapIntegrityIssue[] = [];
  for (const id of duplicateIds(data.groups.map((group) => group.id))) {
    issues.push({ code: 'group-id-duplicate', message: `Group ID ${id} appears more than once.`, entityType: 'group', entityId: id });
  }
  for (const id of duplicateIds(data.expenses.map((expense) => expense.id))) {
    issues.push({ code: 'expense-id-duplicate-global', message: `Expense ID ${id} appears more than once.`, entityType: 'expense', entityId: id });
  }
  for (const id of duplicateIds(data.settlements.map((settlement) => settlement.id))) {
    issues.push({ code: 'settlement-id-duplicate-global', message: `Settlement ID ${id} appears more than once.`, entityType: 'settlement', entityId: id });
  }

  const groupIds = new Set(data.groups.map((group) => group.id));
  for (const expense of data.expenses) {
    if (!groupIds.has(expense.groupId)) issues.push({ code: 'expense-orphan', message: 'An expense points to a group that no longer exists.', entityType: 'expense', entityId: expense.id });
  }
  for (const settlement of data.settlements) {
    if (!groupIds.has(settlement.groupId)) issues.push({ code: 'settlement-orphan', message: 'A settlement points to a group that no longer exists.', entityType: 'settlement', entityId: settlement.id });
  }

  for (const group of data.groups) {
    issues.push(...validateGroupLedger(
      group,
      data.expenses.filter((expense) => expense.groupId === group.id),
      data.settlements.filter((settlement) => settlement.groupId === group.id),
    ));
  }
  return issues;
}

function integrityError(issues: SplitzapIntegrityIssue[]) {
  const first = issues[0];
  const suffix = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
  return new Error(`Splitzap stopped a data-integrity problem before sync: ${first?.message ?? 'Unknown ledger issue.'}${suffix}`);
}

export function assertSharedSnapshotIntegrity(snapshot: SharedGroupSnapshot) {
  const issues = inspectSharedSnapshotIntegrity(snapshot);
  if (issues.length) throw integrityError(issues);
}

export function assertSplitDataIntegrity(data: SplitData) {
  const issues = inspectSplitDataIntegrity(data);
  if (issues.length) throw integrityError(issues);
}
