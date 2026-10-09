import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sched = JSON.parse(await readFile(new URL('../public/schedule.json', import.meta.url), 'utf8'));
const s = sched.sessions;

test('Level 3 schedule is removed', () => {
  assert.equal(s.filter((x) => /DH ?3\d\d/.test(x.title) || x.code?.startsWith('DH3')).length, 0);
  assert.equal(s.filter((x) => x.date === '2026-10-17').length, 0);
});

test('every timed session is well formed', () => {
  const ids = new Set();
  for (const x of s) {
    assert.match(x.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!ids.has(x.id), 'duplicate id ' + x.id);
    ids.add(x.id);
    if (x.allDay) continue;
    assert.ok(x.start < x.end, `${x.date} ${x.title}`);
    assert.ok(['online', 'in-person', 'unspecified'].includes(x.mode), x.mode);
  }
});

test('spot checks against the PDF', () => {
  const find = (date, code, start) => s.find((x) => x.date === date && (x.code ?? null) === code && x.start === start);
  assert.equal(find('2026-10-05', 'L1O', '08:00')?.end, '12:00'); // orientation
  const lab = find('2026-10-27', 'DH113', '17:30');
  assert.deepEqual(lab.group, { type: 'rad', values: ['A2'] });
  assert.equal(lab.mode, 'in-person');
  const pre = find('2026-10-13', 'DH101', '09:30');
  assert.deepEqual(pre.group, { type: 'pre', values: ['A'] });
  assert.equal(find('2026-12-16', 'DH106', '08:00').kind, 'exam');
  assert.equal(find('2026-11-18', 'DH103', '14:00').detail, 'Test 1');
});
