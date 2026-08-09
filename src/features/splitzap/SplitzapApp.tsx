import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Home,
  Pencil,
  Plus,
  Receipt,
  Scale,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  CATEGORIES,
  CURRENCIES,
  categoryOf,
  groupBalances,
  money,
  personalShareOf,
  personalTotalOf,
  shareOf,
  sharedAmountOf,
  sharedShareOf,
  simplify,
  uid,
  useSplitData,
  type Debt,
  type Expense,
  type Group,
  type PersonalItem,
  type SplitData,
  type SplitMode,
} from './splitStore';

type View =
  | { name: 'home' }
  | { name: 'activity' }
  | { name: 'group'; groupId: string };

const parseView = (): View => {
  const hash = window.location.hash;
  if (hash === '#activity') return { name: 'activity' };
  if (hash.startsWith('#group=')) {
    return { name: 'group', groupId: decodeURIComponent(hash.slice('#group='.length)) };
  }
  return { name: 'home' };
};

export default function SplitzapApp() {
  const [view, setView] = useState<View>(() => parseView());

  useEffect(() => {
    const onPopState = () => setView(parseView());
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('button')) {
        try {
          navigator.vibrate?.(8);
        } catch {
          // Haptics are a progressive enhancement only.
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  const navigate = (next: View) => {
    const url =
      next.name === 'home'
        ? '/splitzap'
        : next.name === 'activity'
          ? '/splitzap#activity'
          : `/splitzap#group=${encodeURIComponent(next.groupId)}`;

    window.history.pushState({}, '', url);
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="splitzap-root min-h-[100dvh] bg-background text-foreground">
      <div className="splitzap-ambient" aria-hidden="true" />
      {view.name === 'home' ? (
        <HomeScreen navigate={navigate} />
      ) : view.name === 'activity' ? (
        <ActivityScreen navigate={navigate} />
      ) : (
        <GroupScreen groupId={view.groupId} navigate={navigate} />
      )}
    </div>
  );
}

function AnimatedMoney({ value, currency = '₹' }: { value: number; currency?: string }) {
  return (
    <span key={`${currency}-${value.toFixed(2)}`} className="balance-pop">
      {money(value, currency)}
    </span>
  );
}

function Avatar({
  name,
  size = 36,
  tone = 'default',
}: {
  name: string;
  size?: number;
  tone?: 'default' | 'light';
}) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={`splitzap-avatar grid shrink-0 place-items-center rounded-full font-semibold ${
        tone === 'light'
          ? 'bg-primary-foreground/20 text-primary-foreground'
          : 'bg-secondary text-secondary-foreground'
      }`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {letters || '?'}
    </span>
  );
}

function AppShell({
  children,
  onAdd,
  view,
  navigate,
}: {
  children: ReactNode;
  onAdd?: () => void;
  view: View;
  navigate: (view: View) => void;
}) {
  return (
    <div className="splitzap-shell screen-enter mx-auto min-h-[100dvh] w-full max-w-[520px] bg-background pb-28">
      {children}

      <nav className="splitzap-bottom-nav fixed bottom-0 left-1/2 z-30 w-full max-w-[520px] -translate-x-1/2 border-t border-border bg-surface/95 backdrop-blur">
        <div className="grid grid-cols-3 items-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <NavItem
            label="Groups"
            active={view.name === 'home'}
            icon={<Home size={20} />}
            onClick={() => navigate({ name: 'home' })}
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onAdd}
              disabled={!onAdd}
              aria-label="Add expense"
              className="splitzap-fab press -mt-8 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              style={{ boxShadow: 'var(--shadow-float)' }}
            >
              <Plus size={26} />
            </button>
          </div>
          <NavItem
            label="Activity"
            active={view.name === 'activity'}
            icon={<Receipt size={20} />}
            onClick={() => navigate({ name: 'activity' })}
          />
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`splitzap-nav-item flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${
        active ? 'is-active text-primary' : 'text-muted-foreground'
      }`}
    >
      <span className="splitzap-nav-icon">{icon}</span>
      {label}
    </button>
  );
}

function Header({
  title,
  subtitle,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-2">
        {back}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold">{title}</h1>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {right}
    </header>
  );
}

function HomeScreen({ navigate }: { navigate: (view: View) => void }) {
  const { data, update, hydrated } = useSplitData();
  const [addOpen, setAddOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  const summaries = data.groups.map((group) => {
    const balance = groupBalances(group, data.expenses, data.settlements);
    const spent = data.expenses
      .filter((expense) => expense.groupId === group.id)
      .reduce((sum, expense) => sum + expense.amount, 0);
    return { group, mine: balance[data.me] ?? 0, spent };
  });

  const owed = summaries.filter((summary) => summary.mine > 0.01);
  const owe = summaries.filter((summary) => summary.mine < -0.01);
  const totalOwed = owed.reduce((sum, item) => sum + item.mine, 0);
  const totalOwe = owe.reduce((sum, item) => sum - item.mine, 0);
  const overall = totalOwed - totalOwe;

  return (
    <AppShell
      onAdd={() => (data.groups.length ? setAddOpen(true) : setGroupOpen(true))}
      view={{ name: 'home' }}
      navigate={navigate}
    >
      <Header
        title="Splitzap"
        subtitle="Shared costs, zero awkwardness"
        right={
          <button
            type="button"
            onClick={() => setGroupOpen(true)}
            className="press flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"
          >
            <Plus size={14} /> Group
          </button>
        }
      />

      {!hydrated ? (
        <section className="space-y-3 px-5 pt-2">
          <div className="splitzap-skeleton h-44 rounded-3xl" />
          <div className="splitzap-skeleton h-20 rounded-3xl" />
          <div className="splitzap-skeleton h-20 rounded-3xl" />
        </section>
      ) : data.groups.length === 0 ? (
        <section className="px-5 pt-2">
          <div className="splitzap-welcome card-soft overflow-hidden p-6 text-center">
            <div className="welcome-orbit mx-auto mb-5" aria-hidden="true">
              <span>🍜</span>
              <span>🚕</span>
              <span>🏠</span>
              <span>🎉</span>
              <strong>₹</strong>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Start clean
            </p>
            <h2 className="mt-2 text-3xl font-extrabold">Split life, not friendships.</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Create your first group, add real expenses, and Splitzap will keep every balance clear.
            </p>
            <button
              type="button"
              onClick={() => setGroupOpen(true)}
              className="splitzap-primary-cta press mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground"
            >
              <Plus size={18} /> Create your first group
            </button>
            <div className="mt-6 grid grid-cols-3 gap-2 text-left">
              {[
                ['⚡', 'Fast', 'Add in seconds'],
                ['🧮', 'Clear', 'Automatic math'],
                ['🔒', 'Private', 'Saved on device'],
              ].map(([emoji, title, copy]) => (
                <div key={title} className="welcome-feature rounded-2xl bg-surface-2 p-3">
                  <span className="text-lg">{emoji}</span>
                  <p className="mt-1 text-xs font-bold">{title}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="px-5">
            <div
              className="hero-surface splitzap-hero rounded-3xl p-5 text-primary-foreground"
              style={{ boxShadow: 'var(--shadow-float)' }}
            >
              <div className="hero-glow" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
                Your overall balance
              </p>
              <p className="tabular mt-1 text-4xl font-extrabold">
                <AnimatedMoney value={overall} />
                <span className="ml-2 text-sm font-semibold opacity-80">
                  {overall >= 0 ? "you're owed" : 'you owe'}
                </span>
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="hero-stat rounded-2xl bg-primary-foreground/12 p-3">
                  <p className="text-[11px] font-semibold opacity-75">You are owed</p>
                  <p className="tabular text-lg font-bold"><AnimatedMoney value={totalOwed} /></p>
                </div>
                <div className="hero-stat rounded-2xl bg-primary-foreground/12 p-3">
                  <p className="text-[11px] font-semibold opacity-75">You owe</p>
                  <p className="tabular text-lg font-bold"><AnimatedMoney value={totalOwe} /></p>
                </div>
              </div>
            </div>
          </section>

          <section className="px-5 pt-6">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Groups
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {data.groups.length} active {data.groups.length === 1 ? 'group' : 'groups'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGroupOpen(true)}
                className="press text-xs font-bold text-primary"
              >
                + New group
              </button>
            </div>
            <div className="space-y-2.5">
              {summaries.map(({ group, mine, spent }, index) => (
                <button
                  type="button"
                  key={group.id}
                  onClick={() => navigate({ name: 'group', groupId: group.id })}
                  className="card-soft group-card list-enter press flex w-full items-center gap-3 p-3.5 text-left"
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <span className="group-emoji grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl">
                    {group.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{group.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Users size={12} /> {group.members.length} people · {money(spent, group.currency)} spent
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {Math.abs(mine) < 0.01 ? 'settled' : mine > 0 ? 'you get' : 'you owe'}
                    </p>
                    <p
                      className={`tabular font-bold ${
                        Math.abs(mine) < 0.01
                          ? 'text-muted-foreground'
                          : mine > 0
                            ? 'text-positive'
                            : 'text-negative'
                      }`}
                    >
                      {Math.abs(mine) < 0.01 ? '—' : money(mine, group.currency)}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {data.groups.length ? (
        <AddExpenseSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          data={data}
          update={update}
        />
      ) : null}
      <NewGroupSheet
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        update={update}
        onCreated={(groupId) => navigate({ name: 'group', groupId })}
      />
    </AppShell>
  );
}

function ActivityScreen({ navigate }: { navigate: (view: View) => void }) {
  const { data, update, hydrated } = useSplitData();
  const [addOpen, setAddOpen] = useState(false);

  const items = useMemo(() => {
    const expenses = data.expenses.map((expense) => ({
      kind: 'expense' as const,
      date: expense.date,
      expense,
    }));
    const payments = data.settlements.map((settlement) => ({
      kind: 'payment' as const,
      date: settlement.date,
      settlement,
    }));
    return [...expenses, ...payments].sort(
      (a, b) => +new Date(b.date) - +new Date(a.date),
    );
  }, [data]);

  const groupOf = (id: string) => data.groups.find((group) => group.id === id);
  const nameOf = (groupId: string, id: string) =>
    id === data.me
      ? 'You'
      : (groupOf(groupId)?.members.find((member) => member.id === id)?.name ?? 'Someone');

  const now = new Date();
  const monthTotal = data.expenses
    .filter((expense) => {
      const date = new Date(expense.date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, expense) => sum + shareOf(expense, data.me), 0);

  return (
    <AppShell
      onAdd={() => (data.groups.length ? setAddOpen(true) : navigate({ name: 'home' }))}
      view={{ name: 'activity' }}
      navigate={navigate}
    >
      <Header title="Activity" subtitle="Everything across your groups" />

      <section className="px-5">
        <div className="card-soft activity-total p-4">
          <p className="text-xs font-semibold text-muted-foreground">Your share this month</p>
          <p className="tabular mt-1 text-2xl font-extrabold">
            {hydrated ? <AnimatedMoney value={monthTotal} /> : '—'}
          </p>
        </div>
      </section>

      <section className="space-y-2.5 px-5 pt-5">
        {items.map((item, index) => {
          if (item.kind === 'expense') {
            const expense = item.expense;
            const group = groupOf(expense.groupId);
            const category = categoryOf(expense.category);
            const myShare = shareOf(expense, data.me);
            const personalCount = expense.personalItems?.length ?? 0;

            return (
              <button
                type="button"
                key={expense.id}
                onClick={() => navigate({ name: 'group', groupId: expense.groupId })}
                className="card-soft list-enter press flex w-full items-center gap-3 p-3.5 text-left"
                style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl">
                  {category.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{expense.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {group?.emoji} {group?.name} · {nameOf(expense.groupId, expense.paidBy)} paid{' '}
                    {money(expense.amount, group?.currency)}
                  </p>
                  {personalCount ? (
                    <p className="mt-1 text-[10px] font-bold text-primary">
                      {personalCount} personal {personalCount === 1 ? 'item' : 'items'}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-muted-foreground">your share</p>
                  <p className="tabular font-bold">{money(myShare, group?.currency)}</p>
                </div>
              </button>
            );
          }

          const settlement = item.settlement;
          const group = groupOf(settlement.groupId);

          return (
            <div
              key={settlement.id}
              className="payment-row list-enter flex items-center gap-3 rounded-2xl border border-dashed border-border p-3.5"
              style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
            >
              <span className="text-xl">💸</span>
              <p className="min-w-0 flex-1 truncate text-sm">
                <b>{nameOf(settlement.groupId, settlement.from)}</b> paid{' '}
                <b>{nameOf(settlement.groupId, settlement.to)}</b> in {group?.name}
              </p>
              <span className="tabular font-bold">
                {money(settlement.amount, group?.currency)}
              </span>
            </div>
          );
        })}

        {hydrated && items.length === 0 ? (
          <div className="card-soft empty-state p-8 text-center">
            <p className="text-4xl">📭</p>
            <p className="mt-3 font-bold">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your expenses and settlements will appear here automatically.
            </p>
          </div>
        ) : null}
      </section>

      {data.groups.length ? (
        <AddExpenseSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          data={data}
          update={update}
        />
      ) : null}
    </AppShell>
  );
}

function GroupScreen({
  groupId,
  navigate,
}: {
  groupId: string;
  navigate: (view: View) => void;
}) {
  const { data, update } = useSplitData();
  const [tab, setTab] = useState<'expenses' | 'balances'>('expenses');
  const [addOpen, setAddOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [newMember, setNewMember] = useState('');

  const group = data.groups.find((item) => item.id === groupId);

  const expenses = useMemo(
    () =>
      data.expenses
        .filter((expense) => expense.groupId === groupId)
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [data.expenses, groupId],
  );

  if (!group) {
    return (
      <AppShell view={{ name: 'group', groupId }} navigate={navigate}>
        <div className="p-8 text-center">
          <p className="font-bold">Group not found</p>
          <button
            type="button"
            onClick={() => navigate({ name: 'home' })}
            className="mt-3 inline-block text-sm font-bold text-primary"
          >
            Back to groups
          </button>
        </div>
      </AppShell>
    );
  }

  const balances = groupBalances(group, data.expenses, data.settlements);
  const mine = balances[data.me] ?? 0;
  const nameOf = (id: string) =>
    id === data.me ? 'You' : (group.members.find((member) => member.id === id)?.name ?? 'Someone');
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const settlements = data.settlements
    .filter((settlement) => settlement.groupId === groupId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <AppShell
      onAdd={() => setAddOpen(true)}
      view={{ name: 'group', groupId }}
      navigate={navigate}
    >
      <Header
        title={`${group.emoji} ${group.name}`}
        subtitle={`${group.members.length} people · ${money(total, group.currency)} spent`}
        back={
          <button
            type="button"
            onClick={() => navigate({ name: 'home' })}
            aria-label="Back"
            className="press mr-1 grid size-9 shrink-0 place-items-center rounded-full bg-surface-2"
          >
            <ArrowLeft size={18} />
          </button>
        }
      />

      <section className="px-5">
        <div className="card-soft group-balance-card flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground">
              {Math.abs(mine) < 0.01
                ? "You're all settled"
                : mine > 0
                  ? 'You are owed'
                  : 'You owe'}
            </p>
            <p
              className={`tabular mt-1 text-2xl font-extrabold ${
                Math.abs(mine) < 0.01
                  ? 'text-foreground'
                  : mine > 0
                    ? 'text-positive'
                    : 'text-negative'
              }`}
            >
              <AnimatedMoney value={mine} currency={group.currency} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettleOpen(true)}
            className="press flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Scale size={15} /> Settle up
          </button>
        </div>
      </section>

      <div className="sticky top-0 z-20 mt-5 bg-background/90 px-5 pb-2 pt-1 backdrop-blur">
        <div className="splitzap-segment grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
          {(
            [
              ['expenses', 'Expenses'],
              ['balances', 'Balances'],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              onClick={() => setTab(id)}
              className={`press rounded-xl py-2 text-sm font-bold ${
                tab === id ? 'is-active bg-surface text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'expenses' ? (
        <section className="space-y-2.5 px-5 pt-2">
          {expenses.map((expense, index) => {
            const category = categoryOf(expense.category);
            const myShare = shareOf(expense, data.me);
            const lent = expense.paidBy === data.me ? expense.amount - myShare : -myShare;
            const personalCount = expense.personalItems?.length ?? 0;

            return (
              <div
                key={expense.id}
                className="card-soft expense-card list-enter p-3.5"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedExpense(expense)}
                  className="press flex w-full items-center gap-3 text-left"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl">
                    {category.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{expense.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {nameOf(expense.paidBy)} paid {money(expense.amount, group.currency)} ·{' '}
                      {new Date(expense.date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    {personalCount ? (
                      <span className="personal-badge mt-1.5 inline-flex rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-secondary-foreground">
                        {personalCount} personal {personalCount === 1 ? 'item' : 'items'}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {lent >= 0 ? 'you lent' : 'you owe'}
                    </p>
                    <p
                      className={`tabular font-bold ${
                        lent >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {money(lent, group.currency)}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-muted-foreground" />
                </button>
                <div className="mt-2 flex gap-2 border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedExpense(expense)}
                    className="press flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    <Receipt size={12} /> View split
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(expense);
                      setAddOpen(true);
                    }}
                    className="press flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        expenses: current.expenses.filter((item) => item.id !== expense.id),
                      }))
                    }
                    className="press ml-auto flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-negative"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            );
          })}

          {expenses.length === 0 ? (
            <div className="card-soft empty-state p-8 text-center">
              <p className="text-4xl">🧾</p>
              <p className="mt-2 font-bold">No expenses yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap the + button to add the first one.
              </p>
            </div>
          ) : null}

          {settlements.length ? (
            <div className="pt-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Payments
              </h3>
              {settlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="payment-row mb-2 flex items-center gap-3 rounded-2xl border border-dashed border-border p-3"
                >
                  <span className="text-lg">💸</span>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <b>{nameOf(settlement.from)}</b> paid <b>{nameOf(settlement.to)}</b>
                  </p>
                  <span className="tabular text-sm font-bold">
                    {money(settlement.amount, group.currency)}
                  </span>
                  <button
                    type="button"
                    aria-label="Undo payment"
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        settlements: current.settlements.filter(
                          (item) => item.id !== settlement.id,
                        ),
                      }))
                    }
                    className="press text-xs font-semibold text-muted-foreground"
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="space-y-2.5 px-5 pt-2">
          {group.members.map((member, index) => {
            const value = balances[member.id] ?? 0;
            return (
              <div
                key={member.id}
                className="card-soft list-enter flex items-center gap-3 p-3.5"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <Avatar name={member.name} size={40} />
                <p className="min-w-0 flex-1 truncate font-bold">
                  {member.id === data.me ? 'You' : member.name}
                </p>
                <p
                  className={`tabular font-bold ${
                    Math.abs(value) < 0.01
                      ? 'text-muted-foreground'
                      : value > 0
                        ? 'text-positive'
                        : 'text-negative'
                  }`}
                >
                  {Math.abs(value) < 0.01
                    ? 'settled'
                    : `${value > 0 ? 'gets ' : 'owes '}${money(value, group.currency)}`}
                </p>
              </div>
            );
          })}

          <div className="card-soft p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <UserPlus size={13} /> Add someone
            </p>
            <div className="flex gap-2">
              <input
                value={newMember}
                onChange={(event) => setNewMember(event.target.value)}
                placeholder="Name"
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={!newMember.trim()}
                onClick={() => {
                  const name = newMember.trim();
                  update((current) => ({
                    ...current,
                    groups: current.groups.map((item) =>
                      item.id === group.id
                        ? { ...item, members: [...item.members, { id: uid(), name }] }
                        : item,
                    ),
                  }));
                  setNewMember('');
                }}
                className="press shrink-0 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </section>
      )}

      {addOpen ? (
        <AddExpenseSheet
          key={editing?.id ?? 'new'}
          open={addOpen}
          onClose={() => {
            setAddOpen(false);
            setEditing(null);
          }}
          data={data}
          update={update}
          defaultGroupId={group.id}
          editing={editing}
        />
      ) : null}

      <ExpenseResultSheet
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        expense={selectedExpense}
        group={group}
        data={data}
        onEdit={() => {
          if (!selectedExpense) return;
          setEditing(selectedExpense);
          setSelectedExpense(null);
          setAddOpen(true);
        }}
      />

      <SettleSheet
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        group={group}
        balances={balances}
        data={data}
        update={update}
      />
    </AppShell>
  );
}

function SheetModal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-wrap fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="sheet-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
      />
      <div className="sheet-panel relative flex max-h-[94dvh] w-full max-w-[520px] flex-col rounded-t-[28px] bg-surface animate-in slide-in-from-bottom duration-200">
        <div className="sheet-handle mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer ? (
          <div className="sheet-footer border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'splitzap-input w-full rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25';

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="splitzap-primary-button press w-full rounded-2xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ExpenseBreakdown({
  expense,
  group,
  data,
}: {
  expense: Expense;
  group: Group;
  data: SplitData;
}) {
  const sharedAmount = sharedAmountOf(expense);
  const personalTotal = personalTotalOf(expense);
  const nameOf = (id: string) =>
    id === data.me ? 'You' : (group.members.find((member) => member.id === id)?.name ?? 'Someone');

  return (
    <div className="space-y-3">
      <div className="result-total rounded-3xl bg-surface-2 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Total expense</p>
            <p className="tabular mt-1 text-3xl font-extrabold">{money(expense.amount, group.currency)}</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">
            {expense.mode === 'equal' ? 'Equal split' : expense.mode === 'exact' ? 'Exact split' : 'Shares'}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Shared</p>
            <p className="tabular mt-1 font-bold">{money(sharedAmount, group.currency)}</p>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Personal</p>
            <p className="tabular mt-1 font-bold">{money(personalTotal, group.currency)}</p>
          </div>
        </div>
      </div>

      {expense.personalItems?.length ? (
        <div className="result-section rounded-3xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-extrabold">Personal items</p>
              <p className="text-xs text-muted-foreground">Added only to that person's share</p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
              {expense.personalItems.length}
            </span>
          </div>
          <div className="space-y-2">
            {expense.personalItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <Avatar name={nameOf(item.memberId)} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.description || 'Personal item'}</p>
                  <p className="truncate text-xs text-muted-foreground">{nameOf(item.memberId)}</p>
                </div>
                <p className="tabular text-sm font-extrabold">{money(item.amount, group.currency)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="result-section rounded-3xl border border-border bg-surface p-4">
        <p className="text-sm font-extrabold">Result</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Final responsibility for this expense</p>
        <div className="mt-3 space-y-2">
          {group.members.map((member) => {
            const shared = sharedShareOf(expense, member.id);
            const personal = personalShareOf(expense, member.id);
            const total = shared + personal;
            if (total <= 0.001) return null;

            return (
              <div key={member.id} className="result-person flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <Avatar name={member.name} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{member.id === data.me ? 'You' : member.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {money(shared, group.currency)} shared
                    {personal > 0 ? ` + ${money(personal, group.currency)} personal` : ''}
                  </p>
                </div>
                <p className="tabular font-extrabold">{money(total, group.currency)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExpenseResultSheet({
  open,
  onClose,
  expense,
  group,
  data,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  expense: Expense | null;
  group: Group;
  data: SplitData;
  onEdit: () => void;
}) {
  if (!expense) return null;

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title="Expense result"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="press rounded-2xl bg-surface-2 py-3.5 text-sm font-bold text-foreground"
          >
            Edit expense
          </button>
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </div>
      }
    >
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {categoryOf(expense.category).emoji} {categoryOf(expense.category).label}
        </p>
        <h3 className="mt-1 text-2xl font-extrabold">{expense.description}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Paid by {expense.paidBy === data.me ? 'You' : group.members.find((member) => member.id === expense.paidBy)?.name ?? 'Someone'}
        </p>
      </div>
      <ExpenseBreakdown expense={expense} group={group} data={data} />
    </SheetModal>
  );
}

function AddExpenseSheet({
  open,
  onClose,
  data,
  update,
  defaultGroupId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  data: SplitData;
  update: (fn: (data: SplitData) => SplitData) => void;
  defaultGroupId?: string;
  editing?: Expense | null;
}) {
  const groups = data.groups;
  const [groupId, setGroupId] = useState(
    editing?.groupId ?? defaultGroupId ?? groups[0]?.id ?? '',
  );
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [category, setCategory] = useState(editing?.category ?? 'general');
  const [paidBy, setPaidBy] = useState(editing?.paidBy ?? data.me);
  const [mode, setMode] = useState<SplitMode>(editing?.mode ?? 'equal');
  const [split, setSplit] = useState<Record<string, number>>(editing?.split ?? {});
  const [personalItems, setPersonalItems] = useState<PersonalItem[]>(editing?.personalItems ?? []);
  const [savedExpense, setSavedExpense] = useState<Expense | null>(null);

  useEffect(() => {
    if (!open) setSavedExpense(null);
  }, [open]);

  const group = groups.find((item) => item.id === groupId) as Group | undefined;
  const total = Number(amount) || 0;
  const personalTotal = personalItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const sharedTotal = Math.max(0, total - personalTotal);
  const personalOver = personalTotal - total;

  const activeSplit = useMemo<Record<string, number>>(() => {
    if (!group) return {};
    if (Object.keys(split).length) return split;
    return Object.fromEntries(group.members.map((member) => [member.id, 1])) as Record<string, number>;
  }, [group, split]);

  const weightTotal = Object.values(activeSplit).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
  const exactAssigned = Object.values(activeSplit).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
  const exactRemaining = sharedTotal - exactAssigned;
  const hasSharedAmount = sharedTotal > 0.009;
  const hasSharedPeople = Object.values(activeSplit).some((value) => value > 0);
  const personalValid =
    personalOver <= 0.009 &&
    personalItems.every((item) => item.memberId && Number(item.amount) > 0);
  const valid =
    !!group &&
    description.trim().length > 0 &&
    total > 0 &&
    personalValid &&
    (!hasSharedAmount || hasSharedPeople) &&
    (mode !== 'exact' || Math.abs(exactRemaining) < 0.01);

  const assignedTotal =
    mode === 'exact'
      ? personalTotal + exactAssigned
      : personalTotal + (hasSharedPeople ? sharedTotal : 0);
  const progress = total > 0 ? Math.min(100, Math.max(0, (assignedTotal / total) * 100)) : 0;

  const setWeight = (id: string, value: number) => {
    setSplit({ ...activeSplit, [id]: value });
  };

  const addPersonalItem = () => {
    const memberId = group?.members[0]?.id ?? data.me;
    setPersonalItems((current) => [
      ...current,
      { id: uid(), memberId, description: '', amount: 0 },
    ]);
  };

  const updatePersonalItem = (id: string, patch: Partial<PersonalItem>) => {
    setPersonalItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const save = () => {
    if (!group || !valid) return;

    const cleanPersonalItems = personalItems
      .filter((item) => item.memberId && item.amount > 0)
      .map((item) => ({
        ...item,
        description: item.description.trim() || 'Personal item',
        amount: Number(item.amount),
      }));

    const payload: Expense = {
      id: editing?.id ?? uid(),
      groupId: group.id,
      description: description.trim(),
      amount: total,
      paidBy,
      split: hasSharedAmount
        ? (Object.fromEntries(
            Object.entries(activeSplit).filter(([, value]) => Number(value) > 0),
          ) as Record<string, number>)
        : {},
      mode,
      category,
      date: editing?.date ?? new Date().toISOString(),
      personalItems: cleanPersonalItems,
    };

    update((current) => ({
      ...current,
      expenses: editing
        ? current.expenses.map((expense) => (expense.id === editing.id ? payload : expense))
        : [payload, ...current.expenses],
    }));

    setSavedExpense(payload);
  };

  if (savedExpense && group) {
    return (
      <SheetModal
        open={open}
        onClose={onClose}
        title={editing ? 'Expense updated' : 'Expense added'}
        footer={<PrimaryButton onClick={onClose}>Done</PrimaryButton>}
      >
        <div className="success-state py-3 text-center">
          <div className="success-check mx-auto grid size-16 place-items-center rounded-full bg-secondary text-primary">
            <Check size={30} strokeWidth={3} />
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">All balanced</p>
          <h3 className="mt-1 text-2xl font-extrabold">{savedExpense.description}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {money(savedExpense.amount, group.currency)} has been assigned correctly.
          </p>
        </div>
        <ExpenseBreakdown expense={savedExpense} group={group} data={data} />
      </SheetModal>
    );
  }

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit expense' : 'Add an expense'}
      footer={
        <PrimaryButton onClick={save} disabled={!valid}>
          {editing ? 'Save changes' : 'Add expense'}
        </PrimaryButton>
      }
    >
      {groups.length > 1 || !defaultGroupId ? (
        <Field label="Group">
          <select
            value={groupId}
            onChange={(event) => {
              const nextGroupId = event.target.value;
              const nextGroup = groups.find((item) => item.id === nextGroupId);
              setGroupId(nextGroupId);
              setSplit({});
              setPersonalItems([]);
              setPaidBy(nextGroup?.members[0]?.id ?? data.me);
            }}
            className={inputClass}
          >
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.emoji} {item.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Description">
        <input
          autoFocus
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Dinner, cab, groceries…"
          className={inputClass}
        />
      </Field>

      <Field label={`Amount (${group?.currency ?? '₹'})`}>
        <div className="amount-field relative">
          <input
            value={amount}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            className={`${inputClass} tabular text-2xl font-bold`}
          />
        </div>
      </Field>

      <Field label="Category">
        <div className="category-scroll flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`press shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                category === item.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface-2 text-muted-foreground'
              }`}
            >
              {item.emoji} {item.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Paid by">
        <div className="flex flex-wrap gap-2">
          {group?.members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setPaidBy(member.id)}
              className={`person-pill press flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${
                paidBy === member.id
                  ? 'is-selected border-primary bg-secondary text-secondary-foreground'
                  : 'border-border bg-surface-2 text-muted-foreground'
              }`}
            >
              <Avatar name={member.name} size={22} />
              {member.id === data.me ? 'You' : member.name}
              {paidBy === member.id ? <Check size={12} /> : null}
            </button>
          ))}
        </div>
      </Field>

      <div className="personal-items-card mb-4 rounded-3xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-extrabold">Personal items</p>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Optional
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Add something that belongs to only one person, like a drink, dessert, or ticket.
            </p>
          </div>
          <button
            type="button"
            onClick={addPersonalItem}
            className="press grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary"
            aria-label="Add personal item"
          >
            <Plus size={18} />
          </button>
        </div>

        {personalItems.length ? (
          <div className="mt-3 space-y-2">
            {personalItems.map((item, index) => (
              <div key={item.id} className="personal-item-editor rounded-2xl bg-surface-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-muted-foreground">Item {index + 1}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setPersonalItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
                    }
                    className="press grid size-7 place-items-center rounded-full bg-surface text-negative"
                    aria-label="Remove personal item"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_1.25fr_.8fr]">
                  <select
                    value={item.memberId}
                    onChange={(event) => updatePersonalItem(item.id, { memberId: event.target.value })}
                    className={`${inputClass} py-2.5 text-sm`}
                  >
                    {group?.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.id === data.me ? 'You' : member.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={item.description}
                    onChange={(event) => updatePersonalItem(item.id, { description: event.target.value })}
                    placeholder="Beer, dessert…"
                    className={`${inputClass} py-2.5 text-sm`}
                  />
                  <input
                    value={item.amount || ''}
                    onChange={(event) =>
                      updatePersonalItem(item.id, {
                        amount: Number(event.target.value.replace(/[^0-9.]/g, '')) || 0,
                      })
                    }
                    inputMode="decimal"
                    placeholder="0"
                    className={`${inputClass} tabular py-2.5 text-right text-sm font-bold`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={addPersonalItem}
            className="personal-empty press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 px-3 py-3 text-xs font-bold text-primary"
          >
            <Plus size={15} /> Add a personal item
          </button>
        )}

        {personalItems.length ? (
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Personal total</span>
            <span className={`tabular font-extrabold ${personalOver > 0.009 ? 'text-negative' : 'text-foreground'}`}>
              {money(personalTotal, group?.currency)}
            </span>
          </div>
        ) : null}

        {personalOver > 0.009 ? (
          <p className="mt-2 text-xs font-bold text-negative">
            Personal items are {money(personalOver, group?.currency)} over the expense total.
          </p>
        ) : null}
      </div>

      <Field label={`Split shared amount · ${money(sharedTotal, group?.currency)}`}>
        <div className="splitzap-segment mb-2 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
          {(
            [
              ['equal', 'Equally'],
              ['exact', 'Exact'],
              ['shares', 'Shares'],
            ] as const
          ).map(([splitMode, label]) => (
            <button
              key={splitMode}
              type="button"
              onClick={() => {
                setMode(splitMode);
                setSplit(
                  Object.fromEntries(
                    (group?.members ?? []).map((member) => [
                      member.id,
                      splitMode === 'exact' ? 0 : 1,
                    ]),
                  ),
                );
              }}
              className={`press rounded-lg py-2 text-xs font-bold ${
                mode === splitMode
                  ? 'is-active bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {group?.members.map((member) => {
            const weight = Number(activeSplit[member.id] ?? 0);
            const sharedOwed =
              mode === 'exact' ? weight : weightTotal ? (sharedTotal * weight) / weightTotal : 0;
            const personalOwed = personalItems
              .filter((item) => item.memberId === member.id)
              .reduce((sum, item) => sum + item.amount, 0);

            return (
              <div key={member.id} className="split-person-row flex items-center gap-3 bg-surface px-3 py-2.5">
                <Avatar name={member.name} size={30} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {member.id === data.me ? 'You' : member.name}
                  </span>
                  {personalOwed > 0 ? (
                    <span className="text-[10px] font-bold text-primary">
                      + {money(personalOwed, group.currency)} personal
                    </span>
                  ) : null}
                </div>

                {mode === 'equal' ? (
                  <>
                    <span className="tabular text-sm text-muted-foreground">
                      {weight > 0 ? money(sharedOwed + personalOwed, group.currency) : personalOwed > 0 ? money(personalOwed, group.currency) : '—'}
                    </span>
                    <input
                      type="checkbox"
                      checked={weight > 0}
                      onChange={(event) => setWeight(member.id, event.target.checked ? 1 : 0)}
                      className="size-5 accent-[oklch(var(--primary))]"
                    />
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="tabular hidden text-xs text-muted-foreground min-[390px]:inline">
                      {money(sharedOwed + personalOwed, group.currency)}
                    </span>
                    <input
                      value={weight === 0 ? '' : String(weight)}
                      inputMode="decimal"
                      placeholder="0"
                      onChange={(event) =>
                        setWeight(
                          member.id,
                          Number(event.target.value.replace(/[^0-9.]/g, '')) || 0,
                        )
                      }
                      className="tabular w-20 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-right text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {mode === 'exact' && total > 0 ? (
          <p
            className={`mt-2 text-xs font-semibold ${
              Math.abs(exactRemaining) < 0.01 ? 'text-positive' : 'text-negative'
            }`}
          >
            {Math.abs(exactRemaining) < 0.01
              ? 'Shared amount is fully assigned.'
              : `${money(Math.abs(exactRemaining), group?.currency)} ${
                  exactRemaining > 0 ? 'shared amount left to assign' : 'over the shared amount'
                }`}
          </p>
        ) : null}
      </Field>

      <div className={`assignment-card mb-3 rounded-3xl border p-4 ${valid ? 'is-complete border-primary/20 bg-secondary' : 'border-border bg-surface-2'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Assignment</p>
            <p className="mt-1 text-sm font-extrabold">
              {money(assignedTotal, group?.currency)} of {money(total, group?.currency)}
            </p>
          </div>
          <div className={`grid size-9 place-items-center rounded-full ${valid ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground'}`}>
            {valid ? <Check size={18} /> : <Sparkles size={17} />}
          </div>
        </div>
        <div className="assignment-track mt-3 h-2 overflow-hidden rounded-full bg-surface">
          <div className="assignment-fill h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold text-muted-foreground">
          <span>{money(sharedTotal, group?.currency)} shared</span>
          <span>{money(personalTotal, group?.currency)} personal</span>
        </div>
      </div>

      <p className="pb-2 text-xs text-muted-foreground">
        {categoryOf(category).emoji} Saved on this device only — no account needed.
      </p>
    </SheetModal>
  );
}

const EMOJIS = ['👥', '🏖️', '🏠', '🍽️', '✈️', '🎓', '🎉', '🚗', '💼'];

function NewGroupSheet({
  open,
  onClose,
  update,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  update: (fn: (data: SplitData) => SplitData) => void;
  onCreated?: (groupId: string) => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [currency, setCurrency] = useState('₹');
  const [people, setPeople] = useState<string[]>(['']);

  const valid = Boolean(name.trim() && people.some((person) => person.trim()));

  const create = () => {
    if (!valid) return;
    const groupId = uid();

    update((current) => ({
      ...current,
      groups: [
        {
          id: groupId,
          name: name.trim(),
          emoji,
          currency,
          createdAt: new Date().toISOString(),
          members: [
            { id: current.me, name: 'You' },
            ...people
              .map((person) => person.trim())
              .filter(Boolean)
              .map((person) => ({ id: uid(), name: person })),
          ],
        },
        ...current.groups,
      ],
    }));

    onClose();
    setName('');
    setEmoji('👥');
    setPeople(['']);
    onCreated?.(groupId);
  };

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title="New group"
      footer={
        <PrimaryButton onClick={create} disabled={!valid}>
          Create group
        </PrimaryButton>
      }
    >
      <div className="mb-5 rounded-3xl bg-secondary p-4">
        <p className="text-sm font-extrabold">A fresh shared space</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Add only the real people in this group. No sample data is created for you.
        </p>
      </div>

      <Field label="Group name">
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Trip, apartment, dinner crew…"
          className={inputClass}
        />
      </Field>

      <Field label="Icon">
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setEmoji(item)}
              className={`emoji-choice press grid size-11 place-items-center rounded-xl border text-xl ${
                emoji === item ? 'is-selected border-primary bg-secondary' : 'border-border bg-surface-2'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Currency">
        <div className="flex gap-2">
          {CURRENCIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCurrency(item)}
              className={`press size-11 rounded-xl border text-base font-bold ${
                currency === item
                  ? 'border-primary bg-secondary'
                  : 'border-border bg-surface-2'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </Field>

      <Field label="People (besides you)">
        <div className="space-y-2">
          {people.map((person, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={person}
                onChange={(event) =>
                  setPeople(
                    people.map((item, personIndex) =>
                      personIndex === index ? event.target.value : item,
                    ),
                  )
                }
                placeholder={`Person ${index + 1}`}
                className={inputClass}
              />
              {people.length > 1 ? (
                <button
                  type="button"
                  aria-label="Remove person"
                  onClick={() => setPeople(people.filter((_, personIndex) => personIndex !== index))}
                  className="press grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setPeople([...people, ''])}
            className="press text-sm font-bold text-primary"
          >
            + Add another person
          </button>
        </div>
      </Field>

      <p className="pb-2 text-xs text-muted-foreground">You are added automatically as “You”.</p>
    </SheetModal>
  );
}

function SettleSheet({
  open,
  onClose,
  group,
  balances,
  data,
  update,
}: {
  open: boolean;
  onClose: () => void;
  group: Group;
  balances: Record<string, number>;
  data: SplitData;
  update: (fn: (data: SplitData) => SplitData) => void;
}) {
  const debts = simplify(balances);
  const nameOf = (id: string) => {
    const member = group.members.find((item) => item.id === id);
    return id === data.me ? 'You' : (member?.name ?? 'Someone');
  };

  const record = (debt: Debt) => {
    update((current) => ({
      ...current,
      settlements: [
        {
          id: uid(),
          groupId: group.id,
          from: debt.from,
          to: debt.to,
          amount: debt.amount,
          date: new Date().toISOString(),
        },
        ...current.settlements,
      ],
    }));
  };

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title="Settle up"
      footer={<PrimaryButton onClick={onClose}>Done</PrimaryButton>}
    >
      <p className="mb-3 text-sm text-muted-foreground">
        The fewest possible payments to clear everything in {group.name}.
      </p>

      {debts.length === 0 ? (
        <div className="celebration relative overflow-hidden rounded-3xl bg-secondary p-7 text-center">
          <div className="confetti" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </div>
          <div className="success-check mx-auto grid size-16 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check size={30} strokeWidth={3} />
          </div>
          <p className="mt-3 text-xl font-extrabold">Everyone is settled up</p>
          <p className="mt-1 text-sm text-muted-foreground">Nothing awkward left to calculate.</p>
        </div>
      ) : (
        <div className="space-y-2 pb-2">
          {debts.map((debt, index) => (
            <div
              key={`${debt.from}-${debt.to}`}
              className="settle-row list-enter flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <Avatar name={nameOf(debt.from)} size={32} />
              <ArrowRight size={16} className="shrink-0 text-muted-foreground" />
              <Avatar name={nameOf(debt.to)} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {nameOf(debt.from)} → {nameOf(debt.to)}
                </p>
                <p className="tabular text-sm font-bold text-primary">
                  {money(debt.amount, group.currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => record(debt)}
                className="press shrink-0 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                Mark paid
              </button>
            </div>
          ))}
        </div>
      )}
    </SheetModal>
  );
}
