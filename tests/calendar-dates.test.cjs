const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  mod._compile(result.outputText, filename);
};
const dates = require(path.join(__dirname, '../lib/integrations/calendar-dates.ts'));
if (previousLoader) require.extensions['.ts'] = previousLoader; else delete require.extensions['.ts'];

test('converts inclusive multi-day dates to Google Calendar exclusive end dates', () => {
  assert.deepEqual(dates.googleAllDayRange('2026-10-07', '2026-10-09'), {
    start: { date: '2026-10-07' }, end: { date: '2026-10-10' },
  });
  assert.deepEqual(dates.googleAllDayRange('2026-10-07'), {
    start: { date: '2026-10-07' }, end: { date: '2026-10-08' },
  });
});

test('handles month, year, and leap-day boundaries and rejects invalid ranges', () => {
  assert.equal(dates.nextCalendarDate('2026-12-31'), '2027-01-01');
  assert.equal(dates.nextCalendarDate('2024-02-29'), '2024-03-01');
  assert.equal(dates.previousCalendarDate('2026-10-10'), '2026-10-09');
  assert.equal(dates.previousCalendarDate('2027-01-01'), '2026-12-31');
  assert.throws(() => dates.googleAllDayRange('2026-10-09', '2026-10-07'), /range is invalid/);
  assert.throws(() => dates.nextCalendarDate('2026-02-30'), /date is invalid/);
});
