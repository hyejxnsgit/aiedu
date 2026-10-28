// 3차시 화면: 결과 예상 → 자동 주행 결과 → 장면 분석 → 재학습·비교·보고서.
// 학생이 먼저 고른 뒤 모델값을 공개하고, 분석 화면은 저장된 주행 기록만 다시 보여준다.
import {PROBES,PROBE_QUESTIONS,PROBE_FRAME,probeClip,BINS,OUTCOMES,probeResult,forecastComplete,forecastCheck,summarize,analysisScenes,decisionAt,CAUSES,analysisComplete,comparison,conditionKey,REPORT_FIELDS,reportComplete} from './evaluate.mjs';
import {COURSES,course} from './course.mjs';
import {sampleAt,replayState} from './learning.mjs';
import {World} from './world.mjs';
import {helperEvent} from './helper.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f1=n=>Number.isFinite(n)?n.toFixed(1):'-';
const signed=n=>(n>0?'+':'')+f1(n);
const roadName=r=>r==='wet'?'젖은 노면':'마른 노면';
const binLabel=id=>BINS.find(b=>b.id===id)?.label??'-';

export function installModelSession({getRun,getRuns,getModels,startModelRun,startImprovementRun,openReview,pause,play,countdown=play}){
 const host=document.createElement('div');host.innerHTML=`
 <dialog id="forecastDialog" class="evalDialog"><div class="dialogHead"><div><h2>출발 전에 예상해 보기</h2><p id="forecastWho" class="evalTag"></p></div><button id="forecastClose" class="closeBtn" aria-label="닫기" title="닫기"><svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button></div>
 <section id="probeSection"><h3>1. 이 장면에서 모델은 1초 동안 속도를 얼마나 바꿀까요?</h3><p class="subtle">맞히기 점수가 아니라, 모델이 배운 것을 짐작해 보는 활동입니다.</p><div id="probeCards" class="probeCards"></div><p id="probeReuse" class="probeReuse" hidden><span>같은 모델·같은 노면에서 했던 예상을 불러왔어요.</span><button type="button" id="probeReset">처음부터 다시 예상하기</button></p></section>
 <section><h3 id="runForecastTitle">2. 이번 주행은 어떻게 끝날까요?</h3><div class="evalTwo"><label>주행 결과<select id="fcOutcome"><option value="">예상 선택</option>${['completed','collision','timeout'].map(k=>`<option value="${k}">${OUTCOMES[k]}</option>`).join('')}</select></label>
 <label>프로그램 기준 거리보다 가까워지는 순간이<select id="fcViolation"><option value="">예상 선택</option><option value="yes">있을 것 같다</option><option value="no">없을 것 같다</option></select></label></div>
 <label>왜 그렇게 예상했나요?<textarea id="fcReason" rows="2" placeholder="예: 위의 멈춘 앞차 장면에서 모델이 크게 감속했으니 충돌하지 않을 것 같다."></textarea></label></section>
 <p id="forecastMessage" role="status" class="evalMessage"></p><button id="forecastGo" class="start">예상 저장하고 자동 주행 시작</button></dialog>

 <dialog id="resultDialog" class="evalDialog"><div class="dialogHead"><div><h2>자동 주행 결과</h2><p id="resultWho" class="evalTag"></p></div><button id="resultClose" class="closeBtn" aria-label="닫기" title="닫기"><svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button></div>
 <div id="resultFacts" class="resultFacts"></div><div id="resultCheck" class="resultAsk"></div>
 <p class="subtle">결과는 이번 코스·노면·처음 거리에서 한 번 달린 사실입니다. 다른 조건에서도 같을지는 따로 확인해야 합니다.</p>
 <div class="downloads"><button id="resultAnalyze" class="start">장면 골라 원인 분석하기</button><button id="resultCompare">결과 비교·재학습</button></div></dialog>

 <dialog id="analysisDialog" class="reflectionDialog"><div class="dialogHead"><div><h2>문제·주의 장면 분석</h2><p id="analysisWho" class="evalTag"></p></div><button id="analysisClose" class="closeBtn" aria-label="닫기" title="닫기"><svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button></div>
 <label>분석할 장면 (앞뒤 3초)<select id="analysisScene"></select></label><div class="reflectionGrid"><section><div class="replayViewport"><canvas id="analysisCanvas" aria-label="저장된 자동 주행 장면 다시 보기"></canvas><span id="analysisTime"></span></div>
 <div class="replayControls"><button id="analysisPlay">장면 재생</button><label>장면 시각<input id="analysisSlider" type="range" min="0" max="1" step="0.02"></label></div>
 <p id="analysisNow" class="sceneFacts"></p><div id="analysisDecision" class="decisionCard"></div></section>
 <section><label>1. 왜 이런 장면이 생겼다고 생각하나요?<select id="analysisCause"><option value="">원인 가설 선택</option>${CAUSES.map(c=>`<option>${c}</option>`).join('')}</select></label>
 <label>2. 어떤 기록이 그렇게 생각하게 했나요?<textarea id="analysisEvidence" rows="3" placeholder="예: 9초에 거리가 11m인데 모델은 −2km/h만 제안했다. 2차시 기록에는 이렇게 가까운 장면이 적었다."></textarea></label>
 <label>3. 다시 학습하기 전에 무엇을 더 기록하거나 바꿀까요?<textarea id="analysisPlan" rows="3" placeholder="예: 앞차가 멈춰 있을 때 10m 안쪽에서 확실히 멈추는 주행을 두 번 더 기록한다."></textarea></label>
 <button id="analysisSave" class="start">분석 저장</button><p id="analysisMessage" role="status" class="evalMessage"></p>
 <p class="subtle">이 화면은 저장된 주행을 다시 보여줍니다. 지금 모델로 과거 주행을 다시 계산하지 않습니다.</p><button id="analysisToCompare">재학습·비교로</button></section></div></dialog>

 <dialog id="compareDialog" class="evalDialog wide"><div class="dialogHead"><h2 id="cmpTitle">재학습</h2><button id="compareClose" class="closeBtn" aria-label="닫기" title="닫기"><svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button></div>
 <ol class="rvSteps cmpSteps" id="cmpSteps"><li data-go="1"><b>1</b>재학습</li><li data-go="2"><b>2</b>결과 비교</li><li data-go="3"><b>3</b>보고서</li></ol>
 <section class="cmpStep" data-step="1"> <h3>기록을 보완해 다시 학습하기</h3><ol class="retrainSteps">
 <li>장면 분석에서 정한 보완 장면을 <b>직접 운전해 새로 기록</b>합니다. 자동 주행 기록은 학습 자료에 넣지 않습니다. <button id="improveRun">개선용 기록 운전</button></li>
 <li><b>전처리</b>에서 “2차시 처리 이력에 이어 붙이기”를 켜고 2차시에 저장한 <code>preprocessing-audit.json</code>을 불러온 뒤, 새 주행을 학습용·검증용으로 배정해 <code>train.tab</code>을 저장합니다. <button id="improveReview">전처리 열기</button></li>
 <li>Orange의 모델 저장 워크플로에서 File을 새 <code>train.tab</code>으로 바꾸면 저장 창이 뜹니다. <code>model-2.json</code>처럼 다른 이름으로 저장합니다.</li>
 <li>주행 설정에서 새 모델을 불러온 뒤, 위 표에서 <b>첫 모델과 같은 조건</b>으로 A 코스를 달리고, 마지막에 <b>B 코스</b>로 확인합니다.</li></ol>
</section>
 <section class="cmpStep" data-step="2"> <h3>같은 조건끼리 결과 비교하기</h3><p class="subtle">같은 코스·노면·처음 거리에서 달린 결과끼리만 모델을 비교하세요. 표시(●)가 있는 행은 다른 모델과 같은 조건입니다.</p>
 <div class="tablewrap"><table class="evalTable"><thead><tr><th></th><th>모델</th><th>코스</th><th>노면</th><th>처음 거리</th><th>결과</th><th>최소 거리</th><th>기준 미달</th><th>예상</th><th>분석</th></tr></thead><tbody id="compareRows"></tbody></table></div>
 <div class="runForm"><label>모델<select id="cmpModel"></select></label><label>코스<select id="cmpCourse">${Object.values(COURSES).map(c=>`<option value="${c.id}">${c.label}</option>`).join('')}</select></label><label>노면<select id="cmpRoad"><option value="dry">마른 노면</option><option value="wet">젖은 노면</option></select></label><label>처음 거리<select id="cmpGap">${[20,30,40,50,60].map(g=>`<option ${g===40?'selected':''}>${g}</option>`).join('')}</select></label><button id="cmpRun" class="start">이 조건으로 자동 주행</button></div>
 <p id="compareMessage" role="status" class="evalMessage"></p>
</section>
 <section class="cmpStep" data-step="3"> <h3>모둠 보고서 쓰기</h3><div class="reportGrid">${REPORT_FIELDS.map(([k,t,p])=>`<label>${t}<textarea data-report="${k}" rows="2" placeholder="${esc(p)}"></textarea></label>`).join('')}</div>
 <div class="downloads"><button id="reportSave" class="start">3차시 결과 파일 저장</button></div><p id="reportMessage" role="status" class="evalMessage"></p></section>
 <div class="rvNav"><button id="cmpPrev">이전 단계</button><button id="cmpNext" class="start">다음 단계</button></div></dialog>`;
 document.body.append(host);
 const $=id=>document.getElementById(id);
 let forecastRun=null,analysisRun=null,scenes=[],scene=null,replayWorld=null,replaying=false,replayTime=0,replayLast=0;
 const report={};
 const who=run=>`${run.modelLabel??'모델'} · ${course(run.course??'A').short} · ${roadName(run.road)} · 처음 거리 ${run.startGap}m`;

 // 1. 결과 예상
 function probesFor(run){const m=getModels().find(x=>x.version===run.modelVersion);return m?(m.probes[run.road]??=[]):[];}
 function renderProbes(run){
  const done=probesFor(run);$('probeSection').hidden=false;
  $('probeCards').replaceChildren(...PROBES.map((p,i)=>{const r=done.find(x=>x.probe_id===p.id),card=document.createElement('article');card.className='probeCard';
   card.innerHTML=`<h4>${i+1}. ${p.title}</h4><p>내 차 <b>${p.input.ego_speed_kmh}km/h</b> · 차간거리 <b>${p.input.gap_m}m</b> · 앞차 <b>${p.input.lead_speed_kmh}km/h</b> · ${roadName(run.road)}</p>
   <ol class="probeAsk">${(PROBE_QUESTIONS[p.id]??[]).map(q=>`<li>${q}</li>`).join('')}</ol>
   <textarea class="probeWhy" rows="2" placeholder="${PROBE_FRAME}" ${r?'disabled':''}>${r?.reason??''}</textarea>
   <label>내 예상<select ${r?'disabled':''}><option value="">고르기</option>${BINS.map(b=>`<option value="${b.id}" ${r?.choice===b.id?'selected':''}>${b.label}</option>`).join('')}</select></label>
   ${r?`<p class="reveal ${r.same?'same':'diff'}">모델: <b>${signed(r.model_delta_kmh)}km/h</b> · ${binLabel(r.model_bin)} · ${r.same?'내 예상과 같은 방향':'내 예상과 다름'}</p>`:'<button>모델 값 보기</button>'}`;
   card.querySelector('button')?.addEventListener('click',()=>{try{const why=card.querySelector('.probeWhy').value.trim();done.push({...probeResult(p,run.road,card.querySelector('select').value,run.predictor),...(why?{reason:why}:{})});renderProbes(run);}catch(e){$('forecastMessage').textContent=e.message;}});
   card.dataset.i=i;card.tabIndex=-1;return card;}));
  // 아직 안 한 첫 칸의 '내 예상'만 주황으로 반짝여 1 → 2 → 3 순서를 안내한다.
  $('probeReuse').hidden=!done.length;
  const next=PROBES.findIndex(p=>!done.some(x=>x.probe_id===p.id));$('probeCards').querySelectorAll('.probeCard').forEach((c,i)=>c.classList.toggle('nextProbe',i===next));
 }
 // 예상 칸에 마우스를 올리면(또는 키보드로 들어가면) 칸 아래 말풍선에 그 장면 직전 2초를 반복해 보여준다.
 let probeWorld=null,probeRaf=0,probeTip=null,probeOn=null;
 function showProbeClip(card){if(probeOn===card)return;hideProbeClip();probeOn=card;const p=PROBES[+card.dataset.i],run=forecastRun;
  if(!probeTip){probeTip=document.createElement('div');probeTip.className='probeTip';probeTip.innerHTML='<div class="probeClipBox"><canvas></canvas></div><p></p>';}
  card.append(probeTip);probeTip.querySelector('p').textContent=`${p.title} · 이 순간까지의 2초`;
  if(!probeWorld)try{probeWorld=new World(probeTip.querySelector('canvas'),{view:'chase'});}catch{probeTip.querySelector('.probeClipBox').hidden=true;return;}
  const clip=probeClip(p,run?.road),T=clip.at(-1).t_s,start=performance.now();
  const loop=now=>{const t=((now-start)/1000)%(T+0.8);probeWorld.resize();probeWorld.render(replayState(sampleAt({trace:clip},Math.min(t,T))));probeRaf=requestAnimationFrame(loop);};probeRaf=requestAnimationFrame(loop);}
 function hideProbeClip(){cancelAnimationFrame(probeRaf);probeTip?.remove();probeOn=null;}
 $('probeCards').addEventListener('mouseover',e=>{const c=e.target.closest('.probeCard');if(c)showProbeClip(c);});
 $('probeCards').addEventListener('focusin',e=>{const c=e.target.closest('.probeCard');if(c)showProbeClip(c);});
 $('probeCards').addEventListener('mouseleave',hideProbeClip);
 $('probeCards').addEventListener('focusout',e=>{if(!$('probeCards').contains(e.relatedTarget))hideProbeClip();});
 function showForecast(run){pause();forecastRun=run;$('forecastWho').textContent=who(run);$('forecastMessage').textContent='';
  for(const [id,k] of [['fcOutcome','outcome'],['fcViolation','violation'],['fcReason','reason']])$(id).value=run.forecast?.[k]??'';
  renderProbes(run);$('forecastDialog').showModal();}
 // 다른 코스로 바꿔 달릴 때 등, 이전 장면 예상을 지우고 새로 고를 수 있다(모델 값은 다시 계산된다).
 $('probeReset').onclick=()=>{const done=probesFor(forecastRun);done.splice(0,done.length);$('forecastMessage').textContent='';renderProbes(forecastRun);$('probeCards').querySelector('select')?.focus();};
 $('forecastClose').onclick=()=>$('forecastDialog').close();$('forecastDialog').addEventListener('close',hideProbeClip);
 $('forecastGo').onclick=()=>{const run=forecastRun,f={outcome:$('fcOutcome').value,violation:$('fcViolation').value,reason:$('fcReason').value.trim(),at:new Date().toISOString()};
  if(probesFor(run).length<PROBES.length){$('forecastMessage').textContent='세 장면 모두 내 예상을 고르고 모델 값을 확인하세요.';return;}
  if(!forecastComplete(f)){$('forecastMessage').textContent='주행 결과, 기준 거리, 예상한 이유를 모두 남겨주세요.';return;}
  run.forecast=f;run.probes=structuredClone(probesFor(run));$('forecastDialog').close();helperEvent({type:'forecast',reason:f.reason});countdown();};

 // 2. 결과
 function showResult(run){pause();analysisRun=run;$('resultWho').textContent=who(run);const s=summarize(run),c=forecastCheck(run.forecast,run);
  // 예상이 있으면 정답(결과·기준 미달)을 모자이크로 가려 두고, 질문을 읽은 뒤 눌러서 확인하게 한다.
  const hide=k=>c?` class="masked" data-reveal="${k}" role="button" tabindex="0" title="눌러서 결과 확인"`:'';
  $('resultFacts').innerHTML=[['결과',s.outcome,'outcome'],['주행 시간',f1(s.t_s)+'초'],['최소 차간거리',f1(s.min_gap_m)+'m'],['기준 거리 미달',f1(s.violation_s)+'초'+(s.first_violation_s!=null?` (처음 ${f1(s.first_violation_s)}초)`:''),'violation'],['가장 강한 감속 제안',s.strongest_brake_kmh==null?'-':signed(s.strongest_brake_kmh)+'km/h']].map(([k,v,r])=>`<div><span>${k}</span><b${r?hide(r):''}>${v}</b></div>`).join('');
  const ASK={completed:'실제로 끝까지 완주하였나요?',collision:'실제 주행에서 앞차와 충돌이 있었나요?',timeout:'실제로 제한 시간 안에 못 갔나요?'};
  $('resultCheck').innerHTML=c?[
   ['outcome',`<b>“${c.outcome.expected}”</b>(으)로 끝날 것이라고 예상했습니다.`,ASK[run.forecast.outcome]??'실제 결과는 어땠나요?',c.outcome],
   ['violation',`기준 거리보다 가까워지는 순간이 <b>${run.forecast.violation==='yes'?'있을':'없을'}</b> 것이라고 예상했습니다.`,'실제 주행에서 그런 순간이 있었나요?',c.violation]]
   .map(([k,said,ask,x])=>`<div class="askRow"><p>${said}<br><span class="askQ">${ask}</span></p><button type="button"${hide(k)}><b>${x.actual}</b><em class="${x.same?'same':'diff'}">${x.same?'예상과 같음':'예상과 다름'}</em></button></div>`).join('')
   +`<p class="askWhy"><span>예상한 이유</span>${esc(run.forecast.reason)}</p>`:'<p class="subtle">이 주행은 출발 전 예상이 없습니다.</p>';
  for(const el of $('resultDialog').querySelectorAll('[data-reveal]')){const open=()=>{for(const m of $('resultDialog').querySelectorAll(`[data-reveal="${el.dataset.reveal}"]`))m.classList.remove('masked');
    // 정답을 모두 열어 본 뒤에만 도우미가 말한다(먼저 말하면 답을 알려 주는 셈).
    if(c&&!$('resultDialog').querySelector('.masked'))helperEvent({type:'result',outcomeSame:c.outcome.same,violationSame:c.violation.same});};el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};}
  if(!$('resultDialog').open)$('resultDialog').showModal();}
 $('resultClose').onclick=()=>$('resultDialog').close();
 $('resultAnalyze').onclick=()=>{$('resultDialog').close();showAnalysis(analysisRun);};
 $('resultCompare').onclick=()=>{$('resultDialog').close();showCompare('',2);};

 // 3. 장면 분석
 function showAnalysis(run){pause();if(!run?.trace?.length||run.mode!=='model'){showCompare('분석할 자동 주행이 없습니다. 먼저 모델로 달려보세요.');return;}
  analysisRun=run;scenes=analysisScenes(run);$('analysisWho').textContent=who(run);
  $('analysisScene').replaceChildren(...scenes.map((s,i)=>new Option(`${s.kind==='result'?'⚠ ':''}${s.title} · ${s.t.toFixed(1)}초${run.analyses?.[s.id]?' · 분석함':''}`,i)));
  if(!$('analysisDialog').open)$('analysisDialog').showModal();
  if(!replayWorld)try{replayWorld=new World($('analysisCanvas'),{view:'chase'});}catch{$('analysisNow').textContent='3D 재생을 열 수 없습니다. 아래 수치로 확인하세요.';}
  sceneSelected();}
 function sceneSelected(){scene=scenes[Number($('analysisScene').value)];replaying=false;$('analysisPlay').textContent='장면 재생';if(!scene)return;
  const saved=analysisRun.analyses?.[scene.id];$('analysisCause').value=saved?.cause??'';$('analysisEvidence').value=saved?.evidence??'';$('analysisPlan').value=saved?.plan??'';$('analysisMessage').textContent='';
  $('analysisSlider').min=scene.from;$('analysisSlider').max=scene.to;replayTime=scene.t;paint();}
 function paint(){if(!scene)return;const s=sampleAt(analysisRun,replayTime);$('analysisSlider').value=replayTime;$('analysisTime').textContent=`저장된 주행 ${s.t_s.toFixed(2)}초`;
  $('analysisNow').innerHTML=`이 순간: 내 차 <b>${f1(s.ego_speed_kmh)}</b>km/h · 앞차 <b>${f1(s.lead_speed_kmh)}</b>km/h · 차간거리 <b>${f1(s.gap_m)}m</b> / 프로그램 기준 ${f1(s.required_gap_m)}m ${s.collision?'· <b class="bad">충돌</b>':s.violation?'· <b class="bad">기준 미달</b>':'· 기준 이상'}`;
  const d=decisionAt(analysisRun,s.t_s);
  $('analysisDecision').innerHTML=d?`<h4>이 순간을 포함한 1초 판단 (${f1(d.t_s)}초 시작)</h4><ol class="decisionFlow"><li><span>모델이 본 값</span>내 차 ${f1(d.ego_speed_kmh)}km/h · 거리 ${f1(d.gap_m)}m · 앞차 ${f1(d.lead_speed_kmh)}km/h · ${roadName(d.road)}</li><li><span>모델 제안</span><b>${signed(d.requested_delta_kmh)}km/h</b></li><li><span>프로그램 적용</span>${d.limited?`${d.limit_reason} 때문에 ${signed(d.applied_delta_kmh)}km/h까지만`:'제안 그대로'}</li><li><span>1초 뒤 실제 변화</span>${d.complete_interval?signed(d.actual_delta_kmh)+'km/h':`${f1(d.interval_duration_s)}초에서 끝남 (부분 구간)`}</li></ol>`:'';
  if(replayWorld){replayWorld.resize();replayWorld.render(replayState(s));}}
 $('analysisScene').onchange=sceneSelected;
 $('analysisSlider').oninput=()=>{replaying=false;replayTime=Number($('analysisSlider').value);$('analysisPlay').textContent='장면 재생';paint();};
 $('analysisPlay').onclick=()=>{if(!scene)return;replaying=!replaying;if(replaying&&replayTime>=scene.to)replayTime=scene.from;replayLast=performance.now();$('analysisPlay').textContent=replaying?'재생 멈춤':'장면 재생';};
 (function animate(now){if(replaying&&$('analysisDialog').open&&scene){replayTime=Math.min(scene.to,replayTime+Math.min(.1,(now-replayLast)/1000));paint();if(replayTime>=scene.to){replaying=false;$('analysisPlay').textContent='다시 재생';}}replayLast=now;requestAnimationFrame(animate);})(performance.now());
 $('analysisDialog').addEventListener('close',()=>{replaying=false;});$('analysisClose').onclick=()=>$('analysisDialog').close();
 $('analysisSave').onclick=()=>{const a={scene_id:scene.id,title:scene.title,t:scene.t,cause:$('analysisCause').value,evidence:$('analysisEvidence').value.trim(),plan:$('analysisPlan').value.trim(),at:new Date().toISOString()};
  if(!analysisComplete(a)){$('analysisMessage').textContent='원인 가설, 기록 근거, 보완 계획을 모두 남겨주세요. “아직 판단하기 어렵다”도 고를 수 있습니다.';return;}
  (analysisRun.analyses??={})[scene.id]=a;const i=$('analysisScene').value;showAnalysis(analysisRun);$('analysisScene').value=i;sceneSelected();$('analysisMessage').textContent='분석을 저장했습니다. 주행 기록은 바뀌지 않았습니다.';};
 $('analysisToCompare').onclick=()=>{$('analysisDialog').close();showCompare();};

 // 4. 비교·재학습·보고서
 // 재학습 → 결과 비교 → 보고서를 한 단계씩 보여준다.
 const CMP_STEPS=['재학습','결과 비교','보고서'];let cmpStep=1;
 function goCompare(n){cmpStep=Math.min(3,Math.max(1,n));$('cmpTitle').textContent=CMP_STEPS[cmpStep-1];
  for(const sec of $('compareDialog').querySelectorAll('.cmpStep'))sec.hidden=+sec.dataset.step!==cmpStep;
  for(const li of $('cmpSteps').children){const k=+li.dataset.go;li.classList.toggle('now',k===cmpStep);li.classList.toggle('done',k<cmpStep);}
  $('cmpPrev').disabled=cmpStep===1;$('cmpNext').hidden=cmpStep===3;$('compareDialog').scrollTop=0;
  if(cmpStep===3){const empty=REPORT_FIELDS.filter(([k])=>!(report[k]??'').trim()).map(([,t])=>t);if(empty.length<REPORT_FIELDS.length)helperEvent({type:'report-step',empty});}}
 $('cmpSteps').onclick=e=>{const li=e.target.closest('li');if(li)goCompare(+li.dataset.go);};$('cmpPrev').onclick=()=>goCompare(cmpStep-1);$('cmpNext').onclick=()=>goCompare(cmpStep+1);
 function showCompare(message='',step=1){pause();const rows=comparison(getRuns()),models=getModels();
  $('compareRows').innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${r.comparable?'●':''}</td><td>${esc(r.model)}</td><td>${r.course}</td><td>${r.road}</td><td>${r.gap}m</td><td class="${r.ended==='completed'?'':'bad'}">${r.outcome}</td><td>${f1(r.min_gap_m)}m</td><td>${f1(r.violation_s)}초</td><td>${r.run.forecast?(forecastCheck(r.run.forecast,r.run).outcome.same?'같음':'다름'):'-'}</td><td><button data-analyze="${i}">${Object.values(r.run.analyses??{}).length?'분석 '+Object.values(r.run.analyses).length+'개':'분석하기'}</button></td></tr>`).join(''):'<tr><td colspan="10">아직 끝난 자동 주행이 없습니다.</td></tr>';
  for(const b of $('compareRows').querySelectorAll('[data-analyze]'))b.onclick=()=>{$('compareDialog').close();showAnalysis(rows[Number(b.dataset.analyze)].run);};
  const current=$('cmpModel').value;$('cmpModel').replaceChildren(...models.map(m=>new Option(`${m.label} · ${m.name}`,m.version)));if(current)$('cmpModel').value=current;else if(models.length)$('cmpModel').value=models.at(-1).version;
  $('cmpRun').disabled=!models.length;$('compareMessage').textContent=message||(models.length?'':'주행 설정에서 model.json을 먼저 불러오세요.');
  for(const t of $('compareDialog').querySelectorAll('[data-report]'))t.value=report[t.dataset.report]??'';$('reportMessage').textContent='';
  goCompare(step);if(!$('compareDialog').open)$('compareDialog').showModal();}
 $('compareClose').onclick=()=>$('compareDialog').close();
 $('cmpRun').onclick=()=>{const version=Number($('cmpModel').value),key=[$('cmpCourse').value,$('cmpRoad').value,Number($('cmpGap').value)].join('|');
  helperEvent({type:'compare-run',matched:getRuns().some(r=>r.mode==='model'&&r.ended&&r.modelVersion!==version&&conditionKey(r)===key)});
  const ok=startModelRun({version:Number($('cmpModel').value),course:$('cmpCourse').value,road:$('cmpRoad').value,gap:Number($('cmpGap').value)});if(ok){$('compareDialog').close();showForecast(getRun());}};
 $('improveRun').onclick=()=>{$('compareDialog').close();startImprovementRun();};
 $('improveReview').onclick=()=>{$('compareDialog').close();openReview();};
 for(const t of $('compareDialog').querySelectorAll('[data-report]'))t.oninput=()=>{report[t.dataset.report]=t.value;};
 $('reportSave').onclick=()=>{
  const runs=getRuns().filter(r=>r.mode==='model'&&r.ended),models=getModels();
  const bundle={schema_version:1,kind:'ai-edu-session3',saved_at:new Date().toISOString(),physics_version:'teaching-v0.1',report:structuredClone(report),report_complete:reportComplete(report),
   models:models.map(m=>({version:m.version,label:m.label,file:m.name,loaded_at:m.loadedAt,probes:m.probes,model:m.model})),
   runs:runs.map(r=>({run_id:r.runId,model:r.modelLabel,model_version:r.modelVersion,course:r.course,road:r.road,start_gap_m:r.startGap,summary:summarize(r),forecast:r.forecast??null,forecast_check:forecastCheck(r.forecast,r),analyses:r.analyses??{},rows:r.rows,trace:r.trace})),
   comparison:comparison(runs).map(({run,...x})=>x),improvement_runs:getRuns().filter(r=>r.mode==='manual'&&r.purpose==='improvement').map(r=>({run_id:r.runId,intent:r.intent,rows:r.rows.length,ended:r.ended}))};
  const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}));a.href=u;a.download='session3-result.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
  $('reportMessage').textContent=reportComplete(report)?'session3-result.json 저장을 요청했습니다.':'저장을 요청했습니다. 보고서 다섯 항목 중 빈 칸이 있어 “미완성”으로 표시됩니다.';};

 function decorate(d){
  const models=getModels(),runs=getRuns().filter(r=>r.mode==='model'&&r.ended),analyzed=runs.some(r=>Object.keys(r.analyses??{}).length),versions=new Set(runs.map(r=>r.modelVersion));
  const step=!models.length?0:!runs.length?(d.forecast?2:1):!analyzed?3:4;
  $('missionStep').innerHTML=['모델 불러오기','결과 예상','자동 주행','장면 분석','재학습 · 비교'].map((s,i)=>`<span class="${i<step?'done':i===step?'now':''}">${s}</span>`).join('');
  $('missionHint').textContent=d.purpose==='improvement'?'개선용 기록 주행입니다. 장면 분석에서 정한 보완 장면을 직접 운전하세요. 이 기록은 전처리를 거쳐 학습 자료가 됩니다.':
   step===0?'2차시에 Orange의 Python Script 위젯으로 저장한 model.json을 주행 설정에서 불러오세요.':
   step===1?'출발하면 먼저 세 장면에서 모델의 판단을 예상하고, 이번 주행의 결과를 예상합니다.':
   step===2?'모델이 1초마다 속도 변화량을 정합니다. 예상과 비교하며 지켜보세요.':
   step===3?'자동 주행 결과에서 문제·주의 장면을 하나 골라 원인을 분석하세요.':
   versions.size<2?'분석한 내용을 바탕으로 기록을 보완해 다시 학습하고, 새 모델을 같은 조건으로 달려 비교하세요.':'같은 조건 비교가 끝났다면 B 코스로 확인하고 모둠 보고서를 정리하세요.';
 }
 return {beforeStart(run){if(run.mode==='model'&&!run.t&&!run.forecast){showForecast(run);return true;}return false;},onEnd(run){if(run.mode==='model')showResult(run);},decorate,showCompare,showAnalysis};
}
