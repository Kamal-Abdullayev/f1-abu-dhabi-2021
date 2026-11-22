"""Replace lines [a, b] (1-based, inclusive) of a file with the contents of another file.
Usage: python3 -I splice.py <target> <a> <b> <replacement_file> <expect_start_substring> <expect_end_substring>"""
import sys

target, a, b, repl, exp_a, exp_b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5], sys.argv[6]
lines = open(target, encoding='utf-8').read().split('\n')
if exp_a not in lines[a - 1] or exp_b not in lines[b - 1]:
    raise SystemExit('guard failed:\n  line %d: %s\n  line %d: %s' % (a, lines[a - 1][:90], b, lines[b - 1][:90]))
new = open(repl, encoding='utf-8').read().rstrip('\n').split('\n')
lines[a - 1:b] = new
open(target, 'w', encoding='utf-8').write('\n'.join(lines))
print('replaced lines %d-%d with %d lines' % (a, b, len(new)))
