import {Drive,trainingCSV} from './drive.mjs';
import {roadSettings,requiredDistance} from './motion.mjs';
import {validateModel,predict} from '../model-bridge/predict.mjs';
import {World} from './world.mjs';
import {installReview} from './review-ui.mjs';
import {installLearning} from './learning-ui.mjs';
import {installSessions,SESSIONS} from './session.mjs';
import {course} from './course.mjs';
import {installModelSession} from './model-session-ui.mjs';
import {showSplash,showModelReveal} from './splash.jsx';
import {installHelper} from './helper.mjs';
// 오른쪽 아래 AI 학습 도우미: 실수할 만한 곳을 먼저 짚고, 질문에 답한다.
installHelper();
// 차시가 주소에 없으면(처음 열 때) 시작 화면부터 보여준다. #s2·#s3로 바로 열면 건너뛴다.
const splashDone=location.hash?Promise.resolve():showSplash();
const $=id=>document.getElementById(id),fmt=(n,k=1)=>n.toFixed(k);
let session=null,graphicsError=null,world,model=null,models=[],modelUI=null,d,playing=false,last=0,accumulator=0,history=[],gas=false,brake=false,paint=0,flow=null;
try{world=new World($('world'));}catch(e){graphicsError=e.message;$('overlayTitle').textContent='3D 화면을 열 수 없습니다';$('overlayText').textContent='WebGL을 사용할 수 있는 브라우저에서 다시 열어주세요. '+e.message;$('start').disabled=true;}
function notify(s){$('notice').textContent=s;}
function release(){gas=false;brake=false;if(d)d.pending=0;updatePedals();}
function updatePedals(){const active=playing&&d?.mode==='manual';if(d)d.pending=active?(brake?-roadSettings(d.road).brake*3.6:gas?7.2:0):0;$('gas').classList.toggle('active',active&&gas&&!brake);$('brake').classList.toggle('active',active&&brake);}
function archiveCurrent(){if(d?.t>0&&d.purpose!=='practice'){if(!d.ended)d.stop();history.push(d);}}
function fresh({purpose='collection'}={}){
 const mode=$('mode').value,entry=models.find(m=>m.version===+$('modelVersion').value)??models.at(-1),selected=mode==='model'?entry?.model??null:null;
 const courseId=session===3&&purpose!=='improvement'?$('course').value:'A';
 let next;try{next=new Drive({road:$('surface').value,gap:+$('initialGap').value,mode,course:courseId,purpose,predictor:selected?r=>predict(selected,r):null,runId:crypto.randomUUID()});}catch(e){notify(e.message);return false;}
 archiveCurrent();playing=false;release();d=next;d.modelSnapshot=selected;if(selected){d.modelLabel=entry.label;d.modelVersion=entry.version;}
 document.body.dataset.drive=d.mode;if(world)world.cabin=session===3&&d.mode==='model'?'driverless':null;accumulator=0;notify('');render();return true;
}
function endRun(){if(session!==3||d.endShown)return;d.endShown=true;if(d.mode==='model')modelUI.onEnd(d);else notify('개선용 기록을 마쳤습니다. 결과 비교·재학습 창에서 전처리로 이어가세요.');}
function startRun(){if(needsModel())return;if(session===3&&modelUI.beforeStart(d))return;if(!flow?.handleStart())play();}
function practice(index){archiveCurrent();playing=false;release();d=new Drive({runId:crypto.randomUUID(),purpose:'practice',speed:[10,20,20,0][index],gap:40});
 d.lead.v=index===3?0:25/3.6;d.leadAcceleration=()=>index===3?(d.t<2?0:d.lead.v<25/3.6?1.7:0):0;accumulator=0;render();}
function play(){if(!world||d.ended)return;playing=true;last=performance.now();accumulator=0;release();render();}
function pause(){playing=false;release();accumulator=0;render();}
function tick(){try{updatePedals();d.step();flow?.onTick(d);if(d.ended){playing=false;release();endRun();}}catch(e){notify(e.message);d.stop();playing=false;release();}}
function render(){
 if(!d)return;const i=d.inputs();$('speed').textContent=fmt(i.ego_speed_kmh,0);$('speedBar').style.width=Math.min(100,i.ego_speed_kmh/50*100)+'%';
 for(const [id,n,unit] of [['gap',i.gap_m,'m'],['lead',i.lead_speed_kmh,'km/h'],['time',d.t,'초']])$(id).innerHTML=`${fmt(n)}<small>${unit}</small>`;
 $('roadLabel').textContent=d.road==='wet'?'젖은 노면':'마른 노면';$('speedLimit').textContent=`속도 상한 ${d.road==='wet'?40:50} km/h`;$('progress').textContent=`${fmt(d.ego.x,0)} / 160 m`;$('count').textContent=d.rows.length;
 $('phase').textContent=course(d.course).phase(d.t);
 const action=d.mode==='model'?'모델이 운전 중':brake?'브레이크 작동 중':gas?'가속 중':i.ego_speed_kmh<.01?'정지':'속도 유지';
 $('action').textContent=d.ended?({collision:'충돌 · 주행 종료',completed:'완주',timeout:'제한 시간 종료',manual_abort:'주행 종료'}[d.ended]):playing?action:'일시정지 · 조작 대기';
 $('warning').hidden=!playing||i.gap_m>=requiredDistance(i.ego_speed_kmh,d.road);$('warning').textContent='프로그램 기준 거리 미달 · 간격을 확인하세요';
 // 주행 중간에 멈추면 안내 창 없이 화면만 멈추고, 일시정지 버튼이 ▶(이어 달리기)로 바뀐다. 퀘스트·주행 시작 전·종료 후에는 안내 창을 그대로 띄운다.
 const quiet=!playing&&d.t>0&&!d.ended&&d.purpose!=='practice'&&!graphicsError;
 $('overlay').hidden=playing||quiet;$('pause').disabled=!playing&&!quiet;$('pause').classList.toggle('resume',quiet);$('pause').title=$('pause').ariaLabel=quiet?'이어 달리기 (Space)':'일시정지 (Space)';$('finish').disabled=!!d.ended;$('recordsBtn').disabled=!collectedRuns().some(r=>r.trace.length);for(const id of ['gas','brake'])$(id).disabled=!playing||d.mode==='model';
 $('overlayTag').textContent=d.mode==='model'?'학습 모델 · 자동 운전':'직접 운전 · 연습 코스';
 if(d.ended){$('overlayTitle').textContent=d.ended==='collision'?'앞차와 충돌했습니다':d.ended==='completed'?'코스를 완주했습니다':'주행을 마쳤습니다';$('overlayText').textContent=`주행 ${fmt(d.t)}초 · 최소 거리 ${fmt(d.minGap)}m. 기록 보기에서 실제 속도 변화와 조작 이력을 확인하세요.`;}
 else{$('overlayTitle').textContent=d.t?'잠시 멈췄습니다':'앞차를 따라 달려보세요';$('overlayText').textContent=d.mode==='model'?'불러온 모델이 매초 속도 변화량을 제안합니다. 연결 시험 모델은 안전한 운전 모델이 아닙니다.':'가속·브레이크 버튼 또는 ↑·↓ 키를 누르고 있는 동안 반응합니다. 버튼을 놓으면 현재 속도를 유지합니다.';}
 if(graphicsError){$('overlayTitle').textContent='3D 화면을 열 수 없습니다';$('overlayText').textContent='WebGL 지원 브라우저에서 열어주세요. '+graphicsError;}
 $('start').textContent=d.t?'주행 계속':d.intent?'주행 시작':'내 기준 정하고 시작';$('start').hidden=!!d.ended;$('newRun').hidden=!d.ended;world?.render(d);flow?.decorate(d,playing);if(session===3){decorateModelSession();overlayFx();}
}
// 3차시 안내 카드도 2차시 퀘스트 카드처럼, 나타나거나 제목이 바뀔 때마다 위아래로 펼쳐지며 지지직 등장한다.
let overlayKey='';
function overlayFx(){const key=$('overlay').hidden?'':$('overlayTitle').textContent+'|'+$('start').textContent;if(key&&key!==overlayKey){const c=$('overlayCard');c.classList.remove('fxGlitch','fxUnfold');void c.offsetWidth;c.classList.add('fxUnfold');}overlayKey=key;}
function bindPedal(id,which){const b=$(id),set=v=>{if(which==='gas')gas=v;else brake=v;updatePedals();};b.addEventListener('pointerdown',e=>{if(b.disabled)return;e.preventDefault();b.setPointerCapture(e.pointerId);set(true);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>set(false));b.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();set(true);}});b.addEventListener('keyup',()=>set(false));b.addEventListener('blur',()=>set(false));b.addEventListener('contextmenu',e=>e.preventDefault());}
bindPedal('gas','gas');bindPedal('brake','brake');
window.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;
 const k=e.key.toLowerCase();if(['arrowup','arrowdown','w','s',' '].includes(k))e.preventDefault();
 if(k===' '&&!e.repeat){if(playing)pause();else startRun();return;}
 if(!playing||d.mode!=='manual')return;if(['arrowup','w'].includes(k))gas=true;if(['arrowdown','s'].includes(k))brake=true;updatePedals();
});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(['arrowup','w'].includes(k))gas=false;if(['arrowdown','s'].includes(k))brake=false;updatePedals();});
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function needsModel(){if(session===3&&d.mode!=='model'&&d.purpose!=='improvement'){pause();$('mode').value='model';$('settings').showModal();return true;}return false;}
$('start').onclick=()=>{startRun();$('start').blur();};$('pause').onclick=()=>{if(playing)pause();else{startRun();$('pause').blur();}};$('finish').onclick=()=>{pause();d.stop();render();if(session===3)endRun();else flow?.runEnded(d);};$('newRun').onclick=()=>{flow?.exitPractice();if(fresh({purpose:session===3&&d.purpose==='improvement'?'improvement':'collection'})){if(d.mode==='manual')flow.showIntent();else startRun();}};
$('settingsBtn').onclick=()=>{pause();$('settings').showModal();};$('apply').onclick=()=>{flow?.exitPractice();if(fresh())$('settings').close();};$('initialGap').oninput=()=>{$('initialLabel').textContent=$('initialGap').value+'m';};
$('camera').onclick=()=>{if(!world)return;world.view=world.view==='chase'?'driver':'chase';$('camera').textContent=world.view==='chase'?'운전자 시점':'차량 뒤 시점';render();};
// 모델 파일을 고르면 '사용할 모델' 칸이 입력받듯 반짝이고, 그 아래에 주황 안내가 띠링 튀어나온다.
function modelPicked(){for(const [id,cls] of [['modelVersion','gotInput'],['modelPicked','ding']]){const el=$(id);el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}$('modelPicked').hidden=false;if(session===3)showModelReveal({label:'모델 '+$('modelVersion').value});}
$('modelFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2000000)throw Error('2MB 이하 모델을 선택하세요.');model=validateModel(JSON.parse(await file.text()));const version=models.length+1;models.push({version,label:'모델 '+version,name:file.name,loadedAt:new Date().toISOString(),model,probes:{}});syncModelChoices();$('modelVersion').value=version;modelPicked();}catch(err){$('modelInfo').textContent=err.message;}e.target.value='';};
function syncModelChoices(){$('modelVersion').replaceChildren(...models.map(m=>new Option(`${m.label} · ${m.name}`,m.version)));$('modelVersion').disabled=!models.length;}syncModelChoices();
function collectedRuns(){return [...history,d].filter(r=>r.purpose!=='practice');}
function selectedRun(){return collectedRuns()[+$('runList').value]??d;}
function showRows(){const run=selectedRun();$('summary').textContent=`${run.road==='wet'?'젖은':'마른'} 노면 · ${run.mode==='manual'?'직접':'자동'} 운전 · ${fmt(run.t)}초 · 최소 거리 ${fmt(run.minGap)}m · 기준 미달 ${fmt(run.violations)}초`;
 $('rows').innerHTML=run.rows.map(r=>`<tr><td>${fmt(r.t_s)}초</td><td>${fmt(r.ego_speed_kmh)}</td><td>${fmt(r.gap_m)}m</td><td>${fmt(r.requested_delta_kmh)}</td><td>${fmt(r.actual_delta_kmh)}</td><td>${r.complete_interval?'1초':fmt(r.interval_duration_s,2)+'초 (부분)'}</td></tr>`).join('');$('csv').disabled=run.mode!=='manual'||!run.rows.some(r=>r.complete_interval);}
$('recordsBtn').onclick=()=>{pause();const runs=collectedRuns();if(!runs.length)return;$('runList').replaceChildren(...runs.map((r,i)=>new Option(`주행 ${i+1} · ${fmt(r.t)}초`,i)));$('runList').value=runs.length-1;showRows();$('records').showModal();};$('runList').onchange=showRows;$('closeRecords').onclick=()=>$('records').close();
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('csv').onclick=()=>{const r=selectedRun();download(r.runId+'.csv',trainingCSV(r),'text/csv;charset=utf-8');};$('json').onclick=()=>{const r=selectedRun();download(r.runId+'.json',JSON.stringify({schema_version:2,physics_version:'teaching-v0.1',manual_control:'continuous-pedal',road:r.road,mode:r.mode,ended:r.ended,intent:r.intent,reflections:r.reflections,quest_completed_count:r.quest_completed_count,rows:r.rows,in_progress_interval:r.current,trace:r.trace,model:r.mode==='model'?r.modelSnapshot:null},null,2),'application/json');};
function frame(now){if(playing){const elapsed=(now-last)/1000;if(elapsed>.3){pause();notify('화면 응답이 늦어져 일시정지했습니다. ▶ 버튼이나 Space로 이어 달리세요.');}else{accumulator+=elapsed;while(accumulator>=.02&&playing){tick();accumulator-=.02;}if(now-paint>30){render();paint=now;}}}last=now;requestAnimationFrame(frame);}
fresh();
const review=installReview({getRuns:collectedRuns,pause});
flow=installLearning({getRun:()=>d,getRuns:collectedRuns,startPractice:practice,startCollection:fresh,play,pause,render,openReview:()=>review.open()});render();
// 3차시: 운전대 없는 실내에서 학습 모델의 자동 주행을 보고, 예상·분석·재학습·비교로 이어간다. 퀘스트는 2차시에서 한다.
function decorateModelSession(){
 const hasModel=d.mode==='model'&&!!d.modelSnapshot,improve=d.purpose==='improvement';modelUI.decorate(d);
 $('overlayTag').textContent=improve?'3차시 · 개선용 기록 주행 (A 코스)':`3차시 ${course(d.course).short}`;
 if(improve)return;
 if(!d.t&&!d.ended){
  const title=hasModel?'모델 운전 준비 완료':'먼저 학습한 모델을 불러오세요',titleEl=$('overlayTitle');
  // 제목이 바뀔 때마다 지지직(글리치)으로 다시 나타나게 한다.
  if(titleEl.textContent!==title){titleEl.textContent=title;titleEl.classList.remove('glitchText');void titleEl.offsetWidth;titleEl.classList.add('glitchText');}
  $('overlayText').textContent=hasModel?(d.forecast?'예상을 저장했습니다. 모델이 1초마다 속도 변화량을 정합니다.':'먼저 출발 전, 모델의 판단과 이번 주행의 결과를 예상해보세요.'):'주행 설정에서 2차시에 저장한 모델 JSON을 선택하고 “설정 적용”을 누르세요.';
  $('start').textContent=hasModel?(d.forecast?'자동 주행 시작':'예상해보기'):'모델 불러오기';}
 else if(d.ended&&d.mode==='model'){$('overlayText').textContent=`주행 ${fmt(d.t)}초 · 최소 거리 ${fmt(d.minGap)}m. 결과 비교·보고서에서 장면을 분석하세요.`;}
}
modelUI=installModelSession({getRun:()=>d,getRuns:collectedRuns,getModels:()=>models,pause,play,countdown:()=>flow.countdown(),
 openReview:()=>flow.preprocess(),
 startModelRun({version,course:c,road,gap}){$('mode').value='model';$('modelVersion').value=version;$('course').value=c;$('surface').value=road;$('initialGap').value=gap;$('initialLabel').textContent=gap+'m';flow.exitPractice();return fresh();},
 startImprovementRun(){$('mode').value='manual';flow.exitPractice();if(fresh({purpose:'improvement'}))flow.showIntent();}});
$('evalBtn').onclick=()=>modelUI.showCompare();
const sessions=installSessions({gate:splashDone,onChoose:n=>{session=n;if(world){world.cabin=n===3?'driverless':null;world.view='driver';$('camera').textContent='차량 뒤 시점';}
 flow.setSession(n);if(n===3){flow.exitPractice();$('mode').value='model';if(models.length)fresh();else{archiveCurrent();d=new Drive({runId:crypto.randomUUID()});document.body.dataset.drive='model';}}else{$('mode').value='manual';$('course').value='A';document.body.dataset.drive='manual';flow.startQuests();}
 render();}});
$('toReview').onclick=()=>{$('records').close();flow.preprocess();};
$('toReflection').onclick=()=>{$('records').close();flow.showReflection(selectedRun());};
requestAnimationFrame(frame);
