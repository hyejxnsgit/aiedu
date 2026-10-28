import {Review,EDITABLE,practiceRows,parseCSV} from './review.mjs';
import {sampleAt,replayState} from './learning.mjs';
import {World} from './world.mjs';
import {mountClip} from './orange-clips.mjs';
import {helperEvent} from './helper.mjs';
const labels={ego_speed_kmh:'내 차 속도 (km/h)',gap_m:'앞차 거리 (m)',lead_speed_kmh:'앞차 속도 (km/h)',road:'노면 (dry / wet)',actual_delta_kmh:'1초 실제 변화 (km/h)'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function download(name,text,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
export function installReview({getRuns,pause}){
 const dialog=el('dialog');dialog.id='reviewDialog';dialog.className='reviewDialog';
 dialog.innerHTML=`<div class="dialogHead"><div><h2>데이터 전처리 실습</h2><p class="subtle">원본은 남겨두고, 근거를 확인해 처리하세요.</p></div></div>
 <ol class="rvSteps" id="rvSteps"><li data-go="1"><b>1</b>자료 고르기</li><li data-go="2"><b>2</b>학습·검증 나누기</li><li data-go="3"><b>3</b>확인·처리</li><li data-go="4"><b>4</b>저장하기</li></ol>
 <section class="rvStep" data-step="1"><h3>1. 자료 고르고 개념 확인하기</h3><div class="concepts"><article tabindex="0" class="conceptCard"><h3>결측치</h3><p>있어야 할 값이 빠진 기록입니다. <b>빈칸과 숫자 0은 다릅니다.</b> 원본에서 복구할 수 있는지 확인하세요.</p><div class="conceptTip" role="note"><b class="tipHead">예) 앞차 거리 센서 기록에 구멍이 났어요</b><svg viewBox="0 0 360 170" class="cviz"><text x="8" y="14" class="cl">앞차 거리(m)</text><line x1="30" y1="140" x2="350" y2="140" class="ax"/><line x1="30" y1="20" x2="30" y2="140" class="ax"/>
<polyline points="30,50 70,55 110,62 150,70" class="ln"/><polyline points="230,92 270,96 310,98 350,100" class="ln"/>
<rect x="150" y="22" width="80" height="118" class="gapBox"/><text x="190" y="62" class="gl">? 빈칸</text><text x="190" y="78" class="gs">비·역광으로</text><text x="190" y="92" class="gs">라이다가 못 읽음</text>
<polyline points="150,70 160,140 220,140 230,92" class="bad"/><text x="190" y="156" class="bl">0으로 채우면 → "앞차와 붙었다!" 착각</text>
<text x="30" y="166" class="tk">0초</text><text x="340" y="166" class="tk">8초</text></svg><p>빈칸은 <b>모르는 값</b>, 0은 <b>앞차와 거리 0m</b>예요. 0으로 채우면 AI가 "가까우면 급제동"을 잘못 배워요.</p></div></article><article tabindex="0" class="conceptCard"><h3>이상치</h3><p>다른 기록과 크게 다르거나 확인이 필요한 값입니다. 실제 급감속일 수도 있으므로 <b>무조건 삭제하지 않습니다.</b></p><div class="conceptTip" role="note"><b class="tipHead">예) 1초 속도 변화량을 점으로 찍어 보면</b><svg viewBox="0 0 360 170" class="cviz"><text x="8" y="14" class="cl">1초 속도 변화(km/h)</text><line x1="30" y1="100" x2="350" y2="100" class="ax"/>
<rect x="150" y="88" width="70" height="24" class="iqrBox"/><text x="185" y="126" class="gs">대부분의 기록</text>
<g class="pts"><circle cx="160" cy="96" r="3"/><circle cx="168" cy="104" r="3"/><circle cx="175" cy="98" r="3"/><circle cx="182" cy="102" r="3"/><circle cx="190" cy="95" r="3"/><circle cx="197" cy="103" r="3"/><circle cx="205" cy="99" r="3"/><circle cx="212" cy="104" r="3"/><circle cx="186" cy="108" r="3"/><circle cx="172" cy="92" r="3"/></g>
<circle cx="70" cy="100" r="6" class="maybe"/><text x="70" y="78" class="gl">−18</text><text x="70" y="146" class="gs">진짜 급정거?</text><text x="70" y="160" class="gs">→ 원본 확인 후 유지</text>
<circle cx="335" cy="100" r="6" class="bad2"/><text x="335" y="78" class="gl">+300</text><text x="318" y="146" class="gs">불가능한 값</text><text x="318" y="160" class="gs">(센서 튐·단위 오류)</text>
<line x1="80" y1="100" x2="145" y2="100" class="dash"/><line x1="225" y1="100" x2="325" y2="100" class="dash"/></svg><p>다른 기록과 멀리 떨어진 값이에요. <b>실제 급정거</b>처럼 꼭 필요한 기록일 수도 있으니, 지우기 전에 원본부터 확인해요.</p></div></article></div>
 <div class="reviewSources"><label>검토할 자료<select id="reviewDataset"><option value="actual">내 실제 주행 기록</option><option value="practice">개념 연습 데이터 (실제 주행 아님)</option></select></label><label>CSV 또는 저장한 처리 이력 불러오기<input type="file" id="reviewImport" accept=".csv,.json,text/csv,application/json"></label></div><label class="appendOption s3only"><input type="checkbox" id="reviewAppend"> 2차시 처리 이력(JSON)에 지금 주행을 이어 붙이기 (3차시 재학습)</label>
 <p id="reviewBanner" class="reviewBanner"></p></section><section class="rvStep" data-step="2"><h3>2. 학습·검증 나누기</h3><p class="subtle">모델이 배울 <b>학습 데이터</b>와, 처음 보는 기록으로 실력을 확인할 <b>검증 데이터</b>를 비율로 나눠요. 기록을 고루 섞은 뒤 나눕니다.</p><div class="ratioPick" id="ratioPick" role="radiogroup" aria-label="학습:검증 비율"><button data-r="0.6">6 : 4</button><button data-r="0.7">7 : 3</button><button data-r="0.8">8 : 2</button><button id="ratioShuffle" class="ghost">다시 섞기</button></div><div class="ratioBar" aria-hidden="true"><i id="ratioTrain"></i><i id="ratioVal"></i></div><p id="ratioCounts" class="ratioCounts"></p><p id="reviewLegacy" class="subtle"></p><p id="splitWarn" class="splitWarn" role="status"></p></section>
 <section class="rvStep" data-step="3"><h3>3. 확인하고 처리하기</h3><p id="reviewCounts" class="reviewCounts"></p><div class="reviewEditor"><section><p class="fieldLabel">확인할 행 <span class="subtle">· 파랗게 반짝이는 행이 확인할 후보예요</span></p><div id="reviewRowList" class="rowList" role="listbox" aria-label="확인할 행"></div><button id="reviewNext" class="start nextCheck">다음 확인 필요 행 →</button><div id="reviewIssues"></div><div id="reviewOriginal" class="csvArea" tabindex="0" aria-label="이 행의 기록 값 · 분포 그림 보기"></div><details><summary>해당 시각의 원본 근거</summary><pre id="reviewEvidence"></pre></details></section><section><label>처리 방법<select id="reviewAction"><option value="">처리 방법 선택</option><option value="keep">유지 — 실제 기록임을 확인</option><option value="edit">수정 — 원본 근거로 복구</option><option value="exclude">제외 — 학습에 사용하지 않음</option></select></label><div id="reviewFields"></div><label>처리 이유 / 원본 근거<textarea id="reviewReason" rows="3" placeholder="예: 원본 기록에서 단위를 확인했다. / 복구 근거가 없어 제외했다."></textarea></label><div class="reviewButtons"><button id="reviewSave" class="start">판단 저장</button><button id="reviewUndo" title="처리 취소 · 원본 복원">취소</button></div></section></div>
 <div id="clipTip" class="reviewTip" hidden><b class="tipHead">이 행이 기록된 주행 장면</b><div class="clipBox" id="clipBox"><canvas id="clipCanvas"></canvas></div><p id="clipCaption"></p></div><div id="orangeTip" class="reviewTip orangeTip" hidden><b class="tipHead" id="orangeTipHead"></b><div class="ocBox" id="orangeClip"></div><p id="orangeCaption"></p></div><div id="iqrTip" class="reviewTip" hidden><b class="tipHead">학습 기록의 1초 변화량 분포 (IQR)</b><svg id="iqrSvg" viewBox="0 0 380 150" role="img" aria-label="IQR 분포 그림"></svg><p id="iqrCaption"></p></div>
 <p id="reviewMessage" role="status"></p></section><section class="rvStep" data-step="4"><h3>4. 전후 비교하고 저장하기</h3><p id="reviewExportState"></p><p id="reviewDistribution" class="subtle"></p><div class="downloads"><button id="reviewTrain" class="start">Orange 학습 파일 저장</button><button id="reviewValidation">Orange 검증 파일 저장</button><button id="reviewAudit">원본·처리 이력 저장</button></div><details class="csvOptions"><summary>표로 확인할 CSV 저장</summary><div class="downloads"><button id="reviewTrainCSV">학습 CSV 저장</button><button id="reviewValidationCSV">검증 CSV 저장</button></div></details><div class="afterSave" id="afterSave"><p class="afterHead" id="afterHead">저장한 파일로 이렇게 이어가요</p><ol>
 <li tabindex="0" data-clip="0"><b>Orange 열기</b> 아래 <b class="inl">Orange 작업 파일 받기</b>로 <code>model-save.ows</code>를 받아 두 번 누르면 준비된 작업 화면이 열려요.</li>
 <li tabindex="0" data-clip="1"><b>학습 파일 열기</b> File 위젯에서 <code>train.tab</code>을 열어요. 입력 4개와 목표값(1초 실제 변화)이 자동으로 지정돼요.</li>
 <li tabindex="0" data-clip="2"><b>학습시키기</b> File → Tree 위젯으로 연결해요. 트리를 펼쳐 어떤 기준으로 속도 변화를 나눴는지 살펴봐요.</li>
 <li tabindex="0" data-clip="3"><b>검증하기</b> Test &amp; Score의 테스트 데이터에 <code>validation.tab</code>을 연결해, 처음 보는 기록도 잘 맞히는지 확인해요.</li>
 <li tabindex="0" data-clip="4"><b>모델 저장</b> Python Script 위젯의 저장 창에서 <code>model.json</code>으로 저장해요. 3차시에 이 파일로 자율주행을 시켜요.</li></ol><div class="orangeGet"><a class="start" id="orangeGet" href="orange/model-save.ows" download="model-save.ows">Orange 작업 파일 받기</a><span class="subtle">단계 글자에 마우스를 올리면 Orange 화면 예시가 나와요.</span></div>
 <details class="orangeAlt"><summary>두 번 눌러도 안 열리면</summary><p><b>Mac</b> 터미널(응용 프로그램 → 유틸리티 → 터미널)에 아래 줄을 붙여 넣고 Enter를 누르세요.</p><div class="cmdRow"><code id="orangeCmd">open -a Orange ~/Downloads/model-save.ows</code><button id="orangeCopy">복사</button></div><p><b>Windows</b> Orange를 먼저 켜고 메뉴 File → Open에서 받은 <code>model-save.ows</code>를 고르세요.</p></details></div></section><div class="rvNav"><button id="rvPrev">이전 단계</button><button id="rvNext" class="start">다음 단계</button></div>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);
 const books={actual:new Review([]),practice:new Review(practiceRows(),{practice:true})};let selected=0,importCount=0;const seen=new Set();
 const book=()=>books[$('reviewDataset').value];
 function sync(){books.actual.learningContext=[...(books.actual.priorContext??[]),...getRuns().map(run=>({run_id:run.runId,intent:run.intent,reflections:structuredClone(run.reflections??{}),quest_completed_count:run.quest_completed_count,purpose:run.purpose}))];for(const run of getRuns())for(let i=0;i<run.rows.length;i++){const key=run.runId+':'+i;if(!seen.has(key)){seen.add(key);books.actual.raw.push(structuredClone(run.rows[i]));books.actual.splits[run.runId]??='unassigned';}}}
 const REVIEW_MSG='문제 후보를 검토하고 유지·수정·제외의 근거를 남기세요.';
 const runLabel=id=>{const i=[...new Set(book().raw.map(r=>r.run_id))].indexOf(id);return i<0?id:`주행 ${i+1}`;};
 const flagFields=r=>new Set([...r.candidates,...r.issues].map(x=>x.field).filter(Boolean));
 // 처리 방법 → 처리 이유 순서로 지금 채울 칸만 주황으로 안내한다.
 function guide(){const r=book().status().rows[selected],need=!!r&&!r.lock&&!r.decision;const act=$('reviewAction').value;
  $('reviewAction').classList.toggle('guideLine',need&&!act);$('reviewReason').classList.toggle('guide',need&&!!act&&!$('reviewReason').value.trim());}
 function fillDetail(){
  hideTips();const b=book(),s=b.status(),r=s.rows[selected];$('reviewFields').replaceChildren();$('reviewOriginal').replaceChildren();$('reviewIssues').replaceChildren();
  for(const id of ['reviewAction','reviewReason','reviewSave','reviewUndo'])$(id).disabled=!r||!!r.lock;
  for(const n of $('reviewRowList').children)n.classList.toggle('sel',+n.dataset.i===selected);$('reviewRowList').querySelector('.sel')?.scrollIntoView({block:'nearest'});
  if(!r){$('reviewIssues').textContent='아직 기록이 없습니다. 직접 주행하거나 개념 연습 데이터를 선택하세요.';$('reviewEvidence').textContent='';$('reviewReason').value='';return;}
  const list=[...r.candidates.map(x=>({text:x.type+': '+x.message,stat:x.type==='통계적 이상치 후보'})),...r.issues.filter(x=>x.message!==REVIEW_MSG&&!r.candidates.some(c=>c.message===x.message)).map(x=>({text:x.message}))];
  if(r.lock)list.push({text:r.lock});if(!list.length)list.push({text:'자동 검사에서 확인 후보가 없습니다. 정속·정지로 같은 값이 반복되어도 정상일 수 있습니다.',plain:true});
  const shown=new Set();for(const m of list){if(shown.has(m.text))continue;shown.add(m.text);const p=el('p',m.text,'issue'+(m.stat?' stat':'')+(m.plain?'':' clip'));if(!m.plain){p.tabIndex=0;p.title='마우스를 올리면 이 행의 주행 장면을 보여줘요';}$('reviewIssues').append(p);}
  const table=el('table'),head=el('thead'),header=el('tr');for(const text of ['항목','원본','처리 후'])header.append(el('th',text));head.append(header);table.append(head);
  const body=el('tbody'),cell=value=>{const exact=String(value??'')||'빈칸',text=typeof value==='number'&&Number.isFinite(value)?String(Number(value.toFixed(3))):exact;const td=el('td',text);td.title=exact;return td;};
  const flags=flagFields(r);for(const key of EDITABLE){const tr=el('tr');if(flags.has(key)&&!r.decision)tr.className='flag';tr.append(el('th',labels[key]),cell(r.original[key]),cell(r.effective[key]));body.append(tr);}table.append(body);
  $('reviewOriginal').append(table,el('p','숫자는 소수 셋째 자리까지 표시합니다. 원본·저장 파일의 정밀도는 유지합니다. 표에 마우스를 올리면 분포 그림이 보여요.','subtle'));
  $('reviewAction').value=r.decision?.action??'';$('reviewReason').value=r.decision?.reason??'';
  for(const key of EDITABLE){const label=el('label',labels[key]),input=el('input');input.type='text';input.dataset.field=key;input.value=r.effective[key]??'';input.autocomplete='off';label.append(input);$('reviewFields').append(label);}
  $('reviewFields').hidden=$('reviewAction').value!=='edit'||!!r.lock;guide();
  const run=$('reviewDataset').value==='actual'?getRuns().find(x=>x.runId===r.original.run_id):null;
  const t=Number(r.original.t_s),evidence=run?run.trace.filter(x=>x.t_s>=t&&x.t_s<=t+1).filter((x,i,a)=>i===0||i===a.length-1):[];
  $('reviewEvidence').textContent=run?JSON.stringify({interval:run.rows.find(x=>x.t_s===t),boundary_samples:evidence},null,2):b.practice?'명시적인 연습 자료입니다. 300km/h와 빈칸에는 복구 근거가 없으므로 값을 추측해 채우지 마세요. −8km/h는 가능한 급감속 사례이며 유지할 수 있습니다. 마지막 행은 동일 주행·시각의 중복입니다.':'가져온 CSV 원문만 있습니다. 실제 값 복구는 별도로 보존한 주행 원본에 근거해야 합니다.';
 }
 // 말풍선: 대상 요소 옆(오른쪽, 자리가 없으면 왼쪽)에 화면 좌표로 띄우고, 화면 밖으로 나가지 않게 위아래를 맞춘다.
 function placeTip(tip,target){tip.hidden=false;const t=target.getBoundingClientRect(),D=dialog.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
  // 대화창 밖은 잘려 보이므로 대화창 안쪽에 맞춘다.
  let left=t.right+14;if(left+w>D.right-8)left=Math.max(D.left+8,t.left-w-14);const top=Math.max(D.top+8,Math.min(t.top,D.bottom-h-8));
  // 대화창 애니메이션의 transform 때문에 fixed 기준이 화면이 아닐 수 있어, 실제 위치를 재고 차이만큼 보정한다.
  tip.style.left=left+'px';tip.style.top=top+'px';const r=tip.getBoundingClientRect();tip.style.left=left*2-r.left+'px';tip.style.top=top*2-r.top+'px';}
 // Orange 단계 말풍선: 목록 오른쪽에 띄우고, 자리가 없으면 해당 단계의 위나 아래에 띄워 가리키는 글자를 덮지 않는다.
 let orangeClip=null;
 function showOrange(li){hideOrange();const tip=$('orangeTip');
  // 말풍선 틀이 3단계 칸 안에 있어 4단계에서는 숨겨진다. 창 바로 아래로 옮겨 어느 단계에서도 보이게 한다.
  if(tip.parentElement!==dialog)dialog.append(tip);orangeClip=mountClip($('orangeClip'),+li.dataset.clip);$('orangeTipHead').textContent=orangeClip.title+' · 화면 예시';$('orangeCaption').textContent=orangeClip.caption;tip.hidden=false;
  const t=li.getBoundingClientRect(),ol=li.parentElement.getBoundingClientRect(),D=dialog.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;let left,top;
  if(ol.right+16+w<=D.right-8){left=ol.right+16;top=Math.max(D.top+8,Math.min(t.top+t.height/2-h/2,D.bottom-h-8));}
  else{left=Math.max(D.left+8,Math.min(t.left,D.right-w-8));top=t.top-h-10>=D.top+8||t.bottom+10+h>D.bottom-8?t.top-h-10:t.bottom+10;}
  tip.style.left=left+'px';tip.style.top=top+'px';const r=tip.getBoundingClientRect();tip.style.left=left*2-r.left+'px';tip.style.top=top*2-r.top+'px';li.classList.add('on');}
 function hideOrange(){orangeClip?.stop();orangeClip=null;$('orangeTip').hidden=true;dialog.querySelectorAll('.afterSave li.on').forEach(l=>l.classList.remove('on'));}
 let clip=null,clipWorld=null,clipRaf=0;
 function hideTips(){$('clipTip').hidden=true;$('iqrTip').hidden=true;clip=null;cancelAnimationFrame(clipRaf);}
 // 주행 장면 말풍선: 이 행의 1초 구간 앞뒤 1초까지 잘라 반복 재생한다(저장된 위치를 그대로 그리므로 기록은 바뀌지 않는다).
 function showClip(target){const r=book().status().rows[selected];if(!r)return;const run=$('reviewDataset').value==='actual'?getRuns().find(x=>x.runId===r.original.run_id):null;const t=Number(r.original.t_s);
  $('clipBox').hidden=!run;
  if(!run){$('clipCaption').textContent='이 자료에는 주행 영상이 없어요. (연습용 데이터 또는 불러온 CSV)';placeTip($('clipTip'),target);return;}
  const a=sampleAt(run,t),b=sampleAt(run,t+1),from=Math.max(run.trace[0].t_s,t-1),to=Math.min(run.trace.at(-1).t_s,t+2);
  $('clipCaption').innerHTML=`<b>${runLabel(r.original.run_id)} · ${t.toFixed(0)}~${(t+1).toFixed(0)}초</b> (앞뒤 1초 포함)<br>1초 동안 내 차 속도 ${a.ego_speed_kmh.toFixed(1)} → ${b.ego_speed_kmh.toFixed(1)}km/h, 변화 <b class="o">${(b.ego_speed_kmh-a.ego_speed_kmh).toFixed(1)}km/h</b> · 앞차 거리 ${a.gap_m.toFixed(1)}m`;
  placeTip($('clipTip'),target);
  if(!clipWorld)try{clipWorld=new World($('clipCanvas'),{view:'chase'});}catch{$('clipBox').hidden=true;return;}
  clip={run,from,to,t,start:performance.now()};cancelAnimationFrame(clipRaf);
  const loop=now=>{if(!clip||$('clipTip').hidden)return;const span=clip.to-clip.from,time=clip.from+((now-clip.start)/1000)%(span+.6);const sample=sampleAt(clip.run,Math.min(clip.to,time));
   clipWorld.resize();clipWorld.render(replayState(sample));$('clipBox').classList.toggle('inRow',sample.t_s>=clip.t&&sample.t_s<=clip.t+1);clipRaf=requestAnimationFrame(loop);};clipRaf=requestAnimationFrame(loop);}
 // IQR 말풍선: 학습 기록의 1초 변화량을 점으로 찍고, 상자(Q1~Q3)·울타리(1.5×IQR)·이 행의 값을 한 줄 위에 그린다.
 function showIqr(target){const b=book(),st=b.stats(),r=b.status().rows[selected];if(!r)return;const svg=$('iqrSvg');const v=Number(r.effective.actual_delta_kmh);
  if(!st.ready){svg.innerHTML='';$('iqrCaption').textContent=`학습 기록이 8개 이상이어야 분포를 그릴 수 있어요. (지금 ${st.values.length}개)`;placeTip($('iqrTip'),target);return;}
  const has=Number.isFinite(v),lo=Math.min(st.values[0],st.lo,has?v:Infinity),hi=Math.max(st.values.at(-1),st.hi,has?v:-Infinity),pad=(hi-lo||1)*.08,x=n=>20+(n-(lo-pad))/((hi+pad)-(lo-pad))*340;
  const counts=new Map(),dots=st.values.map(n=>{const k=Math.round(x(n));const c=counts.get(k)??0;counts.set(k,c+1);return `<circle cx="${k}" cy="${92-Math.min(c,10)*5}" r="2.6" class="dot"/>`;}).join('');
  const out=has&&(v<st.lo||v>st.hi),edge=v<st.lo?st.lo:st.hi,f=n=>(Math.round(n*10)/10).toFixed(1);
  svg.innerHTML=`<line x1="14" y1="100" x2="366" y2="100" class="axis"/>${dots}
   <rect x="${x(st.q1)}" y="104" width="${Math.max(2,x(st.q3)-x(st.q1))}" height="16" class="box"/><line x1="${x(st.median)}" y1="104" x2="${x(st.median)}" y2="120" class="med"/>
   <line x1="${x(st.lo)}" y1="40" x2="${x(st.lo)}" y2="124" class="fence"/><line x1="${x(st.hi)}" y1="40" x2="${x(st.hi)}" y2="124" class="fence"/>
   <text x="${Math.min(330,Math.max(50,x(st.lo)))}" y="${Math.abs(x(st.hi)-x(st.lo))<90?24:36}" class="fl">울타리 ${f(st.lo)}</text><text x="${Math.min(330,Math.max(50,x(st.hi)))}" y="36" class="fl">울타리 ${f(st.hi)}</text><text x="${Math.min(320,Math.max(60,(x(st.q1)+x(st.q3))/2))}" y="140" class="bl">가운데 50% (Q1~Q3)</text>
   ${has?`${out?`<line x1="${x(edge)}" y1="64" x2="${x(v)}" y2="64" class="gapLine"/>`:''}<circle cx="${x(v)}" cy="64" r="7" class="me${out?' out':''}"/><text x="${Math.min(330,Math.max(50,x(v)))}" y="52" class="ml">이 행 ${f(v)}</text>`:''}`;
  $('iqrCaption').innerHTML=has?(out?`이 행의 변화량 <b class="o">${f(v)}km/h</b>는 울타리(${f(edge)})보다 <b class="o">${f(Math.abs(v-edge))}km/h</b> 더 바깥이에요. 학습 기록 ${st.values.length}개 중 이렇게 먼 값은 드물어요. 진짜 급정거라면 유지해요.`:`이 행의 변화량 ${f(v)}km/h는 울타리 안쪽이라 분포상 흔한 값이에요.`):'이 행은 변화량 값이 비어 있어 분포에 찍을 수 없어요.';
  $('iqrCaption').insertAdjacentHTML('beforeend',`<br><span class="subtle">상자 폭(IQR) ${f(st.iqr)}km/h × 1.5 만큼 상자 바깥에 울타리를 쳐요.</span>`);
  placeTip($('iqrTip'),target);}
 function restart(e,c){e.classList.remove(c);void e.offsetWidth;e.classList.add(c);}
 function render(){
  const b=book(),s=b.status();$('reviewBanner').textContent=b.practice?'개념 연습 전용입니다. 실제 주행 자료와 섞이지 않으며 파일 이름에 practice가 붙습니다.':'원본을 보존합니다. 변경은 처리 이력에만 적용됩니다. 이 탭을 닫기 전에 이력을 저장하세요.';
  for(const btn of $('ratioPick').querySelectorAll('[data-r]'))btn.classList.toggle('on',+btn.dataset.r===b.ratio);
  const tr=s.rows.filter(r=>!r.excluded&&r.split==='train').length,va=s.rows.filter(r=>!r.excluded&&r.split==='validation').length,all=Math.max(1,tr+va);
  $('ratioTrain').style.width=tr/all*100+'%';$('ratioVal').style.width=va/all*100+'%';$('ratioTrain').textContent=tr?'학습':'';$('ratioVal').textContent=va?'검증':'';
  $('ratioCounts').innerHTML=`<b>학습 ${tr}행</b> · 검증 ${va}행 <span class="subtle">(제외된 행은 빠져요)</span>`;
  const kept=Object.entries(b.splits).filter(([,v])=>v!=='unassigned');$('reviewLegacy').textContent=kept.length?`이전 처리 이력의 주행은 저장된 배정을 그대로 써요: ${kept.map(([k,v])=>`${k}=${v==='train'?'학습':'검증'}`).join(', ')}`:'';
  const pending=s.rows.filter(r=>r.issues.length).length;
  const prev=+($('reviewCounts').dataset.pending??-1);$('reviewCounts').dataset.pending=pending;
  $('reviewCounts').innerHTML=`원본 ${s.total}행 · 수정 ${s.edited}행 · 제외 ${s.excluded}행 · 남는 기록 ${s.total-s.excluded}행 · <b class="pendingN${pending<prev?' drop':''}">확인 필요 ${pending}행</b>`;
  $('reviewNext').disabled=!pending;
  selected=Math.min(selected,Math.max(0,s.rows.length-1));
  $('reviewRowList').replaceChildren(...s.rows.map(r=>{const n=el('button',`${r.i+1}행 · ${runLabel(r.original.run_id)} · ${r.original.t_s}초 · ${r.excluded?'제외':r.issues.length?'확인 필요':r.decision?'판단 저장됨':'정상'}${r.candidates[0]?' · '+r.candidates[0].type:''}`,'rowItem'+(r.issues.length?' cand':'')+(r.decision?' done':'')+(r.excluded?' excl':''));n.dataset.i=r.i;n.setAttribute('role','option');return n;}));
  $('reviewExportState').textContent=`학습 ${s.train.length}행 / 검증 ${s.validation.length}행 · ${s.blocked?'저장 대기: 확인이 필요한 행을 처리하세요.':'검토 완료: Orange 파일을 저장할 수 있습니다.'}`;
  const un=s.rows.filter(r=>!r.excluded&&r.split==='unassigned').length;$('splitWarn').textContent=un?`아직 학습·검증에 배정되지 않은 기록이 ${un}행 있어요. 위에서 비율을 골라 배정해 주세요.`:'';$('ratioPick').parentElement.querySelector('.ratioBar').classList.toggle('warn',!!un);
  const counts={dry:0,wet:0};for(const r of s.train)if(r.effective.road in counts)counts[r.effective.road]++;$('reviewDistribution').textContent=`학습 자료의 노면 분포: 마름 ${counts.dry}, 젖음 ${counts.wet}. 부족한 상황은 새 주행으로 수집하세요.`;
  for(const id of ['reviewTrain','reviewValidation','reviewTrainCSV','reviewValidationCSV'])$(id).disabled=s.blocked;fillDetail();
 }
 $('orangeCopy').onclick=()=>{navigator.clipboard?.writeText($('orangeCmd').textContent).then(()=>{$('orangeCopy').textContent='복사됨';setTimeout(()=>$('orangeCopy').textContent='복사',1500);},()=>{});};dialog.addEventListener('close',hideOrange);
 $('ratioPick').onclick=e=>{const btn=e.target.closest('button');if(!btn)return;const b=book();if(btn.id==='ratioShuffle')b.setRatio(b.ratio,b.seed+1);else b.setRatio(+btn.dataset.r);render();};$('reviewDataset').onchange=()=>{selected=0;$('reviewMessage').textContent='';render();};$('reviewRowList').onclick=e=>{const n=e.target.closest('.rowItem');if(!n)return;selected=+n.dataset.i;fillDetail();};$('reviewAction').onchange=()=>{$('reviewFields').hidden=$('reviewAction').value!=='edit';guide();if($('reviewAction').value)$('reviewReason').focus();};$('reviewReason').addEventListener('input',guide);
 for(const [ev,on] of [['mouseover',true],['focusin',true],['mouseout',false],['focusout',false]])dialog.addEventListener(ev,e=>{const clipEl=e.target.closest?.('.issue.clip'),csv=e.target.closest?.('#reviewOriginal'),step=e.target.closest?.('.afterSave li[data-clip]');if(step){if(on){if(!step.classList.contains('on'))showOrange(step);}else if(!step.contains(e.relatedTarget))hideOrange();return;}if(on){if(clipEl&&$('clipTip').hidden)showClip(clipEl);else if(csv&&$('iqrTip').hidden)showIqr(csv);}else{const to=e.relatedTarget;if(clipEl&&!clipEl.contains(to))hideTips();if(csv&&!csv.contains(to))hideTips();}});
 $('reviewSave').onclick=()=>{try{const patch={};for(const input of $('reviewFields').querySelectorAll('input')){const k=input.dataset.field,v=input.value;patch[k]=v;}
  const row=book().status().rows[selected],types=row?[...row.candidates,...row.issues].map(x=>x.type):[];
  book().decide(selected,$('reviewAction').value,$('reviewReason').value,patch);helperEvent({type:'review-decision',action:$('reviewAction').value,types,reason:$('reviewReason').value});$('reviewMessage').textContent='판단을 저장했습니다. 원본은 변경하지 않았습니다.';render();}catch(e){$('reviewMessage').textContent=e.message;}};
 $('reviewUndo').onclick=()=>{book().undo(selected);$('reviewMessage').textContent='이 행의 처리를 취소했습니다. 취소 이력은 보존됩니다.';render();};
 $('reviewNext').onclick=()=>{const list=book().status().rows.filter(r=>r.issues.length);if(list.length){selected=(list.find(r=>r.i>selected)??list[0]).i;fillDetail();}};
 $('reviewImport').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error('5MB 이하 파일을 사용하세요.');const text=await file.text(),isAudit=/\.json$/i.test(file.name);let next;
  if(isAudit&&$('reviewAppend').checked){
   // 이전 판단·배정을 그대로 복원하고, 그 뒤에 지금 탭의 주행을 붙인다. 이미 이력에 있는 주행은 다시 넣지 않는다.
   const restored=Review.restore(JSON.parse(text));if(restored.practice)throw Error('개념 연습 이력에는 이어 붙일 수 없습니다.');
   const prior=new Set(restored.raw.map(r=>r.run_id));restored.priorContext=restored.learningContext;books.actual=restored;seen.clear();
   for(const run of getRuns())if(prior.has(run.runId))for(let i=0;i<run.rows.length;i++)seen.add(run.runId+':'+i);
   sync();$('reviewDataset').value='actual';selected=0;render();$('reviewMessage').textContent=`이전 처리 이력 ${prior.size}개 주행의 판단·배정을 복원하고 지금 주행을 뒤에 붙였습니다. 새 주행은 정한 비율로 학습·검증에 나눠요.`;e.target.value='';return;}
  if(isAudit)next=Review.restore(JSON.parse(text));else{const rows=parseCSV(text);if(rows.length>5000)throw Error('한 번에 5,000행 이하를 불러오세요.');next=new Review(rows);}
  const key='import-'+(++importCount);books[key]=next;$('reviewDataset').add(new Option((isAudit?'이력: ':'CSV: ')+file.name,key));$('reviewDataset').value=key;selected=0;render();$('reviewMessage').textContent=isAudit?'이전 판단과 배정을 복원하고 오류를 다시 검사했습니다.':'별도 자료로 불러왔습니다. 기존 주행 자료는 그대로입니다.';}catch(err){$('reviewMessage').textContent=err.message;}e.target.value='';};
 for(const [id,part,ext] of [['reviewTrain','trainTab','tab'],['reviewValidation','validationTab','tab'],['reviewTrainCSV','train','csv'],['reviewValidationCSV','validation','csv']])$(id).onclick=()=>{try{const b=book(),result=b.export(),name=(b.practice?'practice-':'')+part.replace('Tab','')+'.'+ext;download(name,result[part],'text/plain;charset=utf-8');$('reviewMessage').textContent=name+' 저장을 요청했습니다.';$('afterSave').classList.add('saved');$('afterHead').textContent=`${name} 저장 완료! 이제 Orange에서 이렇게 이어가요`;}catch(e){$('reviewMessage').textContent=e.message;}};
 $('reviewAudit').onclick=()=>{const b=book();download((b.practice?'practice-':'')+'preprocessing-audit.json',JSON.stringify(b.audit(),null,2),'application/json');};
 // 전처리는 한 화면에 몰아두지 않고 4단계로 하나씩 보여준다(자료 → 주행 나누기 → 확인·처리 → 저장).
 let step=1;function go(n){n=Math.max(1,Math.min(4,n));if(n>=3&&book().status().rows.some(r=>!r.excluded&&r.split==='unassigned')){n=2;render();restart($('splitWarn'),'denied');}step=n;hideTips();for(const p of dialog.querySelectorAll('.rvStep'))p.hidden=+p.dataset.step!==step;for(const li of dialog.querySelectorAll('#rvSteps li')){li.classList.toggle('now',+li.dataset.go===step);li.classList.toggle('done',+li.dataset.go<step);}$('rvPrev').disabled=step===1;$('rvNext').hidden=step===4;dialog.scrollTop=0;}
 for(const li of dialog.querySelectorAll('#rvSteps li'))li.onclick=()=>go(+li.dataset.go);$('rvPrev').onclick=()=>go(step-1);$('rvNext').onclick=()=>go(step+1);go(1);
 return {open(){pause();sync();render();go(1);dialog.showModal();},isOpen:()=>dialog.open};
}
