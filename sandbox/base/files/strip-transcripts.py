#!/usr/bin/env python3
"""Copy Claude Code's transcripts without their text (PH-49, ADR 0076).

    python3 strip-transcripts.py SRC DEST

Mirrors every *.jsonl and *.meta.json under SRC to the same path under DEST. A transcript
line keeps only the fields scripts/token-usage.py's load_calls reads; a field added there
must be kept here too. A line that does not parse (one still being written) is skipped.
A copy is rewritten only when its source is newer. Standard library only.
"""
import json
import os
import sys

LINE_KEYS = ('type', 'timestamp', 'requestId', 'gitBranch')
MESSAGE_KEYS = ('id', 'model', 'usage')


def pick(d, keys):
    return {k: d[k] for k in keys if k in d}


def strip_jsonl(fh):
    for line in fh:
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if not isinstance(d, dict):
            continue
        out = pick(d, LINE_KEYS)
        if isinstance(d.get('message'), dict):
            out['message'] = pick(d['message'], MESSAGE_KEYS)
        yield json.dumps(out) + '\n'


def strip_meta(fh):
    yield json.dumps(pick(json.load(fh), ('description',)))


def copy(src, dest, strip):
    mtime = os.stat(src).st_mtime_ns
    if os.path.exists(dest) and os.stat(dest).st_mtime_ns >= mtime:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.tmp'
    with open(src) as fin, open(tmp, 'w') as fout:
        fout.writelines(strip(fin))
    os.utime(tmp, ns=(mtime, mtime))
    os.replace(tmp, dest)


def main(src, dest):
    for folder, _, names in os.walk(src):
        for name in names:
            if name.endswith('.meta.json'):
                strip = strip_meta
            elif name.endswith('.jsonl'):
                strip = strip_jsonl
            else:
                continue
            path = os.path.join(folder, name)
            copy(path, os.path.join(dest, os.path.relpath(path, src)), strip)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('usage: strip-transcripts.py SRC DEST')
    main(*sys.argv[1:])
