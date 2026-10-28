import {QUESTS,QuestProgress,sampleAt,replayState,completedRecordRuns,ENOUGH_RUNS,RULE_RANGE,normalizeRules,ruleList,rulesIntent,ruleScenes,rulesReflected} from './learning.mjs';
import {World} from './world.mjs';
import {ICON} from './icons.mjs';
import {helperEvent} from './helper.mjs';
// 퀘스트 설명 속 버튼 이름을 실제 버튼 모양 아이콘 칩으로 보여준다.
const KEY={gas:`<span class="keyChip gas">${ICON.arrowUp}가속</span>`,brake:`<span class="keyChip brake">${ICON.arrowDown}브레이크</span>`,hand:`<span class="keyChip">${ICON.hand}손 떼기</span>`};
const QUEST_HTML=[`${KEY.gas} 또는 ↑ 키를 누르고 있으면서 속도계를 보세요.`,`${KEY.hand} 두 페달에서 손을 떼고 속도계를 잠깐 지켜보세요.`,`${KEY.brake} 또는 ↓ 키를 눌러 속도를 0으로 만들어 보세요.`,`앞차가 움직일 때까지 기다렸다가 ${KEY.gas}을 눌러 따라가 보세요.`];

export function installLearning({getRun,getRuns,startPractice,startCollection,play,pause,render,openReview}){
 const $=id=>document.getElementById(id);
 const bar=document.createElement('section');bar.className='missionBar';bar.setAttribute('aria-label','현재 학습 단계');
 bar.innerHTML='<div><b id="missionStep"></b><p id="missionHint"></p></div><button id="changeRules" hidden>기준 바꾸기</button><button id="restartQuests">퀘스트 다시 연습</button>';
 document.querySelector('main').prepend(bar);
 const host=document.createElement('div');host.innerHTML=`
 <dialog id="nextStepDialog" class="nextStepDialog"><button id="nextMore" class="closeBtn nextClose" aria-label="닫기" title="더 달리기">${ICON.xMark}</button><div class="nextIcon">${ICON.checkCircleSolid}</div><h2>기록 주행 3번을 모두 채웠어요</h2><p>내 기준대로 운전이 기록됐는지 확인해 볼까요?</p><button id="nextGo" class="start nextGo">다음 ${ICON.arrowRight}</button></dialog>
 <dialog id="intentDialog" class="intentDialog"><div class="intentIntro"><h2 class="introTitle">기록 전, 내 운전 기준은?</h2>
 <div class="introWhy"><p><b>왜 기준을 정할까요?</b></p><p class="yes">${ICON.checkCircleSolid}<span><b>기준이 있으면</b> — “앞차가 느려지면 브레이크!”처럼 매번 같은 기준으로 달려요. AI도 <b>느려지는 앞차 → 속도 줄이기</b>라는 규칙을 또렷하게 배워요.</span></p><p class="no">${ICON.checkCircle}<span><b>기준이 없으면</b> — 어떤 때는 브레이크, 어떤 때는 가속. 기록이 뒤죽박죽이라 AI도 헷갈려요.</span></p><button id="introNext" class="start introNext">다음 ${ICON.arrowRight}</button></div></div>
 <div class="dialogHead"><h2 id="intentTitle">기록 전, 내 운전 기준은?</h2><button id="intentClose" class="closeBtn" aria-label="닫기" title="닫기"><svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button></div>
 <div class="intentBody"><p class="slideR">임무는 앞차의 감속·정지·재출발에 맞춰 따라가는 것이에요. 아래 <b>세 가지 기준을 모두 지키며</b> 달려요. 숫자는 내가 정해요.</p>
 <ol class="ruleSet slideR"><li><span class="ruleTag">감속 기준</span><p>앞차가 감속하면 <b>1초 안에</b> 나도 감속</p></li>
 <li><span class="ruleTag">거리 기준</span><p>앞차와 거리가 <b><output id="ruleGapOut"></output>m</b>보다 가까워지면 브레이크</p><input id="ruleGap" type="range" min="${RULE_RANGE.gapM.min}" max="${RULE_RANGE.gapM.max}" step="${RULE_RANGE.gapM.step}" aria-label="거리 기준(m)"></li>
 <li><span class="ruleTag">출발 기준</span><p>앞차가 출발하면 1초에 <b>+<output id="ruleStartOut"></output>km/h</b> 이하로 천천히 가속</p><input id="ruleStart" type="range" min="${RULE_RANGE.startKmhS.min}" max="${RULE_RANGE.startKmhS.max}" step="${RULE_RANGE.startKmhS.step}" aria-label="출발 기준(km/h)"></li></ol>
 <button id="intentBegin" class="start slideR ready">이 기준으로 기록 시작</button></div></dialog>
 <dialog id="reflectionDialog" class="reflectionDialog ruleReflect"><div class="dialogHead"><div><h2>내 기준대로 운전했는지 확인하기</h2><div id="ruleTabs" class="ruleTabs" role="tablist"></div></div><button id="reflectionClose">나중에 이어하기</button></div>
 <div class="reflectionGrid"><section><div class="replayViewport"><canvas id="replayCanvas" aria-label="저장된 주행 장면 다시 보기"></canvas><span id="sceneTitle" class="sceneTitle"></span><span id="replayTime"></span></div><div class="replayControls"><button id="replayPlay">장면 재생</button><label>장면 시각<input id="replaySlider" type="range" min="0" max="1" step="0.02"></label></div><p id="sampleFacts" class="subtle"></p></section>
 <section id="watchPane" class="watchPane"><span id="watchTag" class="ruleTag"></span><h3 id="watchRule"></h3><p>이 기준과 관련된 장면을 한 번 재생해요.<br>재생이 끝나면 확인 창이 떠요.</p></section>
 <section id="comparePane" class="comparePane" hidden><h3>비교하기 <span id="cmpLabel" class="ruleTag"></span></h3>
 <dl class="cmpTable"><dt>내 기준</dt><dd id="cmpRule"></dd><dt>실제 기록</dt><dd id="cmpActual"></dd></dl><p id="cmpVerdict" class="cmpVerdict"></p>
 <p class="cmpQ">기록을 보니 내 운전은 기준과 어땠나요?</p><div id="matchOpts" class="matchOpts"><button data-v="yes">같았다</button><button data-v="partly">일부만 같았다</button><button data-v="no">달랐다</button></div>
 <label>어떤 기록을 보고 그렇게 생각했나요?<textarea id="reflectionEvidence" rows="2" placeholder="예: 앞차가 감속하고 1.6초 뒤에야 브레이크를 밟았다."></textarea></label>
 <button id="saveReflection" class="start">확인 완료</button><p id="reflectionMessage" role="status"></p></section></div>
 <p class="subtle">기준과 달랐다는 이유만으로 기록을 지우지 않습니다. 다음 단계에서는 값이 빠지거나 잘못 저장됐는지를 따로 검토합니다.</p>
 <button id="reflectionToLesson" class="start">1분 영상 · 데이터 살펴보기</button></dialog>
 <dialog id="ruleAsk" class="nextStepDialog ruleAsk"><div class="nextIcon">${ICON.checkCircle}</div><h2>나의 자동차의 운전 기준은<br>이 세 가지였습니다.</h2><ul id="askRules" class="askRules"></ul><p id="ruleAskText" class="askQ"></p><div class="askBtns"><button id="ruleNo">아니요</button><button id="ruleYes" class="start">예</button></div></dialog>
 <dialog id="dataLessonDialog" class="dataLessonDialog"><div class="dialogHead"><h2>학습시키기 전에, 데이터를 살펴볼까요?</h2><button id="lessonClose" class="closeBtn" aria-label="닫기" title="닫기"><svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button></div>
 <video id="dataLessonVideo" controls playsinline preload="metadata" poster="media/data-lesson-poster.jpg" aria-label="결측치와 이상치 1분 학습 영상"><source src="media/data-before-learning-60s.mp4" type="video/mp4"></video>
 <details><summary>영상 내용을 글로 읽기</summary><p>실제 자율주행 연구에는 카메라·라이다 관측과 물체의 움직임 같은 다양한 자료가 쓰입니다. 모델의 역할에 따라 필요한 데이터가 달라집니다.</p><p>우리 수업은 내 차 속도, 앞차 거리, 앞차 속도, 노면을 입력으로 사용합니다. 목표값은 앞으로 1초 동안의 실제 속도 변화량입니다. 현재 30, 1초 뒤 24km/h라면 24−30=−6km/h입니다. 이는 미래 속도 자체나 페달 입력과 다릅니다.</p><p><b>결측치</b>는 있어야 할 값이 빠진 기록입니다. 빈칸은 정지를 뜻하는 0과 다릅니다. <b>이상치</b>는 확인이 필요한 특이한 값입니다. 999999km/h는 이 수업에서 불가능하며 그대로 학습하면 잘못된 관계나 분기를 배울 수 있습니다. 영향은 모델과 기록에 따라 다릅니다. 실제 급감속은 드물어도 유효한 기록일 수 있습니다.</p><p>원본·단위·중복을 확인하고 유지, 근거 있는 수정, 제외를 선택해 이유를 남깁니다. 원본은 보존합니다.</p><p><a href="https://www.waymo.com/open/about/" target="_blank" rel="noopener">실제 자율주행 연구 데이터 예시: Waymo Open Dataset</a>. 네 입력과 1초 변화량은 우리 수업의 단순화입니다.</p><button id="lessonQuizBtn" class="start nextGo">문제 풀기 ${ICON.arrowRight}</button></details>
 </dialog>
 <dialog id="lessonQuiz" class="nextStepDialog quizDialog"><button id="quizClose" class="closeBtn nextClose" aria-label="닫기" title="영상 다시 보기">${ICON.xMark}</button><div id="quizCard"><div id="quizIcon" class="nextIcon"></div><p id="quizNo" class="quizNo"></p><h2 id="quizQ"></h2><div id="quizOpts" class="quizOpts"></div><p id="quizHint" class="quizHint" role="status"></p><button id="quizGo" class="start nextGo ready quizGo" hidden>전처리 시작 ${ICON.arrowRight}</button></div></dialog>`;
 document.body.append(host);
 let session=2,quest=null,introDone=false,cardKey='',index=0,completed=0,lessonPassed=false,reflectRun=null,scenes=[],scene=null,ri=0,watching=false,match='',lastRules=normalizeRules(),replayWorld=null,replaying=false,replayTime=0,replayLast=0;
 // 퀘스트는 한 번만: 완료 여부를 탭 단위(sessionStorage)로 기억해 새로고침·차시 재선택에도 다시 띄우지 않는다.
 // localStorage가 아닌 이유: 교실 노트북을 다음 반 학생이 새 탭으로 열면 처음부터 퀘스트를 하게 하려고.
 const QUESTS_KEY='aiedu.questsDone';
 let questsDone=false;try{questsDone=sessionStorage.getItem(QUESTS_KEY)==='1';}catch{}
 // 기준도 한 번만: 처음 정한 숫자를 탭 단위로 기억해 다시 주행할 때는 창 없이 그대로 쓴다('기준 바꾸기'로만 다시 연다).
 const RULES_KEY='aiedu.rules';let rulesChosen=false;try{const r=sessionStorage.getItem(RULES_KEY);if(r){lastRules=normalizeRules(JSON.parse(r));rulesChosen=true;}}catch{}
 function applyRules(){if(getRun().purpose==='practice'||getRun().ended)startCollection();getRun().rules=lastRules;getRun().intent=rulesIntent(lastRules);getRun().quest_completed_count=completed;}
 // 기록 주행 출발 전 3초 카운트다운: 기준 창이 사라지고 화면 가운데에 3 → 2 → 1 → 출발! 뒤 주행이 시작된다.
 const cd=document.createElement('div');cd.className='countdown';cd.hidden=true;cd.setAttribute('role','status');document.querySelector('.viewport')?.append(cd);let counting=false;
 function countdown(){if(counting)return;counting=true;pause();$('overlay').hidden=true;cd.hidden=false;const steps=['3','2','1','출발!'];let k=0;
  const tick=()=>{if(k<steps.length){cd.textContent=steps[k];cd.classList.remove('pop');void cd.offsetWidth;cd.classList.add('pop');cd.classList.toggle('go',k===3);k++;setTimeout(tick,k===4?600:REDUCED?400:1000);}else{cd.hidden=true;counting=false;play();}};tick();}
 function markQuestsDone(){questsDone=true;try{sessionStorage.setItem(QUESTS_KEY,'1');}catch{}}
 function setupQuest(i){index=i;quest=new QuestProgress(i);startPractice(i);render();}
 const doneRuns=()=>completedRecordRuns(getRuns());
 const checks=n=>QUESTS.map((_,k)=>`<i class="${k<n?'on':''}">${k<n?ICON.checkCircleSolid:ICON.checkCircle}</i>`).join('');
 // 상태가 바뀔 때만 등장 효과를 다시 건다(지지직 디지털 / 클리어는 위아래로 펼침).
 function animateCard(key,fx){if(key===cardKey)return;cardKey=key;const c=$('overlayCard');c.classList.remove('fxGlitch','fxUnfold');void c.offsetWidth;if(fx)c.classList.add(fx);}
 function decorate(d,playing){
  $('settingsBtn').disabled=!!quest;
  if(counting)$('overlay').hidden=true;
  $('restartQuests').hidden=session===3||questsDone;$('changeRules').hidden=session===3||!rulesChosen||!!quest||playing||(d.t>0&&!d.ended);
  document.querySelector('.speedometer').classList.toggle('questGlow',!!quest&&playing&&!quest.done&&!quest.failed);
  if(!quest){
   $('questIcon').hidden=true;$('questList').hidden=true;$('overlayText').hidden=false;$('missionHint').hidden=false;
   if(session===3)return;
   const n=doneRuns();$('missionStep').innerHTML=`<span class="missionNo">RECORD</span>기록 주행<span class="recMeter" title="코스 완주 ${n} / ${ENOUGH_RUNS}번"><i style="width:${Math.min(100,n/ENOUGH_RUNS*100)}%"></i></span><span class="recCount">완주 ${Math.min(n,ENOUGH_RUNS)} / ${ENOUGH_RUNS}번</span>`;
   $('missionHint').textContent=d.rules?`이번 기준: 앞차 감속 1초 안에 감속 · ${d.rules.gapM}m보다 가까우면 브레이크 · 출발은 1초에 +${d.rules.startKmhS}km/h 이하`:'주행 전에 내 기준을 정하고, 주행 후 실제 장면과 비교합니다.';
   if(d.ended&&d.mode==='manual'&&d.purpose==='collection')$('overlayText').textContent=n>=ENOUGH_RUNS?'기록 주행 3번을 모두 채웠어요. 내 기준대로 기록됐는지 확인해 봐요.':d.ended==='completed'?`완주 ${n} / ${ENOUGH_RUNS}번. 한 번 더 완주해 보세요.`:`완주해야 기록이 채워져요 (완주 ${n} / ${ENOUGH_RUNS}번). 다시 달려 보세요.`;
   $('overlayCard').classList.remove('questCard');animateCard('drive',null);return;}
  const intro=!introDone,done=quest.done,failed=quest.failed,n=completed>index||done?index+1:index;
  $('missionStep').innerHTML=intro?`<span class="missionNo">TUTORIAL</span><span class="missionChecks">${checks(0)}</span>`:`<span class="missionNo">MISSION ${index+1}</span><span class="missionChecks">${checks(n)}</span>`;
  $('overlayCard').classList.add('questCard');$('missionHint').hidden=true;$('count').textContent='0';$('newRun').hidden=true;$('finish').disabled=true;
  $('overlayTag').textContent=intro?'TUTORIAL':`MISSION ${index+1}`;
  $('questIcon').hidden=intro;$('questIcon').innerHTML=done?ICON.checkCircleSolid:ICON.checkCircle;$('questIcon').classList.toggle('on',done);
  $('questList').hidden=!intro;if(intro)$('questList').innerHTML=QUESTS.map(q=>`<li>${ICON.checkCircle}${q.title}</li>`).join('');
  $('overlayTitle').textContent=intro?'운전하기 전에, 조작법부터 익혀요':failed?'한 번 더 해볼까요?':done?'미션 클리어!':QUESTS[index].title;
  $('overlayText').hidden=done;
  if(intro)$('overlayText').textContent='미션 4개를 하나씩 해 보면 가속과 브레이크를 다룰 수 있어요.';else if(failed)$('overlayText').textContent=quest.reason??'장면을 다시 시작해 관찰해 보세요.';else if(!done)$('overlayText').innerHTML=QUEST_HTML[index];
  $('start').hidden=playing;$('start').textContent=intro?'퀘스트 시작':failed?'다시 하기':done?'다음으로':d.t?'계속':'시작';
  $('phase').textContent=index===3?(d.t<2?'앞차 출발을 기다려 보세요':'앞차가 출발했습니다'):'조작 연습 장면';
  animateCard(intro?'intro':`${index}:${failed?'f':done?'d':'q'}`,done?'fxUnfold':'fxGlitch');
 }
 // 기준 정하기 창: ① 가운데에 제목이 희미하게(0.7초) ② 기준이 있을 때·없을 때 예시 ③ 제목이 제자리로 이동 ④ 질문이 오른쪽으로 밀려 나온다.
 // 예시는 학생이 다 읽고 → 버튼을 눌러야 넘어간다. 그 뒤에는 지금 채워야 할 칸만 주황 테두리로 반짝이고, 다 채우면 기록 시작 버튼이 반짝인다.
 const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;let introTimers=[];
 function syncRules(){$('ruleGapOut').textContent=$('ruleGap').value;$('ruleStartOut').textContent=$('ruleStart').value;}
 function finishIntro(){const dlg=$('intentDialog');if(!dlg.classList.contains('intro'))return;introTimers.forEach(clearTimeout);introTimers=[];
  const t=dlg.querySelector('.introTitle'),from=t.getBoundingClientRect(),to=$('intentTitle').getBoundingClientRect();
  dlg.classList.add('moving');t.style.transform=`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.height/from.height})`;
  setTimeout(()=>{dlg.classList.remove('intro','stageWhy','stageOut','moving');t.style.transform='';dlg.classList.add('reveal');$('intentBegin').focus();},REDUCED?0:600);}
 function showIntent(force=false){pause();if(!force&&session===2&&rulesChosen){applyRules();render();return;}$('ruleGap').value=lastRules.gapM;$('ruleStart').value=lastRules.startKmhS;syncRules();const dlg=$('intentDialog');dlg.classList.remove('reveal','stageWhy','stageOut','moving');dlg.classList.add('intro');dlg.showModal();
  if(REDUCED){finishIntro();return;}
  introTimers=[setTimeout(()=>{dlg.classList.add('stageWhy');$('introNext').focus();},700)];}
 function handleStart(){if(quest&&!introDone){introDone=true;render();return true;}if(quest){if(quest.failed)setupQuest(index);else if(quest.done){if(index<QUESTS.length-1)setupQuest(index+1);else{quest=null;markQuestsDone();startCollection();showIntent();}}else play();return true;}
  if(counting)return true;if(!getRun().intent&&getRun().mode==='manual'){if(session===2&&rulesChosen){applyRules();countdown();return true;}showIntent();return true;}
  // 주행을 처음 출발할 때는 3·2·1 카운트다운 뒤에 달린다(2차시 기록 주행, 3차시 모든 주행).
  if(!getRun().t&&(session===3||(getRun().mode==='manual'&&getRun().purpose==='collection'))){countdown();return true;}return false;}
 function onTick(d){if(quest){quest.observe(d);if(quest.done||quest.failed){if(quest.done){completed=Math.max(completed,index+1);if(index===QUESTS.length-1)markQuestsDone();}pause();}}else if(d.ended&&session!==3)runEnded(d);}
 // 기록 주행이 끝나면: 자료가 충분하면 다음 단계(전처리 실습)로 갈지 묻고, 아니면 한 번 더 달리도록 안내한다.
 function runEnded(run){pause();if(run.purpose!=='collection'||run.mode!=='manual'||!run.trace.length)return;if(doneRuns()<ENOUGH_RUNS)return;if(!$('nextStepDialog').open)$('nextStepDialog').showModal();}
 // 기준 확인: 규칙마다 장면을 한 번 재생 → 가운데 확인 창(예: 비교하기 / 아니요: 장면 다시 재생) → 비교 창에서 내 판단 남기기.
 const reflectRuns=()=>getRuns().filter(r=>r.purpose!=='practice'&&r.mode==='manual'&&r.trace.length);
 const savedFor=s=>s?.run.reflections?.[s.id];
 const doneMark=s=>{const v=savedFor(s);return !!(v&&v.match&&v.evidence?.trim());};
 function renderTabs(){$('ruleTabs').innerHTML=scenes.map((s,i)=>`<button role="tab" data-i="${i}" class="${i===ri?'on':''} ${doneMark(s)?'done':''}" aria-selected="${i===ri}">${doneMark(s)?ICON.checkCircleSolid:`<b>${i+1}</b>`}${s.label}</button>`).join('');}
 function setMode(compare){$('watchPane').hidden=compare;$('comparePane').hidden=!compare;}
 function openRule(i){ri=i;scene=scenes[i];reflectRun=scene.run;renderTabs();setMode(false);
  $('watchTag').textContent=scene.label;$('watchRule').textContent=scene.text;$('sceneTitle').textContent=scene.scene.title;
  $('replaySlider').min=scene.scene.from;$('replaySlider').max=scene.scene.to;replayTime=scene.scene.from;$('reflectionMessage').textContent='';
  watching=true;replaying=true;replayLast=performance.now();$('replayPlay').textContent='재생 멈춤';paintReplay();}
 function askRule(){$('askRules').innerHTML=ruleList(scene.run.rules).map(r=>`<li class="${r.id===scene.id?'now':''}"><span class="ruleTag">${r.label}</span>${r.text}</li>`).join('');$('ruleAskText').innerHTML=`그중 <em class="hl">${scene.label}</em>대로 운행했는지 볼까요?`;if(!$('ruleAsk').open)$('ruleAsk').showModal();$('ruleYes').focus();}
 function openCompare(){watching=false;setMode(true);const v=savedFor(scene);$('cmpLabel').textContent=scene.label;$('cmpRule').textContent=scene.text;$('cmpActual').textContent=scene.actual;
  $('cmpVerdict').textContent=scene.verdict==='kept'?'기록상으로는 기준을 지켰어요.':scene.verdict==='broken'?'기록상으로는 기준과 달랐어요.':'이 기록에는 확인할 장면이 없어요.';$('cmpVerdict').className='cmpVerdict '+scene.verdict;
  match=v?.match??'';$('reflectionEvidence').value=v?.evidence??'';paintMatch();$('reflectionMessage').textContent='';$('saveReflection').textContent=scenes.every((s,i)=>i===ri||doneMark(s))?'확인 완료':'확인 완료 · 다음 기준';}
 function paintMatch(){$('matchOpts').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===match));}
 function paintReplay(){if(!reflectRun||!scene)return;const sample=sampleAt(reflectRun,replayTime);$('replaySlider').value=replayTime;$('replayTime').textContent=`저장된 주행 ${sample.t_s.toFixed(2)}초`;
  $('sampleFacts').textContent=`이 순간: 내 속도 ${sample.ego_speed_kmh.toFixed(1)}, 앞차 ${sample.lead_speed_kmh.toFixed(1)}km/h · 거리 ${sample.gap_m.toFixed(1)}m · ${sample.requested_delta_kmh<0?'브레이크':sample.requested_delta_kmh>0?'가속':'페달 놓음'}`;
  if(replayWorld){replayWorld.resize();replayWorld.render(replayState(sample));}}
 function showReflection(){pause();const runs=reflectRuns();if(!runs.length)return;scenes=ruleScenes(runs);if(!scenes.length)return;
  $('reflectionToLesson').disabled=!rulesReflected(runs);
  if(!$('reflectionDialog').open)$('reflectionDialog').showModal();
  if(!replayWorld)try{replayWorld=new World($('replayCanvas'),{view:'chase'});}catch{$('sampleFacts').textContent='3D 재생을 열 수 없습니다. 아래 시각별 수치로 확인하세요.';}
  const next=scenes.findIndex(s=>!doneMark(s));openRule(next<0?0:next);
 }
 function openLesson(){pause();$('dataLessonDialog').showModal();}
 function preprocess(){pause();if(session===3){openReview();return;}if(reflectRuns().length&&!rulesReflected(reflectRuns())){showReflection();return;}if(!lessonPassed){openLesson();return;}openReview();}
 $('nextMore').onclick=()=>$('nextStepDialog').close();// 다음: 화면이 검게 덮였다가, 전처리 실습 창이 검은 화면에서 서서히 드러난다.
 $('nextGo').onclick=()=>{$('nextStepDialog').close();const before=new Set(document.querySelectorAll('dialog[open]'));preprocess();const opened=[...document.querySelectorAll('dialog[open]')].find(x=>!before.has(x));if(opened){opened.classList.add('fromBlack');setTimeout(()=>opened.classList.remove('fromBlack'),1500);}};
 $('introNext').onclick=()=>{$('intentDialog').classList.add('stageOut');setTimeout(finishIntro,REDUCED?0:400);};for(const id of ['ruleGap','ruleStart'])$(id).addEventListener('input',syncRules);
 $('restartQuests').onclick=()=>{pause();setupQuest(0);};$('changeRules').onclick=()=>showIntent(true);$('intentClose').onclick=()=>{introTimers.forEach(clearTimeout);$('intentDialog').close();};
 $('intentBegin').onclick=()=>{if(getRun().purpose==='practice'||getRun().ended)startCollection();const rules=normalizeRules({gapM:$('ruleGap').value,startKmhS:$('ruleStart').value});lastRules=rules;if(session===2){rulesChosen=true;try{sessionStorage.setItem(RULES_KEY,JSON.stringify(rules));}catch{}}
  getRun().rules=rules;getRun().intent=rulesIntent(rules);getRun().quest_completed_count=completed;$('intentDialog').close();if(session===3||(getRun().purpose==='collection'&&session===2))countdown();else play();};
 $('reflectionClose').onclick=()=>{replaying=false;$('reflectionDialog').close();};$('reflectionDialog').addEventListener('close',()=>{replaying=false;watching=false;if($('ruleAsk').open)$('ruleAsk').close();});
 $('ruleTabs').onclick=e=>{const b=e.target.closest('button');if(b)openRule(Number(b.dataset.i));};$('replaySlider').oninput=()=>{replaying=false;replayTime=Number($('replaySlider').value);$('replayPlay').textContent='장면 재생';paintReplay();};
 $('replayPlay').onclick=()=>{replaying=!replaying;if(replaying&&replayTime>=scene.scene.to)replayTime=scene.scene.from;replayLast=performance.now();$('replayPlay').textContent=replaying?'재생 멈춤':'장면 재생';};
 function animate(now){if(replaying&&$('reflectionDialog').open){replayTime=Math.min(scene.scene.to,replayTime+Math.min(.1,(now-replayLast)/1000));paintReplay();if(replayTime>=scene.scene.to){replaying=false;$('replayPlay').textContent='다시 재생';if(watching)askRule();}}replayLast=now;requestAnimationFrame(animate);}requestAnimationFrame(animate);
 $('ruleYes').onclick=()=>{$('ruleAsk').close();openCompare();};
 $('ruleNo').onclick=()=>{$('ruleAsk').close();replayTime=scene.scene.from;replaying=true;replayLast=performance.now();$('replayPlay').textContent='재생 멈춤';};
 $('ruleAsk').addEventListener('cancel',e=>e.preventDefault());
 $('matchOpts').onclick=e=>{const b=e.target.closest('button');if(!b)return;match=b.dataset.v;paintMatch();$('reflectionMessage').textContent='';};
 $('saveReflection').onclick=()=>{const evidence=$('reflectionEvidence').value.trim();
  if(!match||!evidence){$('reflectionMessage').textContent=!match?'기준과 같았는지 먼저 골라 주세요.':'어떤 기록을 보고 그렇게 생각했는지 한 줄 남겨 주세요.';return;}
  const {from,to,t,title}=scene.scene;reflectRun.reflections??={};reflectRun.reflections[scene.id]={rule_id:scene.id,rule_text:scene.text,scene:{t,from,to,title},verdict:scene.verdict,measured:scene.actual,match,evidence,at:new Date().toISOString()};
  helperEvent({type:'reflection-match',verdict:scene.verdict,match});helperEvent({type:'evidence',text:evidence});
  renderTabs();const all=rulesReflected(reflectRuns());$('reflectionToLesson').disabled=!all;
  const next=scenes.findIndex(s=>!doneMark(s));if(next>=0){$('reflectionMessage').textContent='저장했어요. 다음 기준 장면으로 넘어가요.';setTimeout(()=>{if($('reflectionDialog').open&&ri!==next)openRule(next);},700);}
  else $('reflectionMessage').textContent='세 기준을 모두 확인했어요. 주행 원본과 학습 목표값은 바뀌지 않았습니다.';};
 $('reflectionToLesson').onclick=()=>{$('reflectionDialog').close();preprocess();};
 $('lessonClose').onclick=()=>$('dataLessonDialog').close();$('dataLessonDialog').addEventListener('close',()=>$('dataLessonVideo').pause());
 // 1분 영상을 다 보면(또는 글로 읽고 '문제 풀기') 가운데에 2지선다 2문제. 틀리면 지지직, 다 맞히면 클리어 → 반짝이는 전처리 시작.
 const QUIZ=[
  {q:'속도 칸이 비었어요.<br>0으로 채워도 될까요?',a:[['네, 빈칸은 0과 같아요',false],['아니요, 원본부터 확인해요',true]],hint:'빈칸은 “모름”, 0은 “멈춤”이에요. 뜻이 달라요.'},
  {q:'다른 기록보다 감속량이 유난히 커요.<br>어떻게 할까요?',a:[['진짜 급정거인지 원본·단위를 확인해요',true],['특이하니까 바로 지워요',false]],hint:'진짜 급정거라면 꼭 필요한 기록이에요.'}];
 let quizStep=0,quizTimer=0;
 function restartFx(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}
 function renderQuiz(){const q=QUIZ[quizStep];$('lessonQuiz').classList.remove('cleared');$('quizIcon').innerHTML=ICON.checkCircle;$('quizNo').textContent=`문제 ${quizStep+1} / ${QUIZ.length}`;$('quizQ').innerHTML=q.q;$('quizHint').textContent='';
  $('quizOpts').innerHTML=q.a.map(([t,ok])=>`<button class="quizOpt" data-ok="${ok}">${t}</button>`).join('');$('quizOpts').hidden=false;$('quizGo').hidden=true;restartFx($('quizCard'),'fxGlitch');}
 function showQuiz(){clearTimeout(quizTimer);quizStep=0;renderQuiz();$('dataLessonVideo').pause();if(!$('lessonQuiz').open)$('lessonQuiz').showModal();$('quizOpts').querySelector('button')?.focus();}
 function clearQuiz(){$('lessonQuiz').classList.add('cleared');$('quizIcon').innerHTML=ICON.checkCircleSolid;$('quizNo').textContent='CLEAR';$('quizQ').innerHTML='클리어!<br>이제 데이터를 정리해 볼까요?';$('quizOpts').hidden=true;$('quizHint').textContent='';$('quizGo').hidden=false;restartFx($('quizCard'),'fxUnfold');$('quizGo').focus();}
 $('quizOpts').onclick=e=>{const b=e.target.closest('.quizOpt');if(!b||b.disabled)return;
  if(b.dataset.ok==='true'){$('quizOpts').querySelectorAll('button').forEach(x=>x.disabled=true);b.classList.add('right');b.insertAdjacentHTML('afterbegin',ICON.checkCircleSolid);
   quizTimer=setTimeout(()=>{quizStep++;quizStep<QUIZ.length?renderQuiz():clearQuiz();},650);}
  else{restartFx(b,'denied');$('quizHint').textContent=QUIZ[quizStep].hint;}};
 $('dataLessonVideo').addEventListener('ended',showQuiz);$('lessonQuizBtn').onclick=showQuiz;
 $('quizClose').onclick=()=>{clearTimeout(quizTimer);$('lessonQuiz').close();};
 $('quizGo').onclick=()=>{lessonPassed=true;$('lessonQuiz').close();$('dataLessonDialog').close();openReview();};
 setupQuest(0);
 return {setSession(n){session=n;},countdown,decorate,handleStart,onTick,showReflection,runEnded,preprocess,exitPractice(){quest=null;},startQuests(){if(questsDone){quest=null;startCollection();render();showIntent();}else setupQuest(0);},showIntent};
}
