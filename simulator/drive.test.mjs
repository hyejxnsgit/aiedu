import test from 'node:test';import assert from 'node:assert/strict';
import {Drive,movePair,trainingCSV} from './drive.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('contact inside a step is detected at exact time',()=>{
  const r=movePair({x:0,v:10},{x:.1,v:0},0,0,.02,20);
  assert.ok(r.collision);near(r.elapsed,.01);near(r.lead.x-r.ego.x,0);
});
test('detects contact even when endpoint gap is positive',()=>{
  const r=movePair({x:0,v:10},{x:1,v:0},0,40,1,50);
  assert.ok(r.collision);near(r.elapsed,(10-Math.sqrt(20))/40);
});
test('stop during interval splits integration correctly',()=>{
  const r=movePair({x:0,v:1},{x:10,v:0},-4,0,1,20);
  near(r.ego.x,.125);near(r.ego.v,0);assert.ok(!r.collision);
});
test('one-second rows retain start input and end delta',()=>{
  const d=new Drive();d.pending=-3;for(let k=0;k<50;k++)d.step();
  assert.equal(d.rows.length,1);near(d.rows[0].ego_speed_kmh,30);near(d.rows[0].actual_delta_kmh,-3);assert.ok(d.rows[0].complete_interval);
});
test('manual pedal changes react within the current second and are logged',()=>{
  const d=new Drive();d.pending=0;d.step();d.pending=-9;for(let k=1;k<50;k++)d.step();
  near(d.rows[0].actual_delta_kmh,-9*.98);assert.equal(d.rows[0].control_changes.length,2);near(d.rows[0].control_changes[1].t_s,.02);
});
test('model decision remains fixed for one second',()=>{
  let calls=0;const d=new Drive({mode:'model',predictor:()=>{calls++;return -3;}});
  for(let k=0;k<50;k++){d.pending=7.2;d.step();}assert.equal(calls,1);near(d.rows[0].actual_delta_kmh,-3);
  d.step();assert.equal(calls,2);
});
test('release pedal maintains current speed; no acceleration continues',()=>{
  const d=new Drive();d.pending=7.2;for(let k=0;k<25;k++)d.step();near(d.ego.v*3.6,33.6);
  d.pending=0;for(let k=0;k<25;k++)d.step();near(d.ego.v*3.6,33.6);
});
test('manual stop and model rollouts excluded from training CSV',()=>{
  const d=new Drive();d.step();d.stop();assert.ok(!d.rows[0].complete_interval);assert.equal(trainingCSV(d).split('\n').length,1);
  const a=new Drive({mode:'model',predictor:()=>0});for(let k=0;k<50;k++)a.step();assert.equal(a.rows.length,1);assert.equal(trainingCSV(a).split('\n').length,1);
});
test('repeat identical controls produce identical trace',()=>{
  const go=()=>{const d=new Drive({runId:'fixed'});for(let k=0;k<300&&!d.ended;k++){d.pending=-1;d.step();}return d;};
  assert.deepEqual(go(),go());
});
test('collision ends run and preserves partial last row',()=>{
  const d=new Drive({gap:1});while(!d.ended)d.step();assert.equal(d.ended,'collision');near(d.inputs().gap_m,0);assert.ok(!d.rows.at(-1).complete_interval);
});
