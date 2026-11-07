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
const { parseTaskInput, parseTaskFilters, isDate, escapeSearch, taskQuery } = require(path.join(__dirname, '../lib/tasks/validation.ts'));
if (previousLoader) require.extensions['.ts'] = previousLoader; else delete require.extensions['.ts'];
function input(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: 'เตรียมข้อสอบ', status: 'not_started', priority: 'medium', ...values })) data.set(key, value);
  return data;
}
test('optional fields remain null; zero estimated minutes is preserved', () => {
  const parsed = parseTaskInput(input());
  assert.equal(parsed.data.title, 'เตรียมข้อสอบ');
  assert.equal(parsed.data.due_date, null);
  assert.equal(parsed.data.project_id, null);
  assert.equal(parsed.data.estimated_minutes, null);
  assert.equal(parseTaskInput(input({ estimated_minutes: '0' })).data.estimated_minutes, 0);
});
test('reject invalid statuses, dates, foreign ID shapes and estimated minutes', () => {
  for (const fields of [{title:'  '},{title:'x'.repeat(201)},{status:'completed'},{priority:'urgent'},{due_date:'2026-02-30'},{project_id:'not-a-uuid'},{estimated_minutes:'-1'},{estimated_minutes:'1.5'},{estimated_minutes:'Infinity'},{estimated_minutes:'2147483648'}]) assert.ok(parseTaskInput(input(fields)).error, JSON.stringify(fields));
  assert.equal(isDate('2024-02-29'), true);
  assert.equal(isDate('2026-02-29'), false);
});
test('valid project/date/status survive parsing and title is trimmed', () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const {data} = parseTaskInput(input({title:'  ส่งรายงาน  ',due_date:'2026-10-05',project_id:id,status:'done',estimated_minutes:'90'}));
  assert.equal(data.title,'ส่งรายงาน'); assert.equal(data.project_id,id); assert.equal(data.status,'done'); assert.equal(data.estimated_minutes,90);
});
test('malformed pagination and duplicated query parameters are bounded', () => {
  for (const page of ['-1','Infinity','1.5','100001','1e309']) assert.equal(parseTaskFilters({page}).page,1);
  assert.equal(parseTaskFilters({page:'2'}).page,2);
  assert.equal(parseTaskFilters({status:['done','in_progress'],priority:'urgent',project:'other',due:'bad'}).status,'all');
});
test('search metacharacters are literal and URL filters round trip', () => {
  assert.equal(escapeSearch('50%_\\'), '50\\%\\_\\\\');
  const filters = parseTaskFilters({search:'ข้อสอบ & รายงาน',status:'done',priority:'high',due:'today',page:'2'});
  const url = new URL(taskQuery(filters), 'https://example.com');
  assert.equal(url.pathname,'/protected/tasks');
  assert.equal(url.searchParams.get('search'),'ข้อสอบ & รายงาน');
  assert.equal(url.searchParams.get('status'),'done');
  assert.equal(url.searchParams.get('page'),'2');
  assert.equal(taskQuery(filters,1).includes('page='),false);
});
