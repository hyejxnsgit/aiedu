import test from 'node:test';
import assert from 'node:assert/strict';
import {Drive,trainingCSV} from './drive.mjs';
import {QUESTS,QuestProgress,scenesFor,sampleAt,replayState,reflectionComplete,completedRecordRuns,ENOUGH_RUNS,normalizeRules,ruleList,checkRule,ruleScenes,rulesReflected,rulesIntent} from './learning.mjs';
import {Review} from './review.mjs';
function practice(i){const d=new Drive({purpose:'practice',speed:QUESTS[i].speed});d.lead.v=i===3?0:25/3.6;d.leadAcceleration=()=>i===3?(d.t<2?0:1.7):0;return d;}
function runQuest(i,action){const d=practice(i),q=new QuestProgress(i);for(let n=0;n<650&&!q.done&&!q.failed;n++){d.pending=action(d);d.step();q.observe(d);}return {d,q};}
test('each quest clears only after the requested physical action',()=>{
 for(const [i,action] of [[0,()=>7.2],[1,()=>0],[2,()=>-14.4],[3,d=>d.t<2?0:7.2]])assert.equal(runQuest(i,action).q.done,true);
 assert.equal(runQuest(0,()=>0).q.failed,true);
 assert.equal(runQuest(1,()=>7.2).q.failed,true);
 assert.equal(runQuest(2,()=>0).q.failed,true);
});
test('tapping gas before releasing still clears the release quest at the new speed',()=>{
 const {d,q}=runQuest(1,d=>d.t<.3?7.2:0);assert.equal(q.done,true);assert.ok(d.ego.v*3.6>20);
 const brake=runQuest(1,d=>d.t<.3?-14.4:0);assert.equal(brake.q.done,true);
});
test('a failed quest explains its own reason',()=>{
 assert.match(runQuest(0,()=>0).q.reason,/20km\/h/);assert.match(runQuest(3,()=>7.2).q.reason,/출발하기 전/);assert.match(runQuest(1,()=>-14.4).q.reason,/페달/);assert.match(runQuest(1,()=>7.2).q.reason,/부딪혔/);
});
test('departing before the lead car moves fails the observation quest',()=>{
 const {q}=runQuest(3,()=>7.2);assert.equal(q.failed,true);assert.equal(q.done,false);
});
test('quest data stays out of CSV and cannot be admitted through review',()=>{
 const {d}=runQuest(0,()=>7.2);assert.ok(d.rows.length);assert.ok(d.rows.every(r=>r.source==='guided_practice'));
 assert.equal(trainingCSV(d).split('\n').length,1);const b=new Review(d.rows);assert.ok(b.status().rows.every(r=>r.excluded));assert.throws(()=>b.decide(0,'keep','학습에 사용'));
});
test('replay uses recorded positions and cannot add new training rows',()=>{
 const d=new Drive({runId:'actual'});for(let i=0;i<120;i++){d.pending=i>50?-14.4:0;d.step();}
 const before=JSON.stringify(d),scenes=scenesFor(d);assert.ok(scenes.length);
 for(const scene of scenes){assert.ok(scene.from<=scene.to);const frame=sampleAt(d,scene.t),state=replayState(frame);assert.equal(state.ego.x,frame.ego_x_m);assert.equal(state.lead.x-state.ego.x,frame.gap_m);}
 assert.equal(JSON.stringify(d),before);
});
test('a collision scene is kept even when it overlaps the first brake',()=>{
 const d=new Drive({runId:'crash',gap:15,speed:45});for(let n=0;n<600&&!d.ended;n++){d.pending=d.inputs().gap_m>2?7.2:-14.4;d.step();}
 assert.equal(d.ended,'collision');const titles=scenesFor(d).map(s=>s.title);assert.ok(titles.includes('충돌 직전 장면'),titles.join());
});
test('a rule reflection needs a match choice and evidence',()=>{
 const d={reflections:{decel:{match:'partly',evidence:''}}};assert.equal(reflectionComplete(d),false);
 d.reflections.decel.evidence='1.6초 뒤에 브레이크';assert.equal(reflectionComplete(d),true);
 const review=new Review([]);review.learningContext=[{run_id:'A',reflections:d.reflections}];assert.deepEqual(Review.restore(review.audit()).learningContext,review.learningContext);
});
// 코스 A를 정해진 조작으로 끝까지 달린다(앞차 감속 4초, 재출발 11초).
function drive(control,rules={}){const d=new Drive({runId:'r'});d.rules=normalizeRules(rules);for(let n=0;n<1500&&!d.ended;n++){d.pending=control(d);d.step();}return d;}
const careful=d=>{const {gap_m,lead_speed_kmh,ego_speed_kmh}=d.inputs();if(d.t>=4&&d.t<4.5)return -14.4;if(gap_m<18&&ego_speed_kmh>lead_speed_kmh)return -14.4;if(d.t>=11&&ego_speed_kmh<lead_speed_kmh)return 3.6;return 0;};
test('rules are clamped to the allowed range and listed in a fixed order',()=>{
 assert.deepEqual(normalizeRules({gapM:99,startKmhS:'x'}),{reactS:1,gapM:30,startKmhS:5});
 assert.deepEqual(ruleList({gapM:12,startKmhS:4}).map(r=>r.id),['decel','gap','start']);
 assert.match(rulesIntent({gapM:12,startKmhS:4}),/12m.*\+4km\/h/);
});
test('the decel rule measures reaction time from the lead car braking',()=>{
 const late=drive(d=>d.t>=5.5&&d.t<9?-14.4:d.t>=11?3.6:0);const c=checkRule(late,'decel');
 assert.equal(c.verdict,'broken');assert.ok(Math.abs(c.react-1.5)<.05,c.react);assert.ok(c.scene.from<=4&&c.scene.to>=4);
 assert.equal(checkRule(drive(careful),'decel').verdict,'kept');
});
test('the gap rule checks for a brake when the gap first drops below the student threshold',()=>{
 const none=drive(d=>d.t>=4.2&&d.t<12?(d.ego.v>0?-14.4:0):d.t>=12?1.8:0,{gapM:5});assert.equal(checkRule(none,'gap').verdict,'kept');
 const noBrake=drive(d=>d.t>=7&&d.inputs().gap_m>3?0:d.inputs().gap_m<=3?-14.4:0,{gapM:20});const g=checkRule(noBrake,'gap');assert.equal(g.verdict,'broken');assert.match(g.actual,/브레이크를 밟지 않았어요/);
});
test('the start rule measures the fastest one-second speed gain after the lead restarts',()=>{
 const stopThenFloor=d=>d.t>=4&&d.t<11?(d.ego.v>0?-14.4:0):d.t>=11?7.2:0;
 const fast=checkRule(drive(stopThenFloor,{startKmhS:4}),'start');assert.equal(fast.verdict,'broken');assert.ok(fast.rate>7,fast.rate);
 const gentle=checkRule(drive(d=>d.t>=4&&d.t<11?(d.ego.v>0?-14.4:0):d.t>=11?3.6:0,{startKmhS:4}),'start');assert.equal(gentle.verdict,'kept');assert.ok(gentle.rate<=4.05,gentle.rate);
 const crash=new Drive({runId:'c',gap:10,speed:45});for(let n=0;n<600&&!crash.ended;n++){crash.pending=7.2;crash.step();}assert.equal(checkRule(crash,'start').verdict,'none');
});
test('rule scenes prefer the latest run that broke the rule and all three rules must be reflected',()=>{
 const good=drive(careful),bad=drive(d=>d.t>=6&&d.t<10?-14.4:d.t>=11?7.2:0),runs=[bad,good];
 const scenes=ruleScenes(runs);assert.deepEqual(scenes.map(s=>s.id),['decel','gap','start']);
 assert.equal(scenes[0].run,bad);assert.equal(scenes[0].verdict,'broken');
 assert.equal(rulesReflected(runs),false);
 for(const s of scenes){s.run.reflections??={};s.run.reflections[s.id]={match:'yes',evidence:'기록 확인'};}
 assert.equal(rulesReflected(runs),true);assert.deepEqual(ruleScenes([]),[]);
});

test('only completed manual record runs count toward moving on to preprocessing',()=>{
 const run=(o)=>({mode:'manual',purpose:'collection',ended:'completed',...o});
 assert.equal(ENOUGH_RUNS,3);
 assert.equal(completedRecordRuns([run(),run({ended:'collision'}),run({ended:null}),run({purpose:'practice'}),run({mode:'model'})]),1);
 assert.equal(completedRecordRuns([run(),run({ended:'manual_abort'})]),1);
 assert.equal(completedRecordRuns([run(),run()]),2);
 assert.equal(completedRecordRuns([]),0);
});
