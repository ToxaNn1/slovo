#!/usr/bin/env python3
"""Duplicate Words batch 3 (#2147): edit `keep` to the planned fields, retire the rest,
each with `--replaced-by <keep>` (ADR 0214), then link batches 1 and 2's Retired copies to their keep.

Usage: run3.py dry | run3.py write <first> <count> | run3.py link [count]
  dry       checks every group and link against a fresh snapshot and the API records, writes nothing
  write     runs groups [first, first+count) of batch3.json
  link      retires again, with `--replaced-by <keep>`, every Retired copy of batch1/batch2 without the link
Each Word is written by its own `pnpm content` run; the log goes to stdout.
Exit 2 on a `needs new Recording` line (STUCK).
"""
import json, subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONTENT = os.path.join(ROOT, 'tools', 'content')
SNAP = 'https://api.slovoapp.org/v1/editions/uk/content/snapshot'
EDITS = os.environ.get('DUP_EDITS', os.path.join(HERE, 'edits3'))
MAX_SYN, MAX_EX = 4, 3
PLAN = json.load(open(os.path.join(HERE, 'batch3.json')))


def snapshot():
    out = subprocess.run(['curl', '-sS', '--compressed', SNAP], capture_output=True, check=True).stdout
    return json.loads(out)


def record(wid):
    out = subprocess.run(['npx', 'tsx', os.path.join(HERE, 'record.ts'), wid],
                         cwd=CONTENT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def pnpm(*args):
    p = subprocess.run(['pnpm', '-s', 'content', *args], cwd=ROOT, capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr).strip()


def stuck(text):
    if 'needs new Recording' in text:
        print('STUCK: needs new Recording', flush=True); sys.exit(2)


def has_etym(w):
    return bool((w.get('etymology') or '').strip())


def planned(g, keep):
    """The kept Word's fields after the plan, and notes on fields left alone."""
    new = {k: v for k, v in keep.items() if k != 'id'}
    notes = []
    if g['synonyms'] is not None:
        assert len(g['synonyms']) <= MAX_SYN, g['lemma']
        new['synonyms'] = g['synonyms']
    if g['examples'] is not None:
        assert len(g['examples']) <= MAX_EX, g['lemma']
        new['examples'] = g['examples']
    if g.get('etymology') is not None:
        if has_etym(keep):
            notes.append('etymology kept (already set)')
        else:
            new['etymology'] = g['etymology']
    if g.get('extraDefinitions') is not None:
        new['extraDefinitions'] = g['extraDefinitions']
    if g.get('categoryId') is not None:
        new['categoryId'] = g['categoryId']
    return new, notes


def edit(wid, new, keep, dry):
    """Guards, then one `pnpm content edit`. Returns (ok, text)."""
    rec = record(wid)
    if {k: v for k, v in rec['fields'].items() if k != 'id'} != {k: v for k, v in keep.items() if k != 'id'}:
        return False, 'snapshot differs from the record'
    assert new['lemma'] == keep['lemma'] and new['stress'] == keep['stress']
    if dry:
        return True, f'would edit (record v{rec["recordVersion"]})'
    body = dict(new, recordVersion=rec['recordVersion'])
    path = os.path.join(EDITS, f'{wid}.json')
    os.makedirs(EDITS, exist_ok=True)
    json.dump(body, open(path, 'w'), ensure_ascii=False, indent=1)
    code, text = pnpm('edit', 'word', wid, path, '--edition', 'uk')
    stuck(text)
    return code == 0, text


def groups(first, count, dry):
    snap = snapshot()
    words = {w['id']: w for w in snap['words']}
    print(f'# snapshot content v{snap["contentVersion"]}', flush=True)
    stats = dict(groups=0, ok=0, edits=0, noedit=0, retires=0, skips=0, refusals=0)
    for n, g in enumerate(PLAN['groups'][first:first + count], start=first):
        stats['groups'] += 1
        ids = [g['keep'], *g['retire']]
        missing = [i for i in ids if i not in words or words[i].get('retired')]
        if missing:
            stats['skips'] += 1
            print(f'SKIP {n} {g["lemma"]}: not live {",".join(missing)}', flush=True); continue
        lemmas = {words[i]['lemma'] for i in ids}
        if len(lemmas) != 1 or g['lemma'] not in lemmas:
            stats['skips'] += 1
            print(f'SKIP {n} {g["lemma"]}: Lemmas differ {sorted(lemmas)}', flush=True); continue
        keep = words[g['keep']]
        new, notes = planned(g, keep)
        for note in notes:
            print(f'NOTE {n} {g["lemma"]} {g["keep"]}: {note}', flush=True)
        if new != {k: v for k, v in keep.items() if k != 'id'}:
            ok, text = edit(g['keep'], new, keep, dry)
            print(f'EDIT {n} {g["lemma"]} {text}', flush=True)
            if not ok:
                stats['refusals'] += 1
                print(f'REFUSAL {n}: retire not attempted', flush=True); continue
            stats['edits'] += 1
        else:
            stats['noedit'] += 1
            print(f'NOEDIT {n} {g["lemma"]}', flush=True)
        stats['ok'] += 1
        for r in g['retire']:
            if dry:
                text = f'{r} would retire'
            else:
                code, text = pnpm('retire', 'word', r, '--replaced-by', g['keep'], '--edition', 'uk')
                stuck(text)
                if code != 0:
                    print(f'REFUSAL {n} retire {r}: {text}', flush=True); stats['refusals'] += 1; continue
            stats['retires'] += 1
            print(f'RETIRE {n} {g["lemma"]} {text}', flush=True)
    print(f'# groups {stats}', flush=True)
    return stats


def link(dry, limit=None):
    snap = snapshot()
    words = {w['id']: w for w in snap['words']}
    print(f'# snapshot content v{snap["contentVersion"]}', flush=True)
    stats = dict(links=0, already=0, skips=0, refusals=0)
    for name in ('batch1.json', 'batch2.json'):
        for g in json.load(open(os.path.join(HERE, name)))['groups']:
            keep = words.get(g['keep'])
            for r in g['retire']:
                w = words.get(r)
                if w is None or not w.get('retired'):
                    stats['skips'] += 1
                    print(f'SKIP link {name} {g["lemma"]} {r}: not Retired', flush=True); continue
                if w.get('replacedBy'):
                    stats['already'] += 1; continue
                if keep is None or keep.get('retired'):
                    stats['skips'] += 1
                    print(f'SKIP link {name} {g["lemma"]} {r}: keep {g["keep"]} not live', flush=True); continue
                if limit is not None and stats['links'] + stats['refusals'] >= limit:
                    continue
                if dry:
                    text = f'{r} would link to {g["keep"]}'
                else:
                    code, text = pnpm('retire', 'word', r, '--replaced-by', g['keep'], '--edition', 'uk')
                    stuck(text)
                    if code != 0:
                        stats['refusals'] += 1
                        print(f'REFUSAL link {g["lemma"]} {r}: {text}', flush=True); continue
                stats['links'] += 1
                print(f'LINK {g["lemma"]} {r} -> {g["keep"]} {text}', flush=True)
    print(f'# link {stats}', flush=True)
    return stats


def main():
    mode = sys.argv[1]
    if mode == 'dry':
        g = groups(0, len(PLAN['groups']), True)
        link(True)
        retires = sum(len(x['retire']) for x in PLAN['groups'])
        print(f'# plan groups {len(PLAN["groups"])} retires {retires}')
        if (len(PLAN['groups']), retires) != (11, 11) or g['ok'] != 11 or g['retires'] != 11:
            print('COUNTS DIFFER'); sys.exit(1)
        print('# counts match')
    elif mode == 'write':
        groups(int(sys.argv[2]), int(sys.argv[3]), False)
    elif mode == 'link':
        link(False, int(sys.argv[2]) if len(sys.argv) > 2 else None)


main()
