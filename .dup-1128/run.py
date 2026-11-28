#!/usr/bin/env python3
"""Duplicate Words batch 1 (#2147): edit `keep` with additions, retire the rest.

Usage: run.py <first> <count>   (group indexes in batch1.json)
Each Word is written by its own `pnpm content` run; the log goes to stdout.
Exit 2 on a `needs new Recording` line (STUCK).
"""
import json, subprocess, sys, urllib.request, gzip, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONTENT = os.path.join(ROOT, 'tools', 'content')
SNAP = 'https://api.slovoapp.org/v1/editions/uk/content/snapshot'
MAX_SYN, MAX_EX = 4, 3


def snapshot():
    out = subprocess.run(['curl', '-sS', '--compressed', SNAP], capture_output=True, check=True).stdout
    return json.loads(out)


def record(wid):
    out = subprocess.run(['npx', 'tsx', os.path.join(HERE, 'record.ts'), wid],
                         cwd=CONTENT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def pnpm(*args):
    p = subprocess.run(['pnpm', '-s', 'content', *args], cwd=ROOT, capture_output=True, text=True)
    text = (p.stdout + p.stderr).strip()
    return p.returncode, text


def main():
    first, count = int(sys.argv[1]), int(sys.argv[2])
    groups = json.load(open(os.path.join(HERE, 'batch1.json')))['groups'][first:first + count]
    snap = snapshot()
    words = {w['id']: w for w in snap['words']}
    print(f'# snapshot content v{snap["contentVersion"]}')
    for n, g in enumerate(groups, start=first):
        ids = [g['keep'], *g['retire']]
        missing = [i for i in ids if i not in words or words[i].get('retired')]
        if missing:
            print(f'SKIP {n} {g["lemma"]}: not live {",".join(missing)}'); continue
        lemmas = {words[i]['lemma'] for i in ids}
        if len(lemmas) != 1 or g['lemma'] not in lemmas:
            print(f'SKIP {n} {g["lemma"]}: Lemmas differ {sorted(lemmas)}'); continue
        keep = words[g['keep']]
        fields = {k: v for k, v in keep.items() if k not in ('id',)}
        syn = list(fields.get('synonyms', []))
        have = {s.casefold() for s in syn} | {keep['lemma'].casefold()}
        for s in g['addSynonyms']:
            if len(syn) < MAX_SYN and s.casefold() not in have:
                syn.append(s); have.add(s.casefold())
        ex = list(fields.get('examples', []))
        texts = {e['text'].strip() for e in ex}
        for e in g['addExamples']:
            if len(ex) < MAX_EX and e['text'].strip() not in texts:
                ex.append(e); texts.add(e['text'].strip())
        if syn != fields.get('synonyms', []) or ex != fields.get('examples', []):
            rec = record(g['keep'])
            if {k: v for k, v in rec['fields'].items() if k != 'id'} != fields:
                print(f'SKIP {n} {g["lemma"]}: snapshot differs from the record'); continue
            new = dict(fields, synonyms=syn, examples=ex, recordVersion=rec['recordVersion'])
            assert new['lemma'] == keep['lemma'] and new['stress'] == keep['stress']
            path = os.path.join(HERE, 'edits', f'{g["keep"]}.json')
            os.makedirs(os.path.dirname(path), exist_ok=True)
            json.dump(new, open(path, 'w'), ensure_ascii=False, indent=1)
            code, text = pnpm('edit', 'word', g['keep'], path, '--edition', 'uk')
            print(f'EDIT {n} {g["lemma"]} {text}')
            if 'needs new Recording' in text:
                print('STUCK: needs new Recording'); sys.exit(2)
            if code != 0:
                print(f'REFUSAL {n}: retire not attempted'); continue
        else:
            print(f'NOEDIT {n} {g["lemma"]}')
        for r in g['retire']:
            code, text = pnpm('retire', 'word', r, '--edition', 'uk')
            print(f'RETIRE {n} {g["lemma"]} {text}')
            if 'needs new Recording' in text:
                print('STUCK: needs new Recording'); sys.exit(2)


main()
