import {roadSettings} from './motion.mjs';
export const COLUMNS=['run_id','t_s','source','ego_speed_kmh','gap_m','lead_speed_kmh','road','actual_delta_kmh'];
export const EDITABLE=['ego_speed_kmh','gap_m','lead_speed_kmh','road','actual_delta_kmh'];
const missing=v=>v==null||(typeof v==='string'&&v.trim()==='');
const num=v=>(typeof v==='number'||(typeof v==='string'&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())))&&Number.isFinite(Number(v));
const clone=v=>structuredClone(v);
export function problems(r){
 const out=[];const add=(type,message,field)=>out.push({type,message,hard:true,...(field?{field}:{})});
 for(const k of COLUMNS)if(missing(r[k]))add('결측치',`${k}: 값이 빠져 있습니다. 0과 빈칸은 다릅니다.`,k);
 if(!missing(r.run_id)&&typeof r.run_id!=='string')add('형식 오류','주행 ID는 문자열이어야 합니다.');
 if(r.complete_interval!==undefined&&![true,false,'true','false'].includes(r.complete_interval))add('형식 오류','완료 구간 표시는 true 또는 false여야 합니다.');
 if(r.interval_duration_s!==undefined&&(!num(r.interval_duration_s)||Number(r.interval_duration_s)<=0))add('형식 오류','구간 길이는 양의 숫자여야 합니다.');
 for(const k of ['t_s','ego_speed_kmh','gap_m','lead_speed_kmh','actual_delta_kmh'])if(!missing(r[k])&&!num(r[k]))add('형식 오류',`${k}: 유한한 숫자가 필요합니다.`,k);
 if(!missing(r.road)&&!['dry','wet'].includes(r.road))add('범주 오류','노면은 dry(마름), wet(젖음)인지 원본에서 확인하세요.','road');
 if(!missing(r.source)&&!['student_demo','teacher_demo','model_rollout','guided_practice'].includes(r.source))add('출처 오류','기록 출처를 확인할 수 없습니다.');
 if(num(r.t_s)&&Number(r.t_s)<0)add('기록 오류','시각은 음수일 수 없습니다.');
 if(num(r.gap_m)&&Number(r.gap_m)<0)add('이상치 후보','차체 사이 거리가 음수입니다.','gap_m');
 if(['dry','wet'].includes(r.road)){
  const {cap,brake}=roadSettings(r.road),limit=cap*3.6,eps=1e-7;
  for(const k of ['ego_speed_kmh','lead_speed_kmh'])if(num(r[k])&&(Number(r[k])<0||Number(r[k])>limit+eps))add('이상치 후보',`${k}: 현재 수업 설정의 속도 범위(0–${limit}km/h) 밖입니다.`,k);
  if(num(r.ego_speed_kmh)&&num(r.actual_delta_kmh)){
   const v=Number(r.ego_speed_kmh),delta=Number(r.actual_delta_kmh);
   if(delta < -brake*3.6-eps||delta>7.2+eps||v+delta< -eps||v+delta>limit+eps)add('이상치 후보','1초의 실제 변화량이 제동·가속 한계 또는 정지·속도 상한과 맞지 않습니다.','actual_delta_kmh');
  }
 }
 return out;
}
function quantile(a,q){const x=(a.length-1)*q,i=Math.floor(x);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(x-i);}
export class Review {
 constructor(rows,{practice=false}={}){
  this.raw=clone(rows);this.decisions={};this.splits=Object.create(null);this.events=[];this.practice=practice;this.ratio=.7;this.seed=1;
  for(const r of rows)if(!missing(r.run_id))this.splits[r.run_id]='unassigned';
 }
 locked(i){const r=this.raw[i];return r.source==='guided_practice'?'퀘스트 연습 기록은 학습에 사용하지 않습니다.':r.source==='model_rollout'?'자동 주행은 학생 시범 학습 자료가 아닙니다.':[false,'false'].includes(r.complete_interval)||(num(r.interval_duration_s)&&Math.abs(Number(r.interval_duration_s)-1)>1e-7)?'1초가 아닌 구간: 원본으로 보존하며 학습에서는 제외합니다.':null;}
 effective(i){const d=this.decisions[i];return {...clone(this.raw[i]),...(d?.action==='edit'?d.patch:{})};}
 assign(run,split){if(!Object.hasOwn(this.splits,run)||!['train','validation','unassigned'].includes(split))throw Error('잘못된 주행 배정');this.splits[run]=split;this.events.push({at:new Date().toISOString(),kind:'split',run,split});}
 // 학습·검증은 비율로 나눈다: 이전 이력에서 주행 단위로 배정된 행은 그대로 두고, 나머지 행을 seed로 섞어 앞쪽 ratio만큼 학습에 넣는다.
 setRatio(ratio,seed=this.seed){if(![.6,.7,.8].includes(ratio)||!Number.isInteger(seed)||seed<1)throw Error('잘못된 나누기 비율');this.ratio=ratio;this.seed=seed;this.events.push({at:new Date().toISOString(),kind:'ratio',ratio,seed});}
 autoSplits(){
  const pool=this.raw.map((r,i)=>i).filter(i=>!['train','validation'].includes(this.splits[this.raw[i].run_id])&&!this.locked(i));
  let x=this.seed>>>0||1;const rnd=()=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};
  for(let k=pool.length-1;k>0;k--){const j=Math.floor(rnd()*(k+1));[pool[k],pool[j]]=[pool[j],pool[k]];}
  let n=Math.round(pool.length*this.ratio);if(pool.length>=2)n=Math.min(pool.length-1,Math.max(1,n));
  const out={};pool.forEach((i,k)=>{out[i]=k<n?'train':'validation';});return out;}
 splitOf(i,auto=this.autoSplits()){const run=this.splits[this.raw[i].run_id];return ['train','validation'].includes(run)?run:auto[i]??'unassigned';}
 decide(i,action,reason,patch={}){
  if(!Number.isInteger(i)||!this.raw[i]||this.locked(i))throw Error('처리할 수 없는 행입니다.');
  if(!['keep','edit','exclude'].includes(action)||!reason?.trim())throw Error('처리 방법과 근거를 작성하세요.');
  if(Object.keys(patch).some(k=>!EDITABLE.includes(k)))throw Error('주행 ID·시각·출처는 수정할 수 없습니다.');
  const previous=clone(this.decisions[i]??null);this.decisions[i]={action,reason:reason.trim(),patch:action==='edit'?clone(patch):{}};
  this.events.push({at:new Date().toISOString(),kind:'decision',row:i,previous,next:clone(this.decisions[i])});
 }
 undo(i){this.events.push({at:new Date().toISOString(),kind:'undo',row:i,previous:clone(this.decisions[i]??null)});delete this.decisions[i];}
 // 학습 원본의 1초 실제 변화량 분포(8행 이상일 때만): 사분위수와 울타리(Q1−1.5·IQR, Q3+1.5·IQR). 화면의 IQR 그림도 이 값을 쓴다.
 stats(){
  // Compute statistics only from the original training split; decisions cannot silently move the goalposts.
  const auto=this.autoSplits(),values=this.raw.filter((r,i)=>this.splitOf(i,auto)==='train'&&!this.locked(i)&&problems(r).length===0).map(r=>Number(r.actual_delta_kmh)).sort((a,b)=>a-b);
  if(values.length<8)return {values,ready:false};
  const q1=quantile(values,.25),q3=quantile(values,.75),iqr=q3-q1;return {values,ready:true,q1,q3,iqr,median:quantile(values,.5),lo:q1-1.5*iqr,hi:q3+1.5*iqr};
 }
 candidates(){
  const st=this.stats();
  return this.raw.map(r=>{const out=problems(r);if(st.ready&&num(r.actual_delta_kmh)){
   const v=Number(r.actual_delta_kmh);if(v<st.lo||v>st.hi)out.push({type:'통계적 이상치 후보',field:'actual_delta_kmh',message:'학습 주행의 실제 변화량 분포(IQR)에서 벗어납니다. 실제 급감속일 수 있으므로 원본 근거를 확인하세요.',hard:false});
  }return out;});
 }
 status(){
  const original=this.candidates(),auto=this.autoSplits();const seen=new Map();
  const rows=this.raw.map((r,i)=>{
   const lock=this.locked(i),decision=this.decisions[i],effective=this.effective(i),excluded=!!lock||decision?.action==='exclude';
   const issues=excluded?[]:problems(effective);
   if(!excluded){
    if(this.splitOf(i,auto)==='unassigned')issues.push({hard:true,message:'학습·검증 나누기 비율을 정하세요.'});
    if(original[i].length&&!decision)issues.push({hard:true,message:'문제 후보를 검토하고 유지·수정·제외의 근거를 남기세요.'});
    const key=JSON.stringify([r.run_id,num(r.t_s)?Number(r.t_s):r.t_s]);
    if(seen.has(key)){issues.push({hard:true,message:'같은 주행·시각의 중복입니다. 하나를 제외하세요.'});}else seen.set(key,i);
   }
   return {i,original:r,effective,lock,decision,excluded,issues,candidates:original[i],split:this.splitOf(i,auto)};
  });
  const included=rows.filter(r=>!r.excluded),train=included.filter(r=>r.split==='train'),validation=included.filter(r=>r.split==='validation');
  return {rows,train,validation,blocked:rows.some(r=>r.issues.length)||!train.length||!validation.length,
   total:rows.length,excluded:rows.filter(r=>r.excluded).length,edited:rows.filter(r=>r.decision?.action==='edit').length};
 }
 export(){
  const s=this.status();if(s.blocked)throw Error('미해결 항목을 처리하고, 학습·검증에 각각 행이 들어가도록 나누세요.');
  const csv=rows=>'\ufeff'+[COLUMNS.join(','),...rows.map(({effective:r})=>COLUMNS.map(k=>'"'+String(r[k]).replaceAll('"','""')+'"').join(','))].join('\n');
  // Orange's three header rows declare types and roles, so identifiers cannot become features.
  const tab=rows=>[COLUMNS.join('\t'),['string','continuous','string','continuous','continuous','continuous','dry wet','continuous'].join('\t'),['meta','meta','meta','','','','','class'].join('\t'),...rows.map(({effective:r})=>COLUMNS.map(k=>'"'+String(r[k]).replaceAll('"','""')+'"').join('\t'))].join('\n')+'\n';
  return {train:csv(s.train),validation:csv(s.validation),trainTab:tab(s.train),validationTab:tab(s.validation),bundle:this.audit()};
 }
 audit(){const s=this.status();return {schema_version:1,practice:this.practice,physics_version:'teaching-v0.1',raw:clone(this.raw),learning_context:clone(this.learningContext??[]),decisions:clone(this.decisions),splits:clone(this.splits),split_ratio:this.ratio,split_seed:this.seed,row_splits:Object.fromEntries(s.rows.map(r=>[r.i,r.split])),events:clone(this.events),export_ready:!s.blocked,counts:{raw:s.total,edited:s.edited,excluded:s.excluded,train:s.train.length,validation:s.validation.length}};}
 static restore(data){
  if(!data||data.schema_version!==1||data.physics_version!=='teaching-v0.1'||typeof data.practice!=='boolean'||!Array.isArray(data.raw)||data.raw.length>5000||data.raw.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw Error('지원하는 전처리 이력(v1, 수업 물리 v0.1)이 아닙니다.');
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(!object(data.splits)||!object(data.decisions)||!Array.isArray(data.events))throw Error('전처리 이력의 배정·판단 기록을 확인하세요.');
  const b=new Review(data.raw,{practice:data.practice});
  for(const [run,split] of Object.entries(data.splits))b.assign(run,split);
  if(data.split_ratio!==undefined)b.setRatio(data.split_ratio,data.split_seed??1);
  for(const [i,d] of Object.entries(data.decisions)){
   if(!/^(0|[1-9]\d*)$/.test(i)||!object(d)||typeof d.reason!=='string'||!object(d.patch))throw Error('처리 판단의 형식이 올바르지 않습니다.');
   b.decide(Number(i),d.action,d.reason,d.patch);
  }
  b.events=clone(data.events);b.events.push({at:new Date().toISOString(),kind:'restored'});b.learningContext=Array.isArray(data.learning_context)?clone(data.learning_context):[];
  return b; // Ignore any saved export_ready flag; all gates are recalculated.
 }
}
export function practiceRows(){
 const rows=[];for(const run of ['연습-A','연습-B'])for(let t=0;t<10;t++)rows.push({run_id:run,t_s:t,source:'student_demo',ego_speed_kmh:30,gap_m:40,lead_speed_kmh:25,road:'dry',actual_delta_kmh:0,complete_interval:true,interval_duration_s:1});
 rows[1].gap_m='';rows[2].ego_speed_kmh=300;rows[3].actual_delta_kmh=-8;rows.push({...rows[4]});return rows;
}
export function parseCSV(text){
 text=text.replace(/^\ufeff/,'');const records=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('CSV 따옴표 형식을 확인하세요.');quoted=true;}
  else if(c===','){row.push(field);field='';closed=false;}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v!==''))records.push(row);row=[];field='';closed=false;}
  else{if(closed)throw Error('CSV 구분자를 확인하세요.');field+=c;}
 }
 if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');if(field||row.length){row.push(field);records.push(row);}
 const headers=records.shift();if(!headers||COLUMNS.some(k=>!headers.includes(k))||new Set(headers).size!==headers.length)throw Error('시뮬레이터 CSV의 8개 열 이름을 확인하세요.');
 return records.map(r=>{if(r.length!==headers.length)throw Error('CSV 열 개수가 맞지 않습니다.');return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));});
}
