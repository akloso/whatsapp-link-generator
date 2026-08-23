from pathlib import Path

path = Path('src/features/splitzap/SplitzapAppV4.tsx')
text = path.read_text(encoding='utf-8')

old = ', document.body);'
new = ", document.querySelector<HTMLElement>('.splitzap-root') ?? document.body);"
count = text.count(old)
if count < 2:
    raise RuntimeError(f'Expected at least 2 Splitzap body portals, found {count}')

text = text.replace(old, new)

if text.count(new) != count:
    raise RuntimeError('Not all Splitzap portals were redirected into the scoped root')

path.write_text(text, encoding='utf-8')
print(f'Redirected {count} Splitzap portals into .splitzap-root.')
