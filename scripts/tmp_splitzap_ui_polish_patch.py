from pathlib import Path

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


cloud_path = 'src/features/splitzap/SplitzapCloudApp.tsx'
app_path = 'src/features/splitzap/SplitzapAppV4.tsx'
css_path = 'src/features/splitzap/splitzap.css'

cloud = read(cloud_path)

# Guest onboarding: same meaning, far less copy.
cloud = replace_once(
    cloud,
    '<div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-xl font-extrabold text-red-600">G</div><h1 className="mt-4 text-center text-xl font-extrabold">Use Splitzap without login</h1><p className="mt-1 text-center text-xs leading-5 text-slate-500">You can create groups and split expenses on this device right away.</p><div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-3 text-[11px] leading-5 text-red-700"><b className="block">Guest mode is local only</b>Your data is not backed up or synced. You cannot join or live-share groups with friends. Sign in free anytime for cloud sync and sharing.</div>',
    '<div className="guest-hero-icon mx-auto grid size-14 place-items-center rounded-2xl text-xl font-extrabold">G</div><h1 className="mt-4 text-center text-xl font-extrabold">Try Splitzap as guest</h1><p className="mt-1 text-center text-xs text-slate-500">No account needed.</p><div className="guest-local-card mt-4 rounded-2xl px-3 py-3 text-[11px] text-red-700"><b>Local only</b> · No backup, sync or shared groups.</div>',
    'minimal guest onboarding copy',
)
cloud = replace_once(
    cloud,
    '>Continue locally</button>',
    '>Start splitting</button>',
    'guest primary CTA',
)
cloud = replace_once(
    cloud,
    '>Sign in instead</button>',
    '>Sign in free</button>',
    'guest sign-in CTA',
)

# Red guest profile warning should read as a profile/account affordance, not a text badge.
old_guest_action = '<button type="button" onClick={() => setAccountOpen(true)} aria-label="Guest mode · sign in to sync" title="Guest mode · sign in to sync" className="press relative grid size-9 place-items-center rounded-full border border-red-200 bg-red-50 text-red-700 shadow-sm"><span className="text-[10px] font-extrabold">GUEST</span><span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full border-2 border-white bg-red-500 text-[8px] font-black text-white">!</span></button>'
new_guest_action = '<button type="button" onClick={() => setAccountOpen(true)} aria-label="Guest mode · sign in free" title="Guest mode · sign in free" className="guest-profile-alert press relative grid size-9 place-items-center rounded-full border border-red-200 bg-red-50 text-red-700 shadow-sm"><UserPlus size={15} /><span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full border-2 border-white bg-red-500 text-[8px] font-black text-white">!</span></button>'
cloud = replace_once(cloud, old_guest_action, new_guest_action, 'guest profile alert')

cloud = replace_once(
    cloud,
    '<div className="mb-3 rounded-2xl border border-red-100 bg-red-50 p-3"><p className="text-xs font-extrabold text-red-700">You are using Guest mode</p><p className="mt-1 text-[11px] leading-5 text-red-600">Data is kept only on this device. Sign in free to back it up, sync across devices, and join or live-share groups with friends.</p></div>',
    '<div className="guest-local-card mb-3 rounded-2xl p-3"><p className="text-xs font-extrabold text-red-700">Guest mode</p><p className="mt-1 text-[11px] text-red-600">Local only · Sign in free for backup + sharing.</p><div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[9px] font-bold text-red-700"><span className="rounded-lg bg-white/70 px-1 py-1.5">☁ Backup</span><span className="rounded-lg bg-white/70 px-1 py-1.5">↔ Sync</span><span className="rounded-lg bg-white/70 px-1 py-1.5">👥 Share</span></div></div>',
    'minimal guest account warning',
)
cloud = replace_once(
    cloud,
    '<p className="mt-2 text-center text-[10px] leading-4 text-slate-500">Local-only mode: no cloud backup, cross-device sync, shared-group invites or live collaboration.</p>',
    '<p className="mt-2 text-center text-[10px] text-slate-500">Local only · no backup or sharing.</p>',
    'minimal guest helper',
)
write(cloud_path, cloud)

app = read(app_path)

# Give high-frequency actions distinct visual identities without changing behavior.
app = replace_once(
    app,
    'className="press grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"><Camera size={16}',
    'className="splitzap-camera-button press grid size-9 place-items-center rounded-full text-primary-foreground shadow-sm"><Camera size={16}',
    'camera visual class',
)
app = replace_once(
    app,
    'className="press flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"><Plus size={14} /> New',
    'className="splitzap-new-button press flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold"><Plus size={14} /> New',
    'new group visual class',
)
app = replace_once(
    app,
    '<div className="balance-strip grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface"><button type="button" onClick={() => setBalanceDetailMode(\'get\')} className="press p-4 text-left">',
    '<div className="balance-strip grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface"><button type="button" onClick={() => setBalanceDetailMode(\'get\')} className="balance-card balance-card--get press p-4 text-left">',
    'you get visual class',
)
app = replace_once(
    app,
    '<button type="button" onClick={() => setBalanceDetailMode(\'owe\')} className="press border-l border-border p-4 text-left">',
    '<button type="button" onClick={() => setBalanceDetailMode(\'owe\')} className="balance-card balance-card--owe press border-l border-border p-4 text-left">',
    'you owe visual class',
)
write(app_path, app)

css = read(css_path)
css += r'''

/* Visual polish: more personality, no financial behavior changes. */
.balance-strip {
  box-shadow: 0 12px 32px -26px rgba(17, 75, 67, 0.55);
}

.balance-card {
  position: relative;
  isolation: isolate;
  transition: transform 160ms ease, filter 160ms ease;
}

.balance-card::after {
  content: '';
  position: absolute;
  right: -18px;
  top: -24px;
  width: 72px;
  height: 72px;
  border-radius: 999px;
  opacity: 0.28;
  z-index: -1;
}

.balance-card--get {
  background: linear-gradient(135deg, rgba(220, 252, 231, 0.82), rgba(236, 253, 245, 0.42));
}
.balance-card--get::after { background: rgba(16, 185, 129, 0.46); }

.balance-card--owe {
  background: linear-gradient(135deg, rgba(255, 237, 213, 0.78), rgba(255, 241, 242, 0.52));
}
.balance-card--owe::after { background: rgba(251, 113, 133, 0.42); }

.balance-card:active { transform: scale(0.975); filter: saturate(1.12); }

.splitzap-camera-button {
  background: linear-gradient(145deg, #0b8f76, #14b8a6);
  box-shadow: 0 9px 22px -12px rgba(13, 148, 136, 0.95);
}

.splitzap-new-button {
  color: #56407d;
  background: linear-gradient(135deg, #efe7ff, #e4f5ff);
  border: 1px solid rgba(120, 92, 170, 0.13);
  box-shadow: 0 8px 18px -14px rgba(94, 66, 140, 0.8);
}

.splitzap-primary-button {
  background: linear-gradient(135deg, #087f68, #0ea58b 58%, #17b99c);
  box-shadow: 0 13px 28px -18px rgba(5, 117, 96, 0.95);
}

.splitzap-fab {
  background: linear-gradient(145deg, #087f68, #11b393);
  box-shadow: 0 12px 28px -14px rgba(5, 117, 96, 0.95) !important;
}

.sheet-panel {
  box-shadow: 0 -24px 70px -42px rgba(14, 64, 57, 0.7);
}

.sheet-handle {
  background: linear-gradient(90deg, #c8d9d4, #77c9b8, #c8d9d4) !important;
}

.group-row {
  transition: transform 150ms ease, background-color 150ms ease;
}
.group-row:active { transform: translateX(3px) scale(0.992); }

.group-emoji {
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.38), 0 8px 18px -14px rgba(20,70,60,.65);
}

.guest-hero-icon {
  color: #fff;
  background: linear-gradient(145deg, #ef4444, #fb7185);
  box-shadow: 0 14px 30px -18px rgba(225, 29, 72, .9);
  transform: rotate(-4deg);
}

.guest-local-card {
  border: 1px solid rgba(244, 63, 94, .14);
  background: linear-gradient(135deg, rgba(255,241,242,.96), rgba(255,247,237,.92));
}

.guest-profile-alert {
  animation: splitzapGuestNudge 2.8s ease-in-out 2;
}

@keyframes splitzapGuestNudge {
  0%, 100% { transform: scale(1); }
  45% { transform: scale(1.08); }
  60% { transform: scale(.98); }
}

@media (prefers-reduced-motion: reduce) {
  .guest-profile-alert { animation: none; }
  .balance-card, .group-row { transition: none; }
}

@supports (-webkit-touch-callout: none) {
  .guest-profile-alert { animation: none; }
}
'''
write(css_path, css)

print('Splitzap minimal-copy visual polish applied successfully.')
