#!/usr/bin/env python3
"""Checks a fresh snapshot after batch 3 and the link backfill (#2147): every retired copy of
batches 1-3 is Retired with replacedBy = its keep, no keep is Retired, needsNewRecording is empty."""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SNAP = 'https://api.slovoapp.org/v1/editions/uk/content/snapshot'
snap = json.loads(subprocess.run(['curl', '-sS', '--compressed', SNAP], capture_output=True, check=True).stdout)
words = {w['id']: w for w in snap['words']}
bad, n = [], 0
for name in ('batch1.json', 'batch2.json', 'batch3.json'):
    for g in json.load(open(os.path.join(HERE, name)))['groups']:
        if words.get(g['keep'], {}).get('retired', True):
            bad.append(f'keep {g["keep"]} {g["lemma"]} not live')
        for r in g['retire']:
            n += 1
            w = words.get(r, {})
            if not w.get('retired') or w.get('replacedBy') != g['keep']:
                bad.append(f'{r} {g["lemma"]} retired={w.get("retired")} replacedBy={w.get("replacedBy")}')
print(f'# content v{snap["contentVersion"]} retired copies {n} needsNewRecording {len(snap["needsNewRecording"])}')
for b in bad:
    print('BAD', b)
print('# OK' if not bad and not snap['needsNewRecording'] else f'# BAD {len(bad)}')
sys.exit(1 if bad or snap['needsNewRecording'] else 0)
