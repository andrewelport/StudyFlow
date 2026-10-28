import test from 'node:test';
import assert from 'node:assert/strict';
import {livePosition} from '../src/studyflow/live-time.mjs';
const rows = [{start:'10:00',end:'11:00',title:'Lecture'}, {start:'12:00',end:'13:00',title:'Study'}];
test('now indicator respects start/end boundaries and selected date', () => {
  const now = new Date(2026,9,28,10,0);
  assert.equal(livePosition(rows,'2026-10-28',now).active[0].title,'Lecture');
  assert.equal(livePosition(rows,'2026-10-27',now),null);
  now.setHours(11);
  assert.equal(livePosition(rows,'2026-10-28',now).active.length,0);
  assert.equal(livePosition(rows,'2026-10-28',now).next,1);
  now.setHours(14);
  assert.equal(livePosition(rows,'2026-10-28',now).next,-1);
});
test('cancelled and finished activities are not ongoing; simultaneous activities are retained', () => {
  const now=new Date(2026,9,28,10,30);
  const data=[...rows,{...rows[0],done:true},{...rows[0],cancelled:true},{...rows[0],title:'Overlap'}];
  assert.deepEqual(livePosition(data,'2026-10-28',now).active.map(r=>r.title),['Lecture','Overlap']);
});
