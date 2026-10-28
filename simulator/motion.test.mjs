import test from 'node:test';
import assert from 'node:assert/strict';
import {advance,simulateInterval,requiredDistance} from './motion.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('same request: dry/wet produce different actual changes',()=>{
  near(simulateInterval({speedKmh:30,deltaKmh:-15,road:'dry'}).end_speed_kmh,15.6);
  near(simulateInterval({speedKmh:30,deltaKmh:-15,road:'wet'}).end_speed_kmh,21);
});
test('request within limits is preserved',()=>{
  for(const road of ['dry','wet'])near(simulateInterval({speedKmh:30,deltaKmh:-3,road}).actual_delta_kmh,-3);
});
test('stop midway: no reverse, exact stopping distance',()=>{
  const r=simulateInterval({speedKmh:3,deltaKmh:-9,road:'wet'});
  near(r.end_speed_kmh,0);near(r.distance_m,(3/3.6)**2/(2*2.5));assert.ok(r.limits.includes('stopped'));
});
test('cap midway: exact distance and actual change',()=>{
  const r=simulateInterval({speedKmh:48,deltaKmh:7.2,road:'dry'});
  const t=(50-48)/3.6/2;
  near(r.actual_delta_kmh,2);near(r.distance_m,(48/3.6)*t+t*t+(50/3.6)*(1-t));
});
test('fixed steps match direct analytic integration',()=>{
  const r=simulateInterval({speedKmh:20,deltaKmh:3.6,road:'dry'});
  const expected=advance({x:0,v:20/3.6},1,1,50/3.6);
  near(r.distance_m,expected.x);near(r.end_speed_kmh,expected.v*3.6);assert.equal(r.samples.length,51);
});
test('early termination is not a complete one-second target',()=>{
  const r=simulateInterval({speedKmh:30,deltaKmh:-9,road:'wet',duration:0.3});
  assert.equal(r.complete_interval,false);near(r.actual_delta_kmh,-2.7);near(r.samples.at(-1).t_s,0.3);
});
test('invalid input is rejected rather than silently repaired',()=>{
  for(const patch of [{speedKmh:-1},{deltaKmh:NaN},{road:'snow'},{speedKmh:60},{duration:2}])
    assert.throws(()=>simulateInterval({speedKmh:30,deltaKmh:0,road:'dry',...patch}));
});
test('wet stopping criterion is larger; no state mutation',()=>{
  assert.ok(requiredDistance(30,'wet')>requiredDistance(30,'dry'));
  const s={x:0,v:5};advance(s,1,1,10);assert.deepEqual(s,{x:0,v:5});
});
