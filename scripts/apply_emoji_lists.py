from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

old_lists = "const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']\nconst EMOJIS = ['🦊', '🐙', '🐼', '🦁', '🐬', '🦄', '🚀', '🎨', '⚽', '🎧', '🌟', '🛹']"
new_lists = """const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
const CHILD_EMOJIS = ['🦊', '🐙', '🐼', '🦁', '🐬', '🦄', '🚀', '🎨', '⚽', '🎧', '🌟', '🛹']
const TASK_EMOJIS = [
  '✨', '🧹', '🧽', '🧺', '🛏️', '🍽️',
  '🗑️', '📚', '🐕', '🌱', '🚿', '🚲',
  '🧸', '🧼', '🍳', '🥣', '🧤', '🪣',
  '🛒', '🧑‍🍳',
]"""

if text.count(old_lists) != 1:
    raise SystemExit('Expected emoji list block exactly once')
text = text.replace(old_lists, new_lists, 1)

selector = "{EMOJIS.map((emoji) => <option key={emoji}>{emoji}</option>)}"
if text.count(selector) != 2:
    raise SystemExit(f'Expected two emoji selector usages, found {text.count(selector)}')
text = text.replace(selector, "{TASK_EMOJIS.map((emoji) => <option key={emoji}>{emoji}</option>)}", 1)
text = text.replace(selector, "{CHILD_EMOJIS.map((emoji) => <option key={emoji}>{emoji}</option>)}", 1)
path.write_text(text)
