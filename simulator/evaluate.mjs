// 3차시 모델 평가 로직: 결과 예상, 자동 주행 요약, 분석할 장면, 모델·코스 비교, 보고서.
// 화면은 저장된 주행 기록(trace·rows)만 읽는다. 과거 주행을 현재 모델로 다시 계산하지 않는다(설계 4).
import {course} from './course.mjs';

export const OUTCOMES={completed:'끝까지 완주',collision:'앞차와 충돌',timeout:'제한 시간 안에 못 감',manual_abort:'중간에 멈춤',error:'오류로 멈춤'};

// 학생이 먼저 고르고, 그다음 모델값을 공개하는 고정 장면. 노면은 주행 설정을 따른다.
export const PROBES=[
 {id:'slowing',title:'앞차가 감속하기 시작했다',input:{ego_speed_kmh:30,gap_m:25,lead_speed_kmh:20}},
 {id:'stopped',title:'앞차가 멈춰 있고 거리가 가깝다',input:{ego_speed_kmh:20,gap_m:12,lead_speed_kmh:0}},
 {id:'restart',title:'멈춰 있던 앞차가 다시 출발했다',input:{ego_speed_kmh:0,gap_m:6,lead_speed_kmh:8}},
];
// 예상 칸마다 '내 기록 → 모델의 판단'으로 이어 생각하게 하는 질문(장면 제목은 그대로 둔다).
export const PROBE_QUESTIONS={
 slowing:['2차시에 앞차가 감속하기 시작했을 때, 나는 1초 안에 브레이크를 밟았나요, 아니면 그대로 달렸나요?','그런 기록으로 배운 모델이라면 이 장면에서 어느 쪽을 고를까요?'],
 stopped:['내 기록에 멈춘 앞차와 12m쯤 가까워진 장면이 있었나요? 그때 1초 동안 속도를 얼마나 줄였나요?','가까운 장면 기록이 많았나요, 적었나요? 그렇다면 모델은 얼마나 자신 있게 줄일까요?'],
 restart:['앞차가 다시 출발했을 때 나는 1초에 몇 km/h씩 가속했나요? (내 출발 기준)','내 기록이 그랬다면, 모델은 바로 출발할까요, 조금 기다릴까요?'],
};
export const PROBE_FRAME='내 기록에서는 ___였으니까, 모델은 아마 ___할 거야.';
// 예상 칸 말풍선용 짧은 장면: 장면 직전 2초를 거꾸로 계산해, 마지막 순간이 PROBES의 입력값(속도·거리)과 같아지게 만든다.
const PROBE_MOTION={slowing:{leadA:t=>t>0.8?-1.7:0},stopped:{leadA:()=>0},restart:{leadA:t=>t>0.5?1.5:0}};
export function probeClip(probe,road='dry',T=2,dt=0.05){
 const m=PROBE_MOTION[probe.id]??{leadA:()=>0},n=Math.round(T/dt),out=[];
 let ego={x:60,v:probe.input.ego_speed_kmh/3.6},lead={x:60+probe.input.gap_m,v:probe.input.lead_speed_kmh/3.6};
 for(let i=n;i>=0;i--){const t=i*dt,a=m.leadA(t);
  out.push({t_s:+t.toFixed(3),road,ego_x_m:ego.x,ego_speed_kmh:ego.v*3.6,lead_x_m:lead.x,lead_speed_kmh:lead.v*3.6,lead_acceleration_mps2:a,gap_m:lead.x-ego.x});
  ego={x:ego.x-ego.v*dt,v:ego.v};lead={x:lead.x-lead.v*dt,v:Math.max(0,lead.v-a*dt)};}
 return out.reverse();}
export const BINS=[
 {id:'brake_hard',label:'크게 줄인다 (−5km/h보다 더)',test:d=>d< -5},
 {id:'brake',label:'조금 줄인다 (−5 ~ −1km/h)',test:d=>d>=-5&&d< -1},
 {id:'hold',label:'거의 유지한다 (−1 ~ +1km/h)',test:d=>d>=-1&&d<=1},
 {id:'speed_up',label:'늘린다 (+1km/h보다 더)',test:d=>d>1},
];
export function binOf(delta){if(!Number.isFinite(delta))throw Error('예측값이 숫자가 아닙니다.');return BINS.find(b=>b.test(delta)).id;}
export function probeResult(probe,road,choice,predictor){
 if(!BINS.some(b=>b.id===choice))throw Error('예상을 먼저 고르세요.');
 const value=predictor({...probe.input,road});
 return {probe_id:probe.id,road,choice,model_delta_kmh:value,model_bin:binOf(value),same:binOf(value)===choice};
}

export function forecastComplete(f){return !!f&&Object.hasOwn(OUTCOMES,f.outcome)&&['yes','no'].includes(f.violation)&&!!f.reason?.trim();}

export function summarize(run){
 const trace=run.trace??[];
 const first=trace.find(r=>r.violation);
 const decisions=(run.rows??[]).filter(r=>r.complete_interval);
 const strongest=decisions.reduce((a,r)=>!a||r.requested_delta_kmh<a.requested_delta_kmh?r:a,null);
 return {ended:run.ended,outcome:OUTCOMES[run.ended]??'주행 중',t_s:run.t,min_gap_m:run.minGap,violation_s:run.violations,
  first_violation_s:first?.t_s??null,decisions:decisions.length,strongest_brake_kmh:strongest?.requested_delta_kmh??null};
}
export function forecastCheck(f,run){
 if(!forecastComplete(f)||!run.ended)return null;
 const s=summarize(run),violated=s.violation_s>0;
 return {outcome:{expected:OUTCOMES[f.outcome],actual:s.outcome,same:f.outcome===run.ended},
  violation:{expected:f.violation==='yes'?'있다':'없다',actual:violated?`있었다 (${s.violation_s.toFixed(1)}초)`:'없었다',same:(f.violation==='yes')===violated}};
}

// 분석할 장면: 사건 시각 앞뒤 3초. 충돌·기준 미달·최소 거리처럼 결과로 생긴 장면을 코스 사건보다 먼저 보여준다.
export function analysisScenes(run){
 const trace=run.trace??[];if(!trace.length)return [];
 const start=trace[0].t_s,end=trace.at(-1).t_s,out=[];
 const crash=trace.find(r=>r.collision);if(crash)out.push({t:crash.t_s,title:'앞차와 충돌한 순간',kind:'result'});
 const firstViolation=trace.find((r,i)=>r.violation&&!trace[i-1]?.violation);if(firstViolation)out.push({t:firstViolation.t_s,title:'처음 기준 거리보다 가까워진 순간',kind:'result'});
 const nearest=trace.reduce((a,b)=>b.gap_m<a.gap_m?b:a);if(!crash)out.push({t:nearest.t_s,title:'차간거리가 가장 짧았던 순간',kind:'result'});
 for(const e of course(run.course??'A').events)if(e.t<=end)out.push({...e,kind:'course'});
 const unique=out.filter((e,i)=>out.findIndex(a=>Math.abs(a.t-e.t)<.5)===i);
 return unique.map(e=>({...e,id:e.kind+':'+e.t.toFixed(2),from:Math.max(start,e.t-3),to:Math.min(end,e.t+3)}));
}
// 그 순간을 포함한 1초 판단: 모델이 무엇을 보고 얼마를 제안했고 실제로 얼마나 바뀌었는지.
export function decisionAt(run,t){
 const rows=run.rows??[];const row=[...rows].reverse().find(r=>r.t_s<=t+1e-9)??rows[0];if(!row)return null;
 const sample=(run.trace??[]).find(r=>r.t_s>row.t_s+1e-9);
 const applied=sample?.applied_acceleration_mps2,requested=row.requested_delta_kmh/3.6;
 const limited=Number.isFinite(applied)&&Math.abs(applied-requested)>1e-9;
 return {...row,limited,applied_delta_kmh:Number.isFinite(applied)?applied*3.6:null,limit_reason:!limited?null:requested<applied?'제동 한계':'가속 한계'};
}
export const CAUSES=['이런 상황의 학습 기록이 적었다','학습 기록에 위험하거나 의도와 다른 운전이 섞여 있었다','네 입력만으로는 알 수 없는 정보가 필요했다','모델 제안보다 프로그램의 가감속 한계가 크게 작용했다','아직 판단하기 어렵다'];
export function analysisComplete(a){return !!a&&CAUSES.includes(a.cause)&&!!a.evidence?.trim()&&!!a.plan?.trim();}

// 비교표: 모델 버전 × 코스 × 노면 × 처음 거리. 같은 조건에서 모델끼리 비교할 수 있는 묶음을 표시한다.
export function conditionKey(run){return [run.course??'A',run.road,run.startGap].join('|');}
export function comparison(runs){
 const done=runs.filter(r=>r.mode==='model'&&r.ended&&r.modelLabel);
 const rows=done.map(r=>({run:r,key:conditionKey(r),model:r.modelLabel,version:r.modelVersion,course:course(r.course??'A').short,road:r.road==='wet'?'젖은 노면':'마른 노면',gap:r.startGap,...summarize(r)}));
 const groups={};for(const r of rows)(groups[r.key]??=new Set()).add(r.version);
 for(const r of rows)r.comparable=groups[r.key].size>1;
 return rows.sort((a,b)=>a.key.localeCompare(b.key)||a.version-b.version);
}

export const REPORT_FIELDS=[
 ['choice','사람이 한 선택','예: 어떤 기록을 학습에 넣고 뺐는지, 어떤 장면을 더 운전했는지'],
 ['fact','확인한 사실','예: 첫 모델은 A 코스 젖은 노면에서 9.2초에 기준 거리보다 가까워졌다'],
 ['evidence','근거','예: 장면 분석의 수치, 비교표의 최소 거리·기준 미달 시간'],
 ['scope','개선의 범위','예: A 코스에서는 나아졌지만 B 코스에서는 아직 확인하지 못했다'],
 ['question','남은 질문','예: 사람이 운전한 기록을 배운 차를 실제 도로에서 믿어도 될까?'],
];
export function reportComplete(r){return REPORT_FIELDS.every(([k])=>!!r?.[k]?.trim());}
