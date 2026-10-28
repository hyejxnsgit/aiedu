// 브라우저 전체 흐름 검증: 퀘스트 4개 → 기준 선택 → 기록 주행 → 장면 회고 → 1분 영상·개념 확인 → 전처리.
// 실행: simulator 폴더에서 npm run build 후 python3 preview.py 를 띄우고 node verify-learning-flow.cjs <스크린샷 폴더> (Playwright·Chromium 필요)
const {chromium}=require('playwright');
const out=process.argv[2];
const assert=(c,m)=>{if(!c)throw new Error('assert: '+m);};
(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage({viewport:{width:1366,height:820}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/\.woff2?$/.test(m.location().url||''))errs.push(m.text())}); // 웹폰트(CDN) 차단은 환경 문제라 제외
await p.goto(process.env.URL||'http://127.0.0.1:8766/#s2');await p.waitForTimeout(800);
// 헤드리스 소프트웨어 렌더링에서는 실내(운전자 시점) 프레임이 0.3초를 넘어 자동 일시정지되므로 차량 뒤 시점으로 검증한다.
await p.click('#camera');await p.waitForTimeout(800);
const T=s=>p.textContent(s);const log=(...a)=>console.log(...a);
const waitTitle=async(re,ms=15000)=>{const t0=Date.now();while(Date.now()-t0<ms){const t=await T('#overlayTitle');if(re.test(t))return t;await p.waitForTimeout(50);}throw Error('timeout title '+re+' got '+await T('#overlayTitle'));};
log('intro:',await T('#overlayTitle'),'| list',await p.$$eval('#questList li',l=>l.length),'| mission',await T('#missionStep'));await p.waitForTimeout(700);await p.screenshot({path:out+'/00-intro.png'});
await p.click('#start');await p.waitForTimeout(700);log('Q1:',await T('#overlayTag'),await T('#overlayTitle'),'| button',await T('#start'),'| count',await T('#count'));await p.screenshot({path:out+'/00-quest1.png'});
await p.click('#start');await p.keyboard.down('ArrowUp');log('Q1',await waitTitle(/클리어|한 번 더/));await p.keyboard.up('ArrowUp');await p.waitForTimeout(800);log(' clear button',await T('#start'),'| text hidden',await p.$eval('#overlayText',e=>e.hidden),'| filled checks',await p.$$eval('#missionStep i.on',e=>e.length));await p.screenshot({path:out+'/00-clear1.png'});log(' speed',await T('#speed'));
await p.click('#start');log('Q2 step:',await T('#missionStep'));
// edge: tap gas first then release
await p.click('#start');await p.keyboard.down('ArrowUp');await p.waitForTimeout(300);await p.keyboard.up('ArrowUp');
const t2=Date.now();let r2;try{r2=await waitTitle(/클리어|한 번 더/,14000);}catch(e){r2='TIMEOUT';}log('Q2 after tapping gas ->',r2,'in',(Date.now()-t2)/1000,'s speed',await T('#speed'));
if(/한 번 더/.test(r2)){await p.click('#start');await p.click('#start');log(' Q2 retry ->',await waitTitle(/클리어|한 번 더/));}
await p.click('#start');log('Q3 step:',await T('#missionStep'));await p.click('#start');await p.keyboard.down('ArrowDown');log('Q3',await waitTitle(/클리어|한 번 더/));await p.keyboard.up('ArrowDown');log(' speed',await T('#speed'));
await p.click('#start');log('Q4 step:',await T('#missionStep'));
// negative: go immediately
await p.click('#start');await p.keyboard.down('ArrowUp');log('Q4 early ->',await waitTitle(/클리어|한 번 더/),'|',await T('#overlayText'));await p.keyboard.up('ArrowUp');
await p.click('#start');await p.click('#start');
const t0=Date.now();while(!/출발했습니다/.test(await T('#phase'))&&Date.now()-t0<6000)await p.waitForTimeout(50);
await p.keyboard.down('ArrowUp');log('Q4 proper ->',await waitTitle(/클리어|한 번 더/),'| button:',await T('#start'));await p.keyboard.up('ArrowUp');
log('count after quests',await T('#count'));
log('records button disabled before any run',await p.$eval('#recordsBtn',b=>b.disabled));
await p.screenshot({path:out+'/01-quests-done.png'});
await p.click('#start');log('intent open',await p.$eval('#intentDialog',d=>d.open));
for(const [n,ms] of [['a',500],['b',1700]]){await p.waitForTimeout(ms);await p.screenshot({path:out+'/06-intent-'+n+'.png'});}
await p.waitForTimeout(3000);log(' still on example after 5s',await p.$eval('#intentDialog',d=>d.classList.contains('stageWhy')&&!d.classList.contains('stageOut')));await p.click('#introNext');await p.waitForTimeout(1500);await p.screenshot({path:out+'/06-intent-c.png'});
log(' intent intro done',!(await p.$eval('#intentDialog',d=>d.classList.contains('intro'))),'| rules',await p.$$eval('.ruleSet li',l=>l.map(x=>x.querySelector('p').textContent)));
await p.$eval('#ruleGap',s=>{s.value=20;s.dispatchEvent(new Event('input'))});log(' gap slider -> output',await T('#ruleGapOut'));await p.waitForTimeout(300);await p.screenshot({path:out+'/06-intent-d.png'});await p.click('#intentBegin');await p.waitForTimeout(200);
log('countdown:',await p.$eval('.countdown',e=>!e.hidden&&e.textContent),'| overlay hidden',await p.$eval('#overlay',e=>e.hidden));await p.waitForTimeout(1300);await p.screenshot({path:out+'/05-countdown.png'});await p.waitForFunction(()=>document.querySelector('.countdown').hidden,null,{timeout:8000});
log('collecting, mission:',await T('#missionStep'),'|',await T('#missionHint'));
await p.waitForTimeout(600);await p.click('#pause');await p.waitForTimeout(200);log('pause: overlay hidden',await p.$eval('#overlay',o=>o.hidden),'| resume icon',await p.$eval('#pause',b=>b.classList.contains('resume')),'| action',await T('#action'));await p.screenshot({path:out+'/05-paused.png'});
await p.click('#pause');await p.waitForTimeout(200);log(' resume: playing',!(await p.$eval('#pause',b=>b.classList.contains('resume'))),'| action',await T('#action'));
await p.keyboard.down('ArrowUp');await p.waitForTimeout(2500);await p.keyboard.up('ArrowUp');await p.waitForTimeout(3500);
await p.keyboard.down('ArrowDown');await p.waitForTimeout(2500);await p.keyboard.up('ArrowDown');await p.waitForTimeout(1500);
log('rows count',await T('#count'),'time',await T('#time'),'action',await T('#action'));
if(!/종료|완주|충돌/.test(await T('#action')))await p.click('#finish');await p.waitForTimeout(300);
log('after run:',await T('#overlayText'),'| next dialog open',await p.$eval('#nextStepDialog',d=>d.open),'| mission',await T('#missionStep'));
log(' change-rules button visible',await p.$eval('#changeRules',b=>!b.hidden));await p.click('#newRun');await p.waitForTimeout(300);log(' new run -> intent dialog open?',await p.$eval('#intentDialog',d=>d.open),'| start button',await T('#start'),'| hint',await T('#missionHint'));
if(await p.$eval('#nextStepDialog',d=>d.open))await p.click('#nextGo');else{await p.click('#recordsBtn');await p.click('#toReview');}await p.waitForTimeout(300);
log('reflection open',await p.$eval('#reflectionDialog',d=>d.open),'| tabs',await T('#ruleTabs'),'| watching',await T('#watchRule'));
log('toLesson disabled',await p.$eval('#reflectionToLesson',b=>b.disabled));
const askOpen=()=>p.$eval('#ruleAsk',d=>d.open);
const waitAsk=async()=>{await p.waitForFunction(()=>document.getElementById('ruleAsk').open,null,{timeout:40000});await p.waitForTimeout(700);};
log('ask before replay ends',await askOpen());await p.screenshot({path:out+'/02-reflection.png'});
await p.click('#reflectionClose');await p.click('#recordsBtn');await p.click('#toReview');await p.waitForTimeout(200);
log('toReview before reflection -> reflection open?',await p.$eval('#reflectionDialog',d=>d.open),'review open?',await p.$eval('#reviewDialog',d=>d.open));
await waitAsk();log('ask rules:',await p.$$eval('#askRules li',l=>l.map(x=>(x.classList.contains('now')?'*':'')+x.textContent)),'|',await T('#ruleAskText'));await p.screenshot({path:out+'/02-ask.png'});
await p.click('#ruleNo');await p.waitForTimeout(200);log(' no -> ask closed',!(await askOpen()),'| replaying',await T('#replayPlay'),'| compare hidden',await p.$eval('#comparePane',e=>e.hidden));
for(let i=0;i<3;i++){
 await waitAsk();await p.click('#ruleYes');await p.waitForTimeout(300);
 log(`rule ${i+1} compare:`,await T('#cmpLabel'),'|',await T('#cmpRule'),'|',await T('#cmpActual'),'|',await T('#cmpVerdict'));
 if(i===0){await p.screenshot({path:out+'/02-compare.png'});await p.click('#saveReflection');log(' incomplete msg:',await T('#reflectionMessage'));}
 await p.click('#matchOpts button[data-v=partly]');await p.fill('#reflectionEvidence','기록을 보니 일부만 기준대로 했다');await p.click('#saveReflection');
 log(' saved msg:',await T('#reflectionMessage'),'| tabs',await T('#ruleTabs'));await p.waitForTimeout(900);
}
log('toLesson disabled after 3 rules',await p.$eval('#reflectionToLesson',b=>b.disabled));
await p.click('#reflectionToLesson');await p.waitForTimeout(500);
log('lesson open',await p.$eval('#dataLessonDialog',d=>d.open),'review open',await p.$eval('#reviewDialog',d=>d.open));
const v=await p.$eval('#dataLessonVideo',async v=>{v.muted=true;try{await v.play();}catch(e){return 'play err '+e.message}await new Promise(r=>setTimeout(r,1500));return {dur:v.duration,t:v.currentTime,w:v.videoWidth,h:v.videoHeight,err:v.error&&v.error.code}});
log('video',JSON.stringify(v));await p.screenshot({path:out+'/03-lesson.png'});
log('quiz before video end',await p.$eval('#lessonQuiz',d=>d.open),'| grey caption gone',!(await p.$('#dataLessonDialog > p.subtle')));
// 영상 끝(ended) → 가운데 퀴즈 창
await p.$eval('#dataLessonVideo',v=>{v.pause();v.dispatchEvent(new Event('ended'));});await p.waitForFunction(()=>document.getElementById('lessonQuiz').open,null,{timeout:8000});await p.waitForTimeout(600);
log('quiz Q1:',await T('#quizNo'),await T('#quizQ'),'| options',await p.$$eval('.quizOpt',b=>b.length));await p.screenshot({path:out+'/03-quiz1.png'});
await p.click('.quizOpt[data-ok=false]');await p.waitForTimeout(120);log(' wrong -> denied',await p.$eval('.quizOpt[data-ok=false]',b=>b.classList.contains('denied')),'| hint',await T('#quizHint'),'| still Q1',await T('#quizNo'));await p.screenshot({path:out+'/03-quiz-wrong.png'});
await p.click('.quizOpt[data-ok=true]');await p.waitForTimeout(1000);log(' right -> Q2:',await T('#quizNo'),'| options',await p.$$eval('.quizOpt',b=>b.map(x=>x.textContent)));
await p.click('.quizOpt[data-ok=true]');await p.waitForTimeout(1300);log(' clear:',await T('#quizNo'),'| go visible',await p.$eval('#quizGo',b=>!b.hidden),'| ready pulse',await p.$eval('#quizGo',b=>b.classList.contains('ready')));await p.screenshot({path:out+'/03-quiz-clear.png'});
await p.click('#quizGo',{force:true});await p.waitForTimeout(300);
log('after correct: lesson open',await p.$eval('#dataLessonDialog',d=>d.open),'review open',await p.$eval('#reviewDialog',d=>d.open));
log('review counts',await T('#reviewCounts'));
log('review row sources',JSON.stringify(await p.$$eval('#reviewRowList .rowItem',o=>o.slice(0,3).map(x=>x.textContent))));
await p.screenshot({path:out+'/04-review.png'});
for(const [i,n] of [[1,'miss'],[2,'outlier']]){await p.hover(`.conceptCard:nth-child(${i})`);await p.waitForTimeout(400);log('concept '+n+' tip visible',await p.$eval(`.conceptCard:nth-child(${i}) .conceptTip`,e=>getComputedStyle(e).opacity));await p.screenshot({path:out+'/04-concept-'+n+'.png'});}await p.mouse.move(5,5);log(' csv note gone',!(await T('#reviewDialog')).includes('수업 물리 설정(v0.1)'));
await p.click('#rvSteps li[data-go="2"]');await p.waitForTimeout(400);log('ratio step:',await T('#ratioCounts'));await p.screenshot({path:out+'/04-ratio.png'});await p.click('#rvSteps li[data-go="1"]');
log('row1 issues',await p.$eval('#reviewIssues',e=>e.innerText));
await p.click('#rvSteps li[data-go="3"]');await p.waitForTimeout(200);await p.click('#reviewRowList .rowItem:last-child');await p.waitForTimeout(200);await p.hover('#reviewIssues .issue');await p.waitForTimeout(1500);log('actual clip:',await p.$eval('#clipTip',e=>!e.hidden),'| canvas shown',await p.$eval('#clipCanvas',e=>!e.hidden),'|',await T('#clipCaption'));await p.screenshot({path:out+'/04-clip-actual.png'});await p.mouse.move(5,5);
// 개념 연습 데이터로 3단계 강조·말풍선·처리 안내 확인
await p.click('#rvSteps li[data-go="1"]');await p.selectOption('#reviewDataset','practice');await p.click('#rvSteps li[data-go="3"]');await p.waitForTimeout(300);
log('practice counts:',await T('#reviewCounts'),'| blinking candidates',await p.$$eval('#reviewRowList .rowItem.cand',l=>l.length));
await p.click('#reviewRowList .rowItem[data-i="3"]');await p.waitForTimeout(200);
log(' row4 issues:',await p.$$eval('#reviewIssues .issue',l=>l.map(x=>(x.classList.contains('stat')?'[stat] ':'')+x.textContent)),'| flagged cells',await p.$$eval('#reviewOriginal tr.flag th',l=>l.map(x=>x.textContent)),'| action guide',await p.$eval('#reviewAction',e=>e.classList.contains('guideLine')),'| review msg gone',!(await T('#reviewIssues')).includes('문제 후보를 검토하고'));
await p.hover('#reviewIssues .issue.stat');await p.waitForTimeout(300);log(' clip tip:',await p.$eval('#clipTip',e=>!e.hidden),await T('#clipCaption'));
await p.hover('#reviewOriginal table');await p.waitForTimeout(300);log(' iqr tip:',await p.$eval('#iqrTip',e=>!e.hidden),await T('#iqrCaption'));await p.screenshot({path:out+'/04-iqr.png'});
await p.selectOption('#reviewAction','keep');log(' after action: reason blinks',await p.$eval('#reviewReason',e=>e.classList.contains('guide')),'| action guide off',!(await p.$eval('#reviewAction',e=>e.classList.contains('guideLine'))));
await p.fill('#reviewReason','연습 자료 설명상 가능한 급감속이다');await p.click('#reviewSave');await p.waitForTimeout(200);log(' after save:',await T('#reviewCounts'),'| undo label',await T('#reviewUndo'));
await p.click('#rvSteps li[data-go="4"]');await p.waitForTimeout(200);log('step4 guide:',await p.$$eval('#afterSave li',l=>l.length),'| old note gone',!(await T('.rvStep[data-step="4"]')).includes('미해결 오류나'),'| dist',await T('#reviewDistribution'));
assert(!(await p.$('#reviewClose')),'운전 화면으로 버튼 삭제');
{const ows=await p.evaluate(async()=>{const r=await fetch(document.querySelector('#orangeGet').href);const t=await r.text();return {ok:r.ok,nodes:(t.match(/<node /g)||[]).length,links:(t.match(/<link /g)||[]).length};});log('ows download:',JSON.stringify(ows));assert(ows.ok&&ows.nodes===3&&ows.links===2,'Orange 작업 파일 다운로드');}
for(let k=0;k<5;k++){const li=p.locator('#afterSave li').nth(k);await li.scrollIntoViewIfNeeded();await li.hover();await p.waitForTimeout(k===4?3000:2200);
 const [a,b]=await Promise.all([li.boundingBox(),p.locator('#orangeTip').boundingBox()]);if(!a||!b){log('orange debug',JSON.stringify({a,b,tipHidden:await p.$eval('#orangeTip',e=>e.hidden),step:await p.$eval('.rvStep[data-step="4"]',e=>getComputedStyle(e).display),errs}));await p.screenshot({path:out+'/04-orange-debug.png'});}const hit=!(b.x>=a.x+a.width||b.x+b.width<=a.x||b.y>=a.y+a.height||b.y+b.height<=a.y);
 log(' orange clip',k+1,await T('#orangeTipHead'),'| overlap',hit);assert(!hit,'말풍선이 단계 글자를 가리지 않음');await p.screenshot({path:out+`/04-orange-${k+1}.png`});}
await p.mouse.move(5,5);await p.waitForTimeout(200);assert(await p.locator('#orangeTip').isHidden(),'벗어나면 말풍선 닫힘');
await p.click('#rvSteps li[data-go="3"]');await p.waitForTimeout(200);await p.hover('#reviewIssues .issue');await p.waitForTimeout(200);await p.screenshot({path:out+'/04-clip.png'});log('export state',await T('#reviewExportState'));log('errors',JSON.stringify(errs));
await b.close();})().catch(e=>{console.error('FAIL',e);process.exit(1)});
