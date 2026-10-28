import test from 'node:test';import assert from 'node:assert/strict';
import {Drive} from './drive.mjs';
import {COURSES} from './course.mjs';
import {binOf,probeResult,PROBES,forecastComplete,forecastCheck,analysisScenes,decisionAt,comparison,reportComplete,REPORT_FIELDS} from './evaluate.mjs';
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function drive(opts,predict){const d=new Drive({mode:'model',predictor:predict,runId:'r',...opts});while(!d.ended)d.step();return d;}

test('A course keeps the 2차시 lead profile exactly',()=>{
 const old=t=>t<4?0:t<8?-25/3.6/4:t<11?0:t<15?25/3.6/4:0;
 for(let t=0;t<30;t+=.01)near(COURSES.A.lead(t),old(t));
});
test('B course: lead stays within the wet cap and clears the 160m finish before the time limit',()=>{
 const d=new Drive({course:'B',road:'wet',speed:0,runId:'b'});let max=0;
 for(let i=0;i<1500;i++){d.step();max=Math.max(max,d.lead.v*3.6);}
 assert.ok(max<=40+1e-9,`lead ${max}`);assert.ok(d.lead.x>160+20,`lead x ${d.lead.x}`);
 near(d.trace.find(r=>r.t_s>=7).lead_speed_kmh,0,1e-6);// 5.5–8초 정지
});
test('unknown course is rejected',()=>{assert.throws(()=>new Drive({course:'C'}),/코스/);});
test('Δv bins: boundaries belong to the milder bin, NaN is rejected',()=>{
 assert.equal(binOf(-5.01),'brake_hard');assert.equal(binOf(-5),'brake');assert.equal(binOf(-1.01),'brake');
 assert.equal(binOf(-1),'hold');assert.equal(binOf(1),'hold');assert.equal(binOf(1.01),'speed_up');assert.throws(()=>binOf(NaN));
});
test('probe: student must choose first, model sees the run road',()=>{
 let seen;const p=r=>{seen=r;return -6;};
 assert.throws(()=>probeResult(PROBES[0],'wet','',p),/먼저/);
 const r=probeResult(PROBES[0],'wet','brake',p);assert.equal(seen.road,'wet');assert.equal(r.model_bin,'brake_hard');assert.equal(r.same,false);
});
test('crash run: collision scene comes first, windows are ±3s clipped to the run',()=>{
 const d=drive({course:'B',gap:20},()=>7.2);assert.equal(d.ended,'collision');
 const s=analysisScenes(d);assert.equal(s[0].title,'앞차와 충돌한 순간');
 near(s[0].to,d.t);near(s[0].from,Math.max(0,d.t-3));
 assert.ok(!s.some(x=>x.title==='차간거리가 가장 짧았던 순간'),'충돌이 있으면 최소 거리 장면은 중복');
 assert.ok(s.every(x=>x.t<=d.t),'주행이 끝난 뒤의 코스 사건은 넣지 않는다');
});
test('forecast check compares outcome and violation separately',()=>{
 const d=drive({course:'B',gap:20},()=>7.2);
 assert.equal(forecastComplete({outcome:'collision',violation:'yes',reason:' '}),false);
 const c=forecastCheck({outcome:'completed',violation:'yes',reason:'앞차가 멀어서'},d);
 assert.equal(c.outcome.same,false);assert.equal(c.violation.same,true);
});
test('decisionAt shows the model request and the braking limit that cut it',()=>{
 const d=drive({gap:40},r=>r.gap_m<15?-20:0);
 const scene=analysisScenes(d).find(x=>x.kind==='result');const dec=decisionAt(d,scene.t);
 const brakeRow=d.rows.find(r=>r.requested_delta_kmh===-20);assert.ok(brakeRow,'모델이 -20을 제안한 행이 있어야 함');
 const k=decisionAt(d,brakeRow.t_s+.5);assert.equal(k.t_s,brakeRow.t_s);assert.ok(k.limited);near(k.applied_delta_kmh,-14.4);assert.equal(k.limit_reason,'제동 한계');
 assert.ok(dec&&Number.isFinite(dec.requested_delta_kmh));
});
test('comparison marks only conditions run by more than one model version',()=>{
 const tag=(d,v)=>Object.assign(d,{modelLabel:'모델 '+v,modelVersion:v});
 const runs=[tag(drive({gap:40},()=>0),1),tag(drive({gap:40},()=>-1),2),tag(drive({gap:30},()=>0),1)];
 const rows=comparison(runs);assert.equal(rows.length,3);
 assert.deepEqual(rows.map(r=>[r.gap,r.version,r.comparable]),[[30,1,false],[40,1,true],[40,2,true]]);
});
test('report needs all five items',()=>{
 const r=Object.fromEntries(REPORT_FIELDS.map(([k])=>[k,'x']));assert.ok(reportComplete(r));r.scope='  ';assert.ok(!reportComplete(r));
});
import {probeClip,PROBE_QUESTIONS} from './evaluate.mjs';
test('예상 칸 장면은 마지막 순간이 장면 입력값과 같고 2초 길이다',()=>{for(const p of PROBES){const c=probeClip(p,'wet'),last=c.at(-1);
 assert.equal(c[0].t_s,0);assert.equal(last.t_s,2);assert.ok(Math.abs(last.gap_m-p.input.gap_m)<1e-9);assert.ok(Math.abs(last.ego_speed_kmh-p.input.ego_speed_kmh)<1e-9);assert.ok(Math.abs(last.lead_speed_kmh-p.input.lead_speed_kmh)<1e-9);
 assert.ok(c.every(s=>s.lead_speed_kmh>=0&&s.gap_m>0&&s.road==='wet'));assert.equal(PROBE_QUESTIONS[p.id].length,2);}
 const slow=probeClip(PROBES[0]);assert.ok(slow[0].lead_speed_kmh>slow.at(-1).lead_speed_kmh,'감속 장면은 앞차가 느려진다');
 const go=probeClip(PROBES[2]);assert.ok(go[0].lead_speed_kmh<go.at(-1).lead_speed_kmh&&go[0].lead_speed_kmh===0,'출발 장면은 멈춰 있다가 출발한다');});
