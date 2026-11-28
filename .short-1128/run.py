#!/usr/bin/env python3
"""Short Definitions write (#2147): edit each Word in plan.json with its `now`.

Usage: run.py <first> <count> <log-index>
Pattern of record()/pnpm() from .dup-1128/run.py. Exit 2 on STUCK.
"""
import json, subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONTENT = os.path.join(ROOT, 'tools', 'content')
RECORD = os.path.join(ROOT, '.dup-1128', 'record.ts')
SNAP = 'https://api.slovoapp.org/v1/editions/uk/content/snapshot'


def snapshot():
    out = subprocess.run(['curl', '-sS', '--compressed', SNAP], capture_output=True, check=True).stdout
    return json.loads(out)


def record(wid):
    out = subprocess.run(['npx', 'tsx', RECORD, wid],
                         cwd=CONTENT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def pnpm(*args):
    p = subprocess.run(['pnpm', '-s', 'content', *args], cwd=ROOT, capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr).strip()


def main():
    first, count, n_log = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    plan = json.load(open(os.path.join(HERE, 'plan.json')))[first:first + count]
    log = open(os.path.join(HERE, f'log-{n_log}.txt'), 'a')
    def say(s):
        print(s); log.write(s + '\n'); log.flush()
    snap = snapshot()
    words = {w['id']: w for w in snap['words']}
    say(f'# snapshot content v{snap["contentVersion"]}, plan[{first}:{first + count}]')
    for n, p in enumerate(plan, start=first):
        w = words.get(p['id'])
        if w is None or w.get('retired'):
            say(f'SKIP {n} {p["id"]} {p["lemma"]}: not live'); continue
        if w.get('shortDefinition') == p['now']:
            say(f'DONE {n} {p["id"]} {p["lemma"]}'); continue
        rec = record(p['id'])
        if rec['fields'] != w:
            say(f'SKIP {n} {p["id"]} {p["lemma"]}: record differs from the snapshot'); continue
        new = {k: v for k, v in rec['fields'].items() if k != 'id'}
        new['shortDefinition'] = p['now']
        new['recordVersion'] = rec['recordVersion']
        assert new['lemma'] == w['lemma'] and new['stress'] == w['stress']
        path = os.path.join(HERE, 'edits', f'{p["id"]}.json')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        json.dump(new, open(path, 'w'), ensure_ascii=False, indent=1)
        code, text = pnpm('edit', 'word', p['id'], path, '--edition', 'uk')
        say(f'EDIT {n} {p["id"]} {p["lemma"]} [{code}] {" | ".join(text.splitlines())}')
        if 'needs new Recording' in text:
            say('STUCK: needs new Recording'); sys.exit(2)
        if code != 0:
            say(f'REFUSED {n} {p["id"]}')
            if 'shortDefinition' in text and ('nrecognized' in text or 'nknown' in text) and 'REFUSED ' not in text:
                say('STUCK: shortDefinition looks unknown to the backend'); sys.exit(2)


main()
