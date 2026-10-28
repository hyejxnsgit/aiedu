import test from 'node:test';
import assert from 'node:assert/strict';
import {Review,problems,parseCSV,practiceRows,COLUMNS} from './review.mjs';
import {Drive} from './drive.mjs';
const row=(run='A',t=0,patch={})=>({run_id:run,t_s:t,source:'student_demo',ego_speed_kmh:30,gap_m:40,lead_speed_kmh:25,road:'dry',actual_delta_kmh:0,...patch});
const split=b=>{b.assign('A','train');b.assign('B','validation');return b;};
test('missing values differ from zero, malformed numeric values stay errors',()=>{
 assert.equal(problems(row('A',0,{gap_m:0,actual_delta_kmh:'0'})).length,0);
 for(const gap_m of ['',null,'  '])assert.ok(problems(row('A',0,{gap_m})).some(p=>p.type==='결측치'));
 for(const gap_m of ['abc',Infinity,true,[],[40],'0x20'])assert.ok(problems(row('A',0,{gap_m})).some(p=>p.type==='형식 오류'));
});
test('physical checks honor wet/dry braking, acceleration, speed cap and stop',()=>{
 assert.equal(problems(row('A',0,{actual_delta_kmh:-14.4})).length,0);
 assert.ok(problems(row('A',0,{road:'wet',actual_delta_kmh:-14.4})).length);
 for(const p of [{actual_delta_kmh:8},{ego_speed_kmh:3,actual_delta_kmh:-4},{ego_speed_kmh:49,actual_delta_kmh:2},{gap_m:-1}])assert.ok(problems(row('A',0,p)).length);
});
test('correction needs a reason; original and audit survive edit and undo',()=>{
 const raw=[row('A',0,{gap_m:''}),row('B')],b=split(new Review(raw));
 assert.throws(()=>b.decide(0,'edit','',{gap_m:40}));
 b.decide(0,'edit','원본 거리 40m 확인',{gap_m:'40'});
 assert.equal(b.status().blocked,false);assert.equal(b.raw[0].gap_m,'');assert.equal(raw[0].gap_m,'');
 b.undo(0);assert.equal(b.effective(0).gap_m,'');assert.equal(b.status().blocked,true);assert.equal(b.events.at(-1).kind,'undo');
});
test('keeping an impossible value never bypasses export checks',()=>{
 const b=split(new Review([row('A',0,{ego_speed_kmh:300}),row('B')]));b.decide(0,'keep','그대로 쓰고 싶음');assert.throws(()=>b.export());
 b.decide(0,'edit','형식 오류 수정 시도',{ego_speed_kmh:'abc'});assert.throws(()=>b.export());
});
test('same-value repeated driving is valid; same run and time duplicates block',()=>{
 const b=split(new Review([row(),row('A',1),row('B'),row()]));assert.equal(b.status().blocked,true);
 b.decide(3,'exclude','같은 주행과 시각의 중복');assert.equal(b.status().blocked,false);assert.equal(b.export().bundle.counts.train,2);
});
test('outliers are candidates, preserving a plausible hard brake requires reasoning',()=>{
 const data=Array.from({length:10},(_,i)=>row('A',i));data.push(row('B',0,{actual_delta_kmh:-8}));const b=split(new Review(data));
 assert.equal(b.status().blocked,true);assert.ok(b.candidates()[10].some(x=>!x.hard));
 b.decide(10,'keep','실제 급감속이며 마른 노면 제동 범위 내');assert.equal(b.status().blocked,false);
});
test('validation distribution cannot change training outlier thresholds',()=>{
 const training=Array.from({length:10},(_,i)=>row('A',i,{actual_delta_kmh:i===9?-8:0}));
 const b=split(new Review([...training,row('B')]));const before=b.candidates().slice(0,10);
 b.raw.push(...Array.from({length:100},(_,i)=>row('B',i+1,{actual_delta_kmh:-14})));
 assert.deepEqual(b.candidates().slice(0,10),before);
});
test('automatic driving and partial intervals are retained as excluded original evidence',()=>{
 const b=split(new Review([row(),row('B'),row('A',1,{source:'model_rollout'}),row('B',1,{complete_interval:false,interval_duration_s:.4})]));
 const out=b.export();assert.equal(out.bundle.raw.length,4);assert.equal(out.bundle.counts.excluded,2);assert.throws(()=>b.decide(2,'keep','use'));
});
test('run-level assignment prevents overlap and requires two nonempty partitions',()=>{
 const b=new Review([row(),row('A',1),row('B')]);b.assign('A','train');b.assign('B','train');assert.throws(()=>b.export());
 b.assign('B','validation');const out=b.export(),a=parseCSV(out.train),v=parseCSV(out.validation);assert.deepEqual([...new Set(a.map(r=>r.run_id))],['A']);assert.deepEqual(v.map(r=>r.run_id),['B']);
});
test('CSV preserves empty cells and quotes; rejects malformed or incomplete schemas',()=>{
 const b=new Review([row('A,"quoted"',0,{gap_m:''}),row('B')]);b.assign('A,"quoted"','train');b.assign('B','validation');b.decide(0,'edit','원본 확인',{gap_m:40});
 assert.equal(parseCSV(b.export().train)[0].run_id,'A,"quoted"');
 const text=COLUMNS.join(',')+'\nA,0,student_demo,30,,25,dry,0';assert.equal(parseCSV(text)[0].gap_m,'');
 assert.throws(()=>parseCSV(text+'\n"unfinished'));assert.throws(()=>parseCSV('a,b\n1,2'));assert.throws(()=>parseCSV(text+',extra'));
});
test('practice resolves to explicitly labeled export with missing/error/duplicate excluded',()=>{
 const b=new Review(practiceRows(),{practice:true});b.assign('연습-A','train');b.assign('연습-B','validation');
 for(const i of [1,2,20])b.decide(i,'exclude','복구 근거 없음 또는 중복');b.decide(3,'keep','실제 가능한 급감속');
 const out=b.export();assert.equal(out.bundle.practice,true);assert.deepEqual(out.bundle.counts,{raw:21,edited:0,excluded:3,train:8,validation:10});
});
test('real Drive recordings export with metadata preserved and no run overlap',()=>{
 const a=new Drive({runId:'A'}),b=new Drive({runId:'B',road:'wet'});
 for(let i=0;i<100;i++){a.step();b.step();}const review=split(new Review([...a.rows,...b.rows]));
 assert.equal(review.status().blocked,false);assert.equal(parseCSV(review.export().train).length,2);assert.equal(parseCSV(review.export().validation).length,2);
});
test('CSV run IDs cannot mutate the split registry prototype',()=>{
 const b=new Review([row('__proto__'),row('B')]);b.assign('__proto__','train');b.assign('B','validation');assert.equal(b.status().blocked,false);
});
test('partial interval flags survive CSV string parsing; invalid flags block',()=>{
 const b=split(new Review([row(),row('B'),row('A',1,{complete_interval:'false'})]));
 assert.equal(b.export().bundle.counts.excluded,1);
 assert.ok(problems(row('A',0,{complete_interval:'unknown'})).length);
 assert.ok(problems(row('A',0,{interval_duration_s:'abc'})).length);
});
test('audit round trip restores decisions and history without trusting saved approval',()=>{
 const b=split(new Review([row('A',0,{gap_m:''}),row('B')]));
 b.decide(0,'edit','원본의 거리 40m 확인',{gap_m:40});
 const copy=Review.restore(JSON.parse(JSON.stringify(b.audit())));
 assert.equal(copy.export().train,b.export().train);assert.equal(copy.raw[0].gap_m,'');
 assert.equal(copy.events.at(-1).kind,'restored');copy.undo(0);assert.throws(()=>copy.export());
 const tampered=b.audit();tampered.raw[1].ego_speed_kmh=300;tampered.export_ready=true;
 assert.throws(()=>Review.restore(tampered).export());
 assert.throws(()=>Review.restore({...b.audit(),physics_version:'different'}));
 const malformed=b.audit();malformed.decisions['-1']={action:'keep',reason:'a',patch:{}};
 assert.throws(()=>Review.restore(malformed));
});
test('Orange tab assigns exactly four inputs, continuous target and three metadata fields',()=>{
 const b=split(new Review([row(),row('B')]));const lines=b.export().trainTab.split('\n');
 assert.deepEqual(lines[1].split('\t'),['string','continuous','string','continuous','continuous','continuous','dry wet','continuous']);
 assert.deepEqual(lines[2].split('\t'),['meta','meta','meta','','','','','class']);
});
test('rows split 7:3 by default, reproducibly, and the ratio and reshuffle are recorded',()=>{
 const data=[...Array.from({length:12},(_,i)=>row('A',i)),...Array.from({length:8},(_,i)=>row('B',i))],b=new Review(data);
 let s=b.status();assert.equal(s.train.length,14);assert.equal(s.validation.length,6);assert.equal(s.blocked,false);
 const first=s.rows.map(r=>r.split).join();assert.equal(new Review(data).status().rows.map(r=>r.split).join(),first);
 b.setRatio(.8);s=b.status();assert.equal(s.train.length,16);b.setRatio(.8,2);assert.notEqual(b.status().rows.map(r=>r.split).join(),first);
 assert.throws(()=>b.setRatio(.5));
 const back=Review.restore(b.audit());assert.equal(back.ratio,.8);assert.equal(back.seed,2);assert.deepEqual(back.status().rows.map(r=>r.split),b.status().rows.map(r=>r.split));
});
test('runs assigned in an earlier history keep their split; only new rows follow the ratio',()=>{
 const b=new Review([row('old',0),row('old',1),...Array.from({length:10},(_,i)=>row('new',i))]);b.assign('old','validation');
 const s=b.status();assert.ok(s.rows.slice(0,2).every(r=>r.split==='validation'));assert.equal(s.rows.slice(2).filter(r=>r.split==='train').length,7);
});
test('a tiny pool still puts at least one row in each set; locked rows stay out',()=>{
 const b=new Review([row('A',0),row('A',1),row('A',2,{source:'model_rollout'})]);const s=b.status();
 assert.equal(s.train.length,1);assert.equal(s.validation.length,1);assert.equal(s.rows[2].split,'unassigned');
});
