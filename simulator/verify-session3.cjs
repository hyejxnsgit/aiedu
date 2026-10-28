// 3차시 브라우저 흐름 검증: 모델 불러오기 → 결과 예상(장면 3개 + 주행) → 자동 주행 → 결과 → 장면 분석
// → B 코스 → 개선용 기록 운전 → 2차시 처리 이력에 이어 붙이기 → 모델 2로 같은 조건 비교 → 보고서 저장.
// 실행: npm run build, python3 preview.py 를 띄운 뒤
//   node verify-session3.cjs <model.json> <2차시 preprocessing-audit.json> <스크린샷 폴더>
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const [modelPath,auditPath,out]=process.argv.slice(2);
const assert=(c,m)=>{if(!c)throw Error('검증 실패: '+m);};
(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1366,height:860},acceptDownloads:true});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/\.woff2?$/.test(m.location().url||''))errs.push(m.text())}); // 웹폰트(CDN) 차단은 환경 문제라 제외
await p.goto(process.env.URL||'http://127.0.0.1:8766/#s3');await p.waitForTimeout(1000);
const T=s=>p.textContent(s),log=(...a)=>console.log(...a),shot=n=>p.screenshot({path:path.join(out,n)});
const open=id=>p.$eval('#'+id,d=>d.open);
async function loadModel(){await p.click('#settingsBtn');await p.setInputFiles('#modelFile',modelPath);await p.waitForFunction(()=>!document.getElementById('modelPicked').hidden);const rv=await p.waitForSelector('dialog.modelReveal[open]');log('모델 공개:',await rv.$eval('h2',e=>e.textContent));await p.waitForTimeout(1200);await shot('s3-00-model-reveal.png').catch(()=>{});if(await p.$('dialog.modelReveal[open]'))await p.click('dialog.modelReveal .splashStart',{timeout:3000}).catch(()=>{});await p.waitForSelector('dialog.modelReveal',{state:'detached',timeout:8000});await p.waitForTimeout(300);await shot('s3-00-model-picked.png');log('모델:',await T('#modelPicked'),'| 선택',await p.$eval('#modelVersion',s=>s.selectedOptions[0]?.textContent));}
async function untilEnded(ms=90000){const t0=Date.now();while(Date.now()-t0<ms){if(await open('resultDialog'))return;if(/응답이 늦어져/.test(await T('#notice'))&&(await p.$eval('#pause',e=>e.classList.contains('resume')))){await p.click('#pause');}await p.waitForTimeout(200);}throw Error('자동 주행이 끝나지 않음');}
async function forecast(outcome,violation,expectProbes){
 assert(await open('forecastDialog'),'출발 전에 예상 창이 열려야 함');
 const cards=await p.$$('#probeCards .probeCard');assert(cards.length===3,'예상 장면 3개');
 if(expectProbes){
  const nextIdx=async()=>p.$$eval('#probeCards .probeCard',c=>c.findIndex(x=>x.classList.contains('nextProbe')));assert(await nextIdx()===0,'첫 예상 칸부터 반짝임');
  log(' 질문:',await p.$$eval('#probeCards .probeCard',c=>c.map(x=>x.querySelectorAll('.probeAsk li').length).join('/')),'| 안내문:',await T('#probeSection .subtle'));
  await cards[1].hover();await p.waitForTimeout(2500);const [cb,tb]=[await cards[1].boundingBox(),await p.locator('.probeTip').boundingBox()];
  log(' 장면 말풍선:',await T('.probeTip p'),'| 칸 아래',tb&&tb.y>=cb.y+cb.height);assert(tb&&tb.y>=cb.y+cb.height,'말풍선은 칸 아래');await shot('s3-01b-probe-hover.png');await p.mouse.move(5,5);
  await p.click('#forecastGo');log(' 장면 예상 없이 출발 →',await T('#forecastMessage'));assert(/세 장면/.test(await T('#forecastMessage')),'장면 예상 없이 출발 거부');
  await (await cards[0].$('button')).click();log(' 고르지 않고 모델 값 보기 →',await T('#forecastMessage'));assert(/먼저/.test(await T('#forecastMessage')),'예상 없이 모델 값 공개 거부');
  for(const [i,choice] of [[0,'brake'],[1,'brake_hard'],[2,'speed_up']]){assert(await nextIdx()===i,`${i+1}번 칸 차례에 반짝임`);const c=(await p.$$('#probeCards .probeCard'))[i];if(i===1)await (await c.$('.probeWhy')).fill('내 기록에서는 가까우면 세게 밟았으니까, 모델은 아마 크게 줄일 거야.');await (await c.$('select')).selectOption(choice);await (await c.$('button')).click();}
  const reveals=await p.$$eval('#probeCards .reveal',e=>e.map(x=>x.textContent));assert(reveals.length===3,'모델 값 3개 공개');log(' 공개:',reveals.join(' | '));
  assert(await p.$$eval('#probeCards select',s=>s.every(x=>x.disabled)),'공개 뒤에는 내 예상을 바꿀 수 없음');
 }else{const r=await p.$$eval('#probeCards .reveal',e=>e.length);assert(r===3,'같은 모델·노면이면 이전 장면 예상을 불러옴');assert(await p.isVisible('#probeReset'),'다시 예상하기 버튼');
  await p.click('#probeReset');assert(await p.$$eval('#probeCards .reveal',e=>e.length)===0&&await p.$$eval('#probeCards select',s=>s.every(x=>!x.disabled)),'다시 예상하기로 초기화');log(' 다시 예상하기: 초기화됨');
  for(const [i,choice] of [[0,'brake'],[1,'brake_hard'],[2,'speed_up']]){const c=(await p.$$('#probeCards .probeCard'))[i];await (await c.$('select')).selectOption(choice);await (await c.$('button')).click();}}
 await p.selectOption('#fcOutcome',outcome);await p.selectOption('#fcViolation',violation);await p.click('#forecastGo');assert(/모두/.test(await T('#forecastMessage')),'이유 없이 출발 거부');
 await p.fill('#fcReason','멈춘 앞차 장면에서 모델이 크게 감속했다.');await p.click('#forecastGo');assert(!(await open('forecastDialog')),'예상 저장 후 창 닫힘');{await p.waitForTimeout(150);const c=await T('.countdown');log(' 카운트다운:',c);assert(/^[321]$/.test(c),'출발 전 3·2·1');await shot('s3-01c-countdown.png');await p.waitForTimeout(3600);}
}
// 1. 모델 없이 시작. 헤드리스 소프트웨어 렌더링에서는 실내(운전자 시점) 프레임이 0.3초를 넘어 자동 일시정지되므로 차량 뒤 시점으로 검증한다.
await p.click('#camera');await p.waitForTimeout(1000);
await shot('s3-00-overlay.png');log('단계:',await T('#missionStep'),'|',await T('#overlayTitle'));
await loadModel();await p.selectOption('#surface','wet');await p.click('#apply');
log('단계:',await T('#missionStep'),'|',await T('#overlayTag'),'|',await T('#start'));
await p.click('#start');await shot('s3-01-forecast-empty.png');await forecast('collision','yes',true);await shot('s3-02-driving.png');
await untilEnded();await shot('s3-03-result.png');
const facts=await p.$$eval('#resultFacts div',d=>d.map(x=>x.textContent));log('결과:',facts.join(' | '));log('예상 비교:',(await p.$$eval('#resultCheck .askRow',r=>r.map(x=>x.textContent))).join(' / '));
assert(await p.$$eval('#resultDialog .masked',m=>m.length)===4,'정답은 가려져 있음');log(' 질문:',(await p.$$eval('.askRow p',r=>r.map(x=>x.textContent))).join(' / '));await shot('s3-03a-result-masked.png');
await p.click('.askRow button[data-reveal="outcome"]');assert(await p.$$eval('#resultDialog [data-reveal="outcome"].masked',m=>m.length)===0,'누르면 결과 공개(위 카드도 함께)');await p.click('.askRow button[data-reveal="violation"]');
assert(/예상과 같음/.test(await T('#resultCheck')),'충돌 예상이 실제와 비교되어야 함');
// 2. 장면 분석
await p.click('#resultAnalyze');await p.waitForTimeout(800);const scenes=await p.$$eval('#analysisScene option',o=>o.map(x=>x.textContent));log('분석 장면:',scenes.join(' / '));
assert(/충돌/.test(scenes[0]),'충돌 장면이 첫 번째');
await p.$eval('#analysisSlider',e=>{e.value=e.min;e.dispatchEvent(new Event('input'))});const nowText=await T('#analysisNow'),decision=await T('#analysisDecision');log(' 장면 시작:',nowText);log(' 판단:',decision);
assert(/모델 제안/.test(decision)&&/프로그램 기준/.test(nowText),'판단 카드와 기준 거리 표시');
await p.click('#analysisSave');assert(/모두/.test(await T('#analysisMessage')),'빈 분석 저장 거부');
await p.selectOption('#analysisCause',{index:1});await p.fill('#analysisEvidence','충돌 3초 전 거리가 10m 안쪽인데 모델 제안이 −3km/h 정도였다.');await p.fill('#analysisPlan','앞차가 멈출 때 확실히 멈추는 주행을 더 기록한다.');await p.click('#analysisSave');
log(' 저장:',await T('#analysisMessage'));assert(/분석함/.test((await p.$$eval('#analysisScene option',o=>o.map(x=>x.textContent)))[0]),'저장한 장면 표시');await shot('s3-04-analysis.png');
// 3. B 코스 (같은 모델·같은 노면이면 장면 예상은 다시 묻지 않음)
await p.click('#analysisToCompare');log(' 비교 창:',await T('#cmpTitle'));await p.click('#cmpSteps li[data-go="2"]');await p.selectOption('#cmpCourse','B');await p.selectOption('#cmpRoad','wet');await p.click('#cmpRun');
log('B 코스:',await T('#forecastWho'),'| 표시',await T('#phase'));await forecast('completed','yes',false);await untilEnded();log(' 결과:',(await p.$$eval('#resultFacts div',d=>d.map(x=>x.textContent))).slice(0,3).join(' | '));
await p.click('#resultCompare');log(' 결과 뒤 비교 창:',await T('#cmpTitle'));await p.click('#cmpSteps li[data-go="1"]');
// 4. 개선용 기록 운전 (운전대·페달이 다시 보여야 함)
await p.click('#improveRun');assert(await open('intentDialog'),'개선 기록 전 기준 정하기');await p.click('#introNext');await p.waitForTimeout(800);await p.click('#intentBegin');
assert(await p.$eval('#gas',e=>getComputedStyle(e.parentElement).display!=='none'),'3차시 개선 기록에서는 페달이 보여야 함');log('개선 기록:',await T('#overlayTag'),'|',await T('#missionHint'));
await p.keyboard.down('ArrowDown');await p.waitForTimeout(2500);await p.keyboard.up('ArrowDown');await p.waitForTimeout(1200);await p.click('#finish');await p.waitForTimeout(300);
log(' 종료 안내:',await T('#notice'));assert(!(await open('reflectionDialog')),'3차시에서는 2차시 회고 창을 열지 않음');assert(/개선용 기록/.test(await T('#notice')),'개선 기록 종료 안내');
// 5. 전처리: 2차시 처리 이력에 이어 붙이기
await p.click('#evalBtn');await p.click('#improveReview');assert(await open('reviewDialog'),'3차시에서는 바로 전처리 창');
await p.check('#reviewAppend');await p.setInputFiles('#reviewImport',auditPath);await p.waitForTimeout(300);log('이어 붙이기:',await T('#reviewMessage'));
const legacy=await T('#reviewLegacy');log(' 이전 배정:',legacy,'| 비율:',await T('#ratioCounts'));
assert(/s2-run-1=학습/.test(legacy)&&/s2-run-2=검증/.test(legacy),'2차시 배정 복원');
log(' 전처리 행 수:',await T('#reviewCounts'));await shot('s3-05-review-append.png');
await p.keyboard.press('Escape');await p.waitForTimeout(150);assert(!(await p.$('#reviewClose')),'운전 화면으로 버튼 없음');
// 6. 모델 2를 불러와 첫 주행과 같은 조건(A·젖은 노면·40m)으로 비교
await loadModel();await p.click('#settings .dialogHead button');await p.click('#evalBtn');await p.click('#cmpSteps li[data-go="2"]');
await p.selectOption('#cmpModel','2');await p.selectOption('#cmpCourse','A');await p.selectOption('#cmpRoad','wet');await p.selectOption('#cmpGap','40');await p.click('#cmpRun');
await forecast('collision','yes',true);await untilEnded();await p.click('#resultCompare');
const table=await p.$$eval('#compareRows tr',r=>r.map(x=>[...x.children].map(c=>c.textContent).join(' ¦ ')));log('비교표:\n  '+table.join('\n  '));
assert(table.filter(r=>r.startsWith('●')).length===2,'같은 조건의 모델 1·2만 비교 표시');
// 7. 보고서
await p.click('#cmpSteps li[data-go="3"]');await shot('s3-06b-report-step.png');
for(const [k,v] of [['choice','앞차가 멈출 때 정지하는 주행을 1회 더 기록해 학습에 넣었다.'],['fact','두 모델 모두 A 코스 젖은 노면에서 충돌했다.'],['evidence','비교표 최소 거리 0m, 장면 분석의 모델 제안'],['scope','기록 1회로는 개선을 확인하지 못했다.'],['question','사람 운전 기록을 얼마나 모아야 믿을 수 있을까?']])await p.fill(`[data-report="${k}"]`,v);
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#reportSave')]);const file=path.join(out,'session3-result.json');await dl.saveAs(file);
const saved=JSON.parse(fs.readFileSync(file,'utf8'));log('저장 파일:',dl.suggestedFilename(),'| 모델',saved.models.length,'| 자동 주행',saved.runs.length,'| 보고서 완성',saved.report_complete,'| 개선 기록',saved.improvement_runs.length);
assert(saved.runs.length===3&&saved.models.length===2&&saved.report_complete&&saved.runs[0].forecast&&Object.keys(saved.runs[0].analyses).length===1,'저장 내용');
await shot('s3-06-compare-report.png');
log('단계:',await T('#missionStep'));
log('콘솔 오류:',errs.length?errs:'없음');assert(!errs.length,'콘솔 오류');
await b.close();log('3차시 브라우저 흐름 검증 통과');
})().catch(e=>{console.error(e);process.exit(1);});
