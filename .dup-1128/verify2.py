#!/usr/bin/env python3
"""Checks batch 2 in a fresh snapshot: verify2.py [count] (first `count` groups, default all)."""
import json, subprocess, sys, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = json.load(open(os.path.join(HERE, 'batch2.json')))
SNAP = 'https://api.slovoapp.org/v1/editions/uk/content/snapshot'
snap = json.loads(subprocess.run(['curl', '-sS', '--compressed', SNAP], capture_output=True, check=True).stdout)
words = {w['id']: w for w in snap['words']}
count = int(sys.argv[1]) if len(sys.argv) > 1 else len(PLAN['groups'])
bad = []
for g in PLAN['groups'][:count]:
    k = words.get(g['keep'])
    if k is None or k.get('retired'):
        bad.append(f'{g["lemma"]}: keep {g["keep"]} not live'); continue
    for f in ('synonyms', 'examples', 'extraDefinitions', 'categoryId', 'etymology'):
        if g.get(f) is not None and k.get(f) != g[f]:
            bad.append(f'{g["lemma"]}: {f} differs')
    for r in g['retire']:
        if not words.get(r, {}).get('retired'):
            bad.append(f'{g["lemma"]}: {r} not retired')
if count == len(PLAN['groups']):
    for b in PLAN['batch1EtymologyBackfill']:
        if words.get(b['id'], {}).get('etymology') != b['etymology']:
            bad.append(f'{b["lemma"]}: backfill etymology differs')
live = Counter(w['lemma'] for w in snap['words'] if not w.get('retired'))
twice = sorted(l for l, c in live.items() if c >= 2)
print(f'# snapshot content v{snap["contentVersion"]}')
print(f'# checked groups {count}; problems {len(bad)}; Lemmas live twice or more {len(twice)}')
for b in bad:
    print('BAD', b)
