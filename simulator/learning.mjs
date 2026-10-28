export const QUESTS=[
 {title:'가속해서 20km/h까지 올려보세요',instruction:'가속 또는 ↑를 누르고 있으면서 속도계를 보세요.',speed:10,goal:'20km/h 도달',success:'가속을 누르는 동안 속도가 올라갔습니다.',timeout:'12초 안에 20km/h에 도달하지 못했습니다. 가속(↑)을 계속 누르고 있어 보세요.'},
 {title:'페달을 놓고 속도를 지켜보세요',instruction:'두 페달에서 손을 떼고 속도계를 잠깐 지켜보세요.',speed:20,goal:'페달 없이 1.2초 속도 유지 확인',success:'놓아도 속도는 유지됩니다. 이 시뮬레이터에서 감속하려면 브레이크가 필요합니다.',timeout:'페달을 놓은 채 1.2초를 지켜보지 못했습니다. 두 페달에서 손을 떼고 속도계만 보세요.'},
 {title:'브레이크로 완전히 멈춰보세요',instruction:'브레이크 또는 ↓를 눌러 속도를 0으로 만들어 보세요.',speed:20,goal:'0km/h 정지',success:'브레이크를 누르자 속도가 줄어 정지했습니다.',timeout:'12초 안에 멈추지 못했습니다. 브레이크(↓)를 누르고 있어 보세요.'},
 {title:'앞차가 출발하면 따라가 보세요',instruction:'앞차가 움직일 때까지 기다렸다가 가속을 눌러 따라가 보세요.',speed:0,goal:'기다린 뒤 10km/h 도달',success:'앞차의 움직임을 확인하고 출발했습니다. 이제 내 판단을 기록할 준비가 됐습니다.',timeout:'12초 안에 10km/h에 도달하지 못했습니다. 앞차가 출발하면 가속을 눌러 따라가세요.',early:'앞차가 출발하기 전에 움직였습니다. 앞차 속도가 0보다 커지는 순간을 먼저 확인하세요.'},
];
export class QuestProgress{
 constructor(index){this.index=index;this.releaseStart=null;this.releaseSpeed=null;this.done=false;this.failed=false;this.reason=null;}
 fail(key){this.failed=true;this.reason=QUESTS[this.index][key];}
 observe(d){
  if(this.done||this.failed)return;
  const v=d.ego.v*3.6,request=d.trace.at(-1)?.requested_delta_kmh??0;
  if(d.ended==='collision'){this.failed=true;this.reason='앞차와 부딪혔습니다. 거리가 줄어들면 브레이크로 속도를 줄이세요.';return;}
  if(d.t>=12){this.fail('timeout');return;}
  if(this.index===0)this.done=v>=20;
  if(this.index===1){if(request===0&&v>1&&(this.releaseSpeed===null||Math.abs(v-this.releaseSpeed)<.05)){this.releaseStart??=d.t;this.releaseSpeed??=v;this.done=d.t-this.releaseStart>=1.2-1e-8;}else{this.releaseStart=null;this.releaseSpeed=null;}}
  if(this.index===2)this.done=v<=.001&&request<0;
  if(this.index===3){if(d.t<=2+1e-8&&v>.01)this.fail('early');else this.done=d.lead.v>0&&v>=10;}
 }
}
export function scenesFor(run){
 const trace=run.trace;if(!trace.length)return [];
 const brake=trace.find(r=>r.requested_delta_kmh<0),near=trace.reduce((a,b)=>a.gap_m<b.gap_m?a:b);
 const events=[brake?{t:brake.t_s,title:'처음 브레이크를 밟은 순간'}:{t:Math.min(4,trace.at(-1).t_s),title:'앞차를 따라가던 장면'},
 {t:near.t_s,title:near.collision?'충돌 직전 장면':'차간거리가 가장 짧았던 순간'},
 ...(trace.at(-1).t_s>11?[{t:11,title:'앞차가 다시 출발한 순간'}]:[])];
 if(near.collision)events.unshift(events.splice(1,1)[0]);// 충돌 장면은 제동 장면과 겹쳐도 남긴다
 return events.filter((e,i)=>events.findIndex(a=>Math.abs(a.t-e.t)<.5)===i).sort((a,b)=>a.t-b.t).map(e=>({...e,id:String(e.t),from:Math.max(trace[0].t_s,e.t-2),to:Math.min(trace.at(-1).t_s,e.t+2)}));
}
export function sampleAt(run,t){return run.trace.find(r=>r.t_s>=t)??run.trace.at(-1);}
export function replayState(sample){return {road:sample.road,ego:{x:sample.ego_x_m,v:sample.ego_speed_kmh/3.6},lead:{x:sample.lead_x_m,v:sample.lead_speed_kmh/3.6},trace:[sample],leadAcceleration:()=>sample.lead_acceleration_mps2??0};}
// 2차시 운전 기준: 세 규칙을 모두 지키며 달린다. 감속 반응 시간은 1초로 고정하고, 거리·출발 가속은 학생이 숫자를 정한다.
export const REACT_S=1;
export const RULE_RANGE={gapM:{min:5,max:30,step:1,def:15},startKmhS:{min:2,max:7,step:1,def:5}};
export function normalizeRules(r={}){const pick=(k)=>{const {min,max,def}=RULE_RANGE[k],v=Number(r[k]);return Number.isFinite(v)?Math.min(max,Math.max(min,v)):def;};return {reactS:REACT_S,gapM:pick('gapM'),startKmhS:pick('startKmhS')};}
export function ruleList(rules){const r=normalizeRules(rules);return [
 {id:'decel',label:'감속 기준',text:`앞차가 감속하면 ${r.reactS}초 안에 나도 감속`},
 {id:'gap',label:'거리 기준',text:`앞차와 거리가 ${r.gapM}m보다 가까워지면 브레이크`},
 {id:'start',label:'출발 기준',text:`앞차가 출발하면 1초에 +${r.startKmhS}km/h 이하로 천천히 가속`}];}
export function rulesIntent(rules){return ruleList(rules).map(x=>`${x.label}: ${x.text}`).join(' / ');}
const EPS=1e-6;
function window_(trace,t,before,after,title){return {t,title,from:Math.max(trace[0].t_s,t-before),to:Math.min(trace.at(-1).t_s,t+after)};}
// 기록 하나에서 규칙별로 확인할 장면과 측정값을 뽑는다. verdict: kept(지킴) / broken(어김) / none(이 기록엔 해당 장면 없음).
export function checkRule(run,id){
 const trace=run.trace??[];if(!trace.length)return null;const r=normalizeRules(run.rules),end=trace.at(-1).t_s;
 if(id==='decel'){
  const lead=trace.find(x=>x.lead_acceleration_mps2<0);
  if(!lead)return {id,verdict:'none',scene:window_(trace,Math.min(4,end),2,2,'앞차를 따라가던 장면'),actual:'이 기록에는 앞차가 감속하는 장면이 없어요.'};
  const brake=trace.find(x=>x.t_s>=lead.t_s-EPS&&x.requested_delta_kmh<0),react=brake?brake.t_s-lead.t_s:null;
  return {id,verdict:react!==null&&react<=r.reactS+EPS?'kept':'broken',react,scene:window_(trace,lead.t_s,1,3,'앞차가 감속을 시작한 순간'),
   rule:`${r.reactS}초 안에 감속`,actual:react===null?'앞차가 감속한 뒤 브레이크를 밟지 않았어요.':`앞차 감속 ${react.toFixed(1)}초 뒤 브레이크`};}
 if(id==='gap'){
  const near=trace.find(x=>x.gap_m<r.gapM&&x.ego_speed_kmh>1),min=trace.reduce((a,b)=>a.gap_m<b.gap_m?a:b);
  if(!near)return {id,verdict:'kept',minGap:min.gap_m,scene:window_(trace,min.t_s,2,2,'차간거리가 가장 짧았던 순간'),rule:`${r.gapM}m보다 가까워지면 브레이크`,actual:`가장 가까울 때도 ${min.gap_m.toFixed(1)}m라 기준 거리 안으로 들어가지 않았어요.`};
  const brake=trace.find(x=>x.t_s>=near.t_s-.5&&x.t_s<=near.t_s+.5&&x.requested_delta_kmh<0);
  return {id,verdict:brake?'kept':'broken',minGap:min.gap_m,scene:window_(trace,near.t_s,2,2,`거리가 ${r.gapM}m보다 가까워진 순간`),rule:`${r.gapM}m보다 가까워지면 브레이크`,
   actual:`${near.t_s.toFixed(1)}초에 ${near.gap_m.toFixed(1)}m까지 가까워졌고 ${brake?'그때 브레이크를 밟았어요':'그때 브레이크를 밟지 않았어요'}. 가장 가까울 때 ${min.gap_m.toFixed(1)}m.`};}
 if(id==='start'){
  const stop=trace.findIndex(x=>x.lead_acceleration_mps2<0),go=trace.find((x,i)=>i>stop&&stop>=0&&x.lead_acceleration_mps2>0);
  if(!go)return {id,verdict:'none',scene:window_(trace,Math.max(trace[0].t_s,end-2),2,0,'기록의 마지막 장면'),rule:`1초에 +${r.startKmhS}km/h 이하`,actual:'이 기록은 앞차가 다시 출발하기 전에 끝났어요.'};
  // 앞차 출발 후 4초 동안, 1초 간격 속도 증가량의 최댓값을 잰다.
  let rate=0;for(const a of trace){if(a.t_s<go.t_s-EPS||a.t_s>go.t_s+4)continue;const b=trace.find(x=>x.t_s>=a.t_s+1-EPS);if(!b)break;rate=Math.max(rate,b.ego_speed_kmh-a.ego_speed_kmh);}
  return {id,verdict:rate<=r.startKmhS+.05?'kept':'broken',rate,scene:window_(trace,go.t_s,1,3,'앞차가 다시 출발한 순간'),rule:`1초에 +${r.startKmhS}km/h 이하`,actual:`출발 뒤 1초에 최대 +${rate.toFixed(1)}km/h로 가속했어요.`};}
 throw Error('알 수 없는 기준');
}
// 기록 주행 여러 번 중 규칙마다 장면 하나: 어긴 장면이 있으면 그 기록(가장 최근)을, 없으면 가장 최근 기록을 고른다.
export function ruleScenes(runs){
 const list=runs.filter(r=>r.trace?.length);if(!list.length)return [];
 return ruleList(list.at(-1).rules).map(rule=>{
  const checks=list.map(run=>({run,check:checkRule(run,rule.id)}));
  const pick=[...checks].reverse().find(c=>c.check.verdict==='broken')??[...checks].reverse().find(c=>c.check.verdict!=='none')??checks.at(-1);
  return {...rule,text:ruleList(pick.run.rules).find(x=>x.id===rule.id).text,run:pick.run,...pick.check,id:rule.id};});
}
const MATCH=['yes','partly','no'];
export function reflectionComplete(run){return Object.values(run.reflections??{}).some(r=>MATCH.includes(r.match)&&r.evidence?.trim());}
export function rulesReflected(runs){const done=new Set();for(const run of runs)for(const [k,v] of Object.entries(run.reflections??{}))if(MATCH.includes(v.match)&&v.evidence?.trim())done.add(k);return ['decel','gap','start'].every(k=>done.has(k));}

// 2차시 기록 주행: 코스를 완주한 직접 운전 기록이 이만큼 모이면 전처리 실습으로 넘어가도록 안내한다.
export const ENOUGH_RUNS=3;
export function completedRecordRuns(runs){return runs.filter(r=>r.mode==='manual'&&r.purpose==='collection'&&r.ended==='completed').length;}
