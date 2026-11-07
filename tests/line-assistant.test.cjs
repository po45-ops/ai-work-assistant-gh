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
const assistant = require(path.join(__dirname, '../lib/integrations/line-assistant.ts'));
if (previousLoader) require.extensions['.ts'] = previousLoader; else delete require.extensions['.ts'];

test('answers time requests deterministically in Bangkok time', () => {
  assert.deepEqual(assistant.bangkokDateTime(new Date('2026-09-27T11:05:00.000Z')), { date: '2026-09-27', time: '18:05' });
  assert.equal(assistant.isTimeQuestion('ตอนนี้กี่โมงแล้ว'), true);
  assert.equal(assistant.isTimeQuestion('ช่วยนัดประชุมเวลา 18:00'), false);
});

test('recognizes practical LINE requests for remaining and urgent tasks', () => {
  assert.equal(assistant.isTaskSummaryQuestion('ตอนนี้เหลืองานอะไรบ้าง'), true);
  assert.equal(assistant.isTaskSummaryQuestion('งานไหนควรรีบทำก่อน'), true);
  assert.equal(assistant.isTaskSummaryQuestion('คุยเรื่องหนังกัน'), false);
});

test('recognizes friendly presence and name questions', () => {
  assert.equal(assistant.isPresenceGreeting('นี่เธอ'), true);
  assert.equal(assistant.isPresenceGreeting('หวัดดี'), true);
  assert.equal(assistant.isPresenceGreeting('สวัสดีครับ'), true);
  assert.equal(assistant.isAssistantNameQuestion('แล้วเธอชื่ออะไร'), true);
  assert.equal(assistant.isAssistantNameQuestion('คุณชื่ออะไร'), true);
  assert.equal(assistant.isAssistantNameQuestion('เล่าเรื่องชื่อดอกไม้'), false);
  assert.equal(assistant.isAssistantNameQuestion('คุณโปชื่ออะไร'), true);
  assert.equal(assistant.isPresenceGreeting('โป'), true);
});

test('accepts valid JSON and keeps action-bearing replies structured', () => {
  assert.deepEqual(assistant.parseAiResponse('```json\n{"reply":"คุยได้เลย","action":null}\n```'), { reply: 'คุยได้เลย', action: null });
  assert.deepEqual(assistant.parseAiResponse('{"reply":"เพิ่มงานให้หน่อย","action":{"type":"create_task","title":"ส่งรายงาน"}}'), { reply: 'เพิ่มงานให้หน่อย', action: { type: 'create_task', title: 'ส่งรายงาน' } });
  assert.deepEqual(assistant.parseAiResponse('{"reply":"ขอทวนก่อนนะ","transcript":"พรุ่งนี้ประชุมบ่ายสอง","action":{"type":"reschedule_event","title":"ประชุม","current_date":"2026-09-28","current_start_time":"13:00","new_date":"2026-09-29","new_start_time":"14:00","new_end_time":null}}'), {
    reply: 'ขอทวนก่อนนะ',
    transcript: 'พรุ่งนี้ประชุมบ่ายสอง',
    action: { type: 'reschedule_event', title: 'ประชุม', current_date: '2026-09-28', current_start_time: '13:00', new_date: '2026-09-29', new_start_time: '14:00', new_end_time: null },
  });
});

test('sends long LINE conversations to Gemini starting and ending with the user', () => {
  const history = Array.from({ length: 18 }, (_, index) => ({
    role: index % 2 === 0 ? 'assistant' : 'user',
    content: `message ${index}`,
  }));
  history[17] = { role: 'user', content: 'ดูข้อมูลหน่อย' };
  const turns = assistant.normalizeLineHistory(history);
  assert.equal(turns[0].role, 'user');
  assert.equal(turns[turns.length - 1].role, 'user');
  assert.equal(turns[turns.length - 1].content, 'ดูข้อมูลหน่อย');
  for (let index = 1; index < turns.length; index++) {
    assert.notEqual(turns[index].role, turns[index - 1].role);
  }
});

test('combines consecutive turns of the same role and ignores blank messages', () => {
  assert.deepEqual(assistant.normalizeLineHistory([
    { role: 'assistant', content: 'older reply' },
    { role: 'user', content: 'first question' },
    { role: 'user', content: 'follow-up detail' },
    { role: 'assistant', content: 'answer' },
    { role: 'assistant', content: '  ' },
    { role: 'user', content: 'ดูข้อมูลหน่อย' },
  ]), [
    { role: 'user', content: 'first question\n\nfollow-up detail' },
    { role: 'assistant', content: 'answer' },
    { role: 'user', content: 'ดูข้อมูลหน่อย' },
  ]);
});

test('does not teach Gemini to repeat earlier service failure replies', () => {
  assert.deepEqual(assistant.normalizeLineHistory([
    { role: 'user', content: 'จากข้อ บันทึกเลย' },
    { role: 'assistant', content: 'เมื่อกี้โปต่อบริการตอบคำถามไม่ติด ลองส่งมาอีกทีได้ไหม 🙂' },
    { role: 'user', content: 'บันทึกให้หน่อย' },
    { role: 'assistant', content: 'เพิ่มนัดหมายแล้วครับ' },
    { role: 'user', content: 'ดูข้อมูลหน่อย' },
  ]), [
    { role: 'user', content: 'จากข้อ บันทึกเลย\n\nบันทึกให้หน่อย' },
    { role: 'assistant', content: 'เพิ่มนัดหมายแล้วครับ' },
    { role: 'user', content: 'ดูข้อมูลหน่อย' },
  ]);
});

test('validates multi-day all-day Calendar actions and shows the inclusive date range', () => {
  const action = assistant.validateLineAction({
    type: 'create_event', title: 'การสอบปลายภาคการศึกษา', date: '2026-10-07', end_date: '2026-10-09',
    start_time: null, end_time: null,
  });
  assert.deepEqual(action, {
    type: 'create_event', title: 'การสอบปลายภาคการศึกษา', description: '', date: '2026-10-07', end_date: '2026-10-09',
    start_time: null, end_time: null,
  });
  assert.match(assistant.actionConfirmationText(action), /ช่วงวันที่ 7 ตุลาคม 2569 ถึง 9 ตุลาคม 2569/);
  assert.match(assistant.actionConfirmationText(action), /นัดครั้งเดียว ไม่ทำซ้ำ/);
  assert.equal(assistant.validateLineAction({
    type: 'create_event', title: 'ช่วงวันผิด', date: '2026-10-09', end_date: '2026-10-07', start_time: null, end_time: null,
  }), null);
  assert.equal(assistant.validateLineAction({
    type: 'create_event', title: 'ช่วงวันมีเวลา', date: '2026-10-07', end_date: '2026-10-09', start_time: '09:00', end_time: '10:00',
  }), null);
});

test('validates LINE project plans and previews milestones and child tasks before confirmation', () => {
  const project = assistant.validateLineAction({
    type: 'create_project', name: 'จัดทำรายงาน', goal: 'ส่งรายงานให้ครบ', description: '', target_date: '2026-12-01', priority: 'high',
    milestones: [{ name: 'รวบรวมข้อมูล', description: '', due_date: '2026-10-15' }],
    tasks: [{ title: 'รวบรวมเอกสาร', description: '', due_date: '2026-10-10', priority: 'high', estimated_minutes: 90, milestone_index: 0 }],
  });
  assert.equal(project.type, 'create_project');
  assert.match(assistant.actionConfirmationText(project), /สร้างโปรเจกต์ “จัดทำรายงาน”/);
  assert.match(assistant.actionConfirmationText(project), /รวบรวมข้อมูล/);
  assert.match(assistant.actionConfirmationText(project), /รวบรวมเอกสาร/);
  assert.equal(assistant.validateLineAction({
    type: 'create_project', name: 'แผน', priority: 'medium', target_date: null,
    milestones: [{ name: 'ระยะหนึ่ง' }],
    tasks: [{ title: 'งาน', due_date: null, priority: 'medium', estimated_minutes: null, milestone_index: 1 }],
  }), null);
});

test('keeps pending actions for corrections and accepts natural confirmation with one-time clarification', () => {
  const action = { type: 'create_event', title: 'การสอบ', description: '', date: '2026-10-07', end_date: '2026-10-09', start_time: null, end_time: null };
  assert.equal(assistant.pendingActionIntent('วันที่เจ็ดถึงเก้าตุลา 2569', action), null);
  assert.equal(assistant.pendingActionIntent('โอเคบันทึกเลย บันทึกแค่เฉพาะครั้งนี้ครั้งเดียวครับ ปีหน้าไม่ต้อง', action), 'confirm');
  assert.equal(assistant.pendingActionIntent('ตกลง แต่ทำครั้งนี้ครั้งเดียว ปีหน้าไม่ต้องซ้ำ', action), 'confirm');
  assert.equal(assistant.pendingActionIntent('โอเค แต่เลื่อนเป็นวันที่ 10 ตุลาคม', action), null);
  assert.equal(assistant.pendingActionIntent('ยกเลิก', action), 'cancel');
  assert.equal(assistant.isPendingActionCorrection('วันที่เจ็ดถึงเก้าตุลา 2569'), true);
  assert.equal(assistant.isPendingActionCorrection('เดือนตุลาครับ เมื่อกี้ผมพูดผิด'), true);
  assert.equal(assistant.isPendingActionCorrection('คุยเรื่องหนังกัน'), false);
  assert.equal(assistant.isPendingActionCorrection('โอเค บันทึกครั้งนี้ครั้งเดียว ปีหน้าไม่ต้อง'), false);
  assert.equal(assistant.looksLikeActionConfirmation('ขอยืนยันก่อนนะครับ: สร้างนัดหมายใน Google Calendar'), true);
  assert.equal(assistant.looksLikeActionConfirmation('ตอนนี้เวลา 10:54 น.'), false);
});

test('falls back to plain text safely when Gemini omits valid JSON', () => {
  assert.deepEqual(assistant.parseAiResponse('เราอยู่นี่นะ 😄'), { reply: 'เราอยู่นี่นะ 😄', action: null });
  assert.deepEqual(assistant.parseAiResponse('{"reply":"ขอถามเพิ่ม\\nได้ไหม", "action":'), { reply: 'ขอถามเพิ่ม\nได้ไหม', action: null });
  assert.equal(assistant.parseAiResponse('{"action":{"type":"create_task"'), null);
  assert.equal(assistant.parseAiResponse('เพิ่มงาน “ส่งรายงาน” ให้แล้วครับ'), null);
  assert.equal(assistant.parseAiResponse('   '), null);
});

test('prioritizes overdue, today, next three days, then high priority', () => {
  const text = assistant.formatTaskDigest([
    { title: 'เลยกำหนด', due_date: '2026-09-25', priority: 'medium' },
    { title: 'กำหนดวันนี้', due_date: '2026-09-27', priority: 'low' },
    { title: 'ภายในสามวัน', due_date: '2026-09-30', priority: 'medium' },
    { title: 'สำคัญไม่มีวัน', due_date: null, priority: 'high' },
    { title: 'ทำเสร็จแล้ว', due_date: '2026-09-27', priority: 'high', status: 'done' },
    { title: 'ยกเลิกแล้ว', due_date: '2026-09-27', priority: 'high', status: 'cancelled' },
    { title: 'เก็บเข้าคลัง', due_date: '2026-09-27', priority: 'high', archived_at: '2026-09-26T12:00:00Z' },
  ], '2026-09-27');
  assert.ok(text.indexOf('เลยกำหนด') < text.indexOf('กำหนดวันนี้'));
  assert.ok(text.indexOf('กำหนดวันนี้') < text.indexOf('ภายในสามวัน'));
  assert.ok(text.indexOf('ภายในสามวัน') < text.indexOf('สำคัญไม่มีวัน'));
  assert.doesNotMatch(text, /ทำเสร็จแล้ว|ยกเลิกแล้ว|เก็บเข้าคลัง/);
});

test('reports a clear empty state when there are no open tasks', () => {
  assert.match(assistant.formatTaskDigest([{ title: 'เสร็จ', due_date: null, priority: 'low', status: 'done' }], '2026-09-27'), /ไม่มีงานค้าง/);
});

test('adds a separate tomorrow reminder and a Sunday look-ahead for next week', () => {
  const tasks = [
    { title: 'ส่งเอกสารพรุ่งนี้', due_date: '2026-09-28', priority: 'medium' },
    { title: 'เตรียมประชุม', due_date: '2026-10-01', priority: 'high' },
    { title: 'งานสำคัญยังไม่กำหนดวัน', due_date: null, priority: 'high' },
    { title: 'งานเสร็จแล้ว', due_date: '2026-09-29', priority: 'high', status: 'done' },
  ];
  assert.equal(assistant.isWeeklyReviewDay('2026-09-27'), true);
  assert.equal(assistant.isWeeklyReviewDay('2026-09-28'), false);
  const digest = assistant.formatTaskDigest(tasks, '2026-09-27', 'สรุปงานวันอาทิตย์', true);
  assert.match(digest, /กำหนดพรุ่งนี้/);
  assert.match(digest, /มองสัปดาห์หน้า/);
  assert.match(digest, /เตรียมประชุม/);
  assert.match(digest, /งานสำคัญยังไม่กำหนดวัน/);
  assert.doesNotMatch(digest, /งานเสร็จแล้ว/);
});
