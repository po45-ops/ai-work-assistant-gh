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
const { parseInboxDraft } = require(path.join(__dirname, '../lib/inbox/analysis.ts'));
if (previousLoader) require.extensions['.ts'] = previousLoader; else delete require.extensions['.ts'];

function draft(overrides = {}) {
  return {
    kind: 'event', title: 'สอบปลายภาค', summary: 'สอบปลายภาคการศึกษา', description: '', goal: '', priority: 'medium',
    start_date: '2026-10-07', due_date: null, end_date: '2026-10-09', start_time: null, end_time: null,
    estimated_minutes: null, clarification_question: null, milestones: [], tasks: [], ...overrides,
  };
}

test('accepts an inclusive multi-day all-day event draft in ISO dates', () => {
  const result = parseInboxDraft(draft());
  assert.equal(result.data.start_date, '2026-10-07');
  assert.equal(result.data.end_date, '2026-10-09');
  assert.equal(result.data.kind, 'event');
});

test('rejects impossible dates, reverse ranges, and timed multi-day events', () => {
  assert.match(parseInboxDraft(draft({ start_date: '2026-02-30' })).error, /วันที่ไม่ถูกต้อง/);
  assert.match(parseInboxDraft(draft({ start_date: '2026-10-09', end_date: '2026-10-07' })).error, /วันสิ้นสุด/);
  assert.match(parseInboxDraft(draft({ start_time: '09:00' })).error, /ทั้งวัน/);
});

test('requires a date before creating a calendar event and limits project contents', () => {
  assert.match(parseInboxDraft(draft({ start_date: null })).error, /ระบุวันนัดหมาย/);
  const result = parseInboxDraft(draft({
    kind: 'project', end_date: null,
    milestones: [{ name: 'เตรียมการ', due_date: null }],
    tasks: [{ title: 'เตรียมเอกสาร', due_date: null, estimated_minutes: 60, priority: 'high', milestone_index: 0 }],
  }));
  assert.equal(result.data.tasks.length, 1);
  assert.equal(result.data.tasks[0].estimated_minutes, 60);
  assert.equal(result.data.tasks[0].milestone_index, 0);
  assert.match(parseInboxDraft(draft({ kind: 'project', milestones: [{ name: 'ระยะหนึ่ง' }], tasks: [{ title: 'งาน', milestone_index: 1 }] })).error, /หมุดหมายที่ไม่มีอยู่/);
});

test('does not accept empty tasks or malformed task dates', () => {
  assert.match(parseInboxDraft(draft({ kind: 'task', title: '   ' })).error, /ชื่อหรือวันที่/);
  assert.match(parseInboxDraft(draft({ kind: 'task', tasks: [], due_date: null, title: 'ทำเอกสาร' , estimated_minutes: 'lots' })).error, /ชื่อหรือวันที่/);
});
