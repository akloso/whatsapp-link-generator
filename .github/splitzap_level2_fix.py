from pathlib import Path

path = Path('src/features/splitzap/SplitzapCloudApp.tsx')
text = path.read_text()
text = text.replace("""        group={shareGroupId ? data.groups.find((item) => item.id === shareGroupId) ?? null : null}\n        data={data}\n        onClose={() => setShareGroupId(null)}""", """        group={shareGroupId ? data.groups.find((item) => item.id === shareGroupId) ?? null : null}\n        onClose={() => setShareGroupId(null)}""", 1)
text = text.replace("""function SharedGroupInviteSheet({ open, group, data, onClose, onEnable }: {\n  open: boolean;\n  group: Group | null;\n  data: SplitData;\n  onClose: () => void;""", """function SharedGroupInviteSheet({ open, group, onClose, onEnable }: {\n  open: boolean;\n  group: Group | null;\n  onClose: () => void;""", 1)
path.write_text(text)
