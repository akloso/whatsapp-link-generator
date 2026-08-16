from pathlib import Path
p = Path('src/features/splitzap/SplitzapAppV4.tsx')
s = p.read_text()

old = '<Field label="Icon"><p className="mb-2 text-[10px] font-semibold text-muted-foreground">Auto-selected from the group name · tap any icon to override.</p><div className="flex flex-wrap gap-2">{EMOJIS.map((item) => <button type="button" key={item} onClick={() => setEmoji(item)}'
new = '<Field label="Icon"><div className="flex flex-wrap gap-2">{EMOJIS.map((item) => <button type="button" key={item} onClick={() => setEmoji(item)}'
if old not in s:
    raise SystemExit('Edit Group hint target missing')
s = s.replace(old, new, 1)

old = '<Field label="Icon"><div className="flex flex-wrap gap-2">{EMOJIS.map((item) => <button key={item} type="button" onClick={() => { setEmoji(item); setEmojiTouched(true); }}'
new = '<Field label="Icon"><p className="mb-2 text-[10px] font-semibold text-muted-foreground">Auto-selected from the group name · tap any icon to override.</p><div className="flex flex-wrap gap-2">{EMOJIS.map((item) => <button key={item} type="button" onClick={() => { setEmoji(item); setEmojiTouched(true); }}'
if old not in s:
    raise SystemExit('New Group hint target missing')
s = s.replace(old, new, 1)

old = ": personal > 0 ? money(personal, group.currency) : '—'"
new = ": personal + selective > 0 ? money(personal + selective, group.currency) : '—'"
if old not in s:
    raise SystemExit('Selective-only display target missing')
s = s.replace(old, new, 1)

p.write_text(s)
print('Selective polish applied')
