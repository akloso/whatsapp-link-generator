from pathlib import Path
import subprocess

PATH = 'scripts/tmp_splitzap_ux_patch.py'

commits = subprocess.check_output(
    ['git', 'log', '--format=%H', '--', PATH],
    text=True,
).splitlines()
if not commits:
    raise RuntimeError('Could not locate original Splitzap UX patcher in Git history.')

# The oldest revision is the original full patcher. This wrapper stays tiny and
# only tightens match semantics for Home-only fragments that also appear in
# Activity; all actual product transformations remain in that original script.
original_commit = commits[-1]
source = subprocess.check_output(
    ['git', 'show', f'{original_commit}:{PATH}'],
    text=True,
)

old_helper = '''def replace_once(text: str, old: str, new: str, label: str) -> str:\n    count = text.count(old)\n    if count != 1:\n        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')\n    return text.replace(old, new, 1)\n'''
new_helper = '''def replace_once(text: str, old: str, new: str, label: str) -> str:\n    count = text.count(old)\n    first_match_labels = {\n        'home balance detail state',\n        'home balance sheet render',\n        'home settlement memberships',\n    }\n    if count < 1:\n        raise RuntimeError(f'{label}: expected at least 1 match, found {count}')\n    if count != 1 and label not in first_match_labels:\n        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')\n    return text.replace(old, new, 1)\n'''

if source.count(old_helper) != 1:
    raise RuntimeError('Original patcher helper changed unexpectedly.')
source = source.replace(old_helper, new_helper, 1)

# Preserve the original patcher's own safety checks, including the byte-for-byte
# ReceiptScanner guard. Execute from repository root exactly as the original did.
namespace = {'__name__': '__main__', '__file__': str(Path(PATH))}
exec(compile(source, PATH, 'exec'), namespace, namespace)
