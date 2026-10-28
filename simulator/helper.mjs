// AI 학습 도우미: 학생이 놓친 부분을 자동으로 짚어 주고(규칙형, 인터넷 없이), 자유 질문은 Claude가 답한다.
// 화면 코드는 window에 'aiedu:helper' 이벤트만 보내고, 조언 문장은 adviceFor가 정한다.
// 자유 질문은 preview.py의 POST /api/helper로 보낸다(API 키는 서버에만). 서버가 답하지 못하면 FAQ 답으로 바꾼다.

// 사건 → 조언 한 문장(없으면 null). 화면과 떨어진 순수 함수라 단위 테스트한다.
export function adviceFor(e={}){
 switch(e.type){
  case 'reflection-match':
   if(e.verdict==='broken'&&e.match==='yes')return '기록을 재 보면 기준과 달랐다고 나와요. 장면을 한 번 더 보고 "같았다"가 맞는지 확인해 볼까요?';
   if(e.verdict==='kept'&&e.match==='no')return '기록상으로는 기준을 지킨 걸로 나와요. 어떤 점이 달랐다고 느꼈는지 근거에 숫자로 적어 주세요.';
   return null;
  case 'evidence':
   if(!/\d/.test(e.text??''))return '근거에 숫자(초, m, km/h)를 하나 넣어 보세요. "9초에 거리 11m"처럼 쓰면 더 설득력 있어요.';
   return null;
  case 'review-decision':{
   const types=e.types??[];
   if(e.action==='exclude'&&types.includes('통계적 이상치 후보')&&!types.some(t=>t!=='통계적 이상치 후보'))return '통계적 이상치는 진짜 급정거일 수도 있어요. 주행 장면을 보고 실제 기록이면 "유지"가 맞아요.';
   if(e.action==='edit'&&types.includes('결측치'))return '빈칸을 0이나 짐작한 값으로 채우면 안 돼요. 원본 주행 기록에 값이 있을 때만 수정하고, 없으면 제외해요.';
   if(e.action==='keep'&&types.some(t=>t!=='통계적 이상치 후보'))return '형식·범위 오류가 있는 행은 그대로 두면 Orange가 잘못 배워요. 원본 근거로 수정하거나 제외해 주세요.';
   if((e.reason??'').trim().length<6)return '처리 이유를 조금 더 구체적으로 적어 주세요. 나중에 보고서의 근거가 돼요.';
   return null;}
  case 'forecast':
   if((e.reason??'').trim().length<8)return '예상한 이유에 위의 장면 예상(모델 값)을 근거로 넣어 보세요. "멈춘 앞차 장면에서 −14km/h였으니까"처럼요.';
   return null;
  case 'result':
   if(e.outcomeSame===false||e.violationSame===false)return '예상과 다른 결과가 나왔어요. 틀린 게 아니라 단서예요! "장면 골라 원인 분석하기"에서 언제부터 달라졌는지 찾아봐요.';
   if(e.outcomeSame&&e.violationSame)return '예상이 모두 맞았어요. 왜 맞았는지 장면 분석으로 확인하면 B 코스에서도 통할지 짐작할 수 있어요.';
   return null;
  case 'compare-run':
   if(!e.matched)return '이 조건으로 달린 다른 모델 기록이 아직 없어요. 공정하게 비교하려면 코스·노면·처음 거리를 첫 주행과 똑같이 맞춰요.';
   return null;
  case 'report-step':
   if(e.empty?.length)return `보고서에 아직 비어 있는 칸이 있어요: ${e.empty.join(', ')}. 비교표의 최소 거리·기준 미달 시간을 근거로 써 보세요.`;
   return null;
  case 'status':return statusAdvice(e.text);
 }
 return null;
}
// 이미 화면에 뜨는 검사 문구를 받아, 무엇을 하면 되는지 한 줄 덧붙인다.
function statusAdvice(text=''){
 if(/세 장면/.test(text))return '세 칸 모두 "내 예상"을 고르고 "모델 값 보기"를 눌러야 출발할 수 있어요. 반짝이는 칸부터 해 봐요.';
 if(/예상을 먼저/.test(text))return '모델 값을 보기 전에 내 예상부터 골라요. 먼저 짐작해 봐야 모델이 무엇을 배웠는지 비교할 수 있어요.';
 if(/이유를 모두|모두 남겨/.test(text))return '빈칸이 남아 있어요. 고르기 칸과 이유를 모두 채우면 다음으로 갈 수 있어요.';
 if(/배정|비율/.test(text))return '학습·검증 비율(예: 7:3)을 먼저 골라야 다음 단계로 갈 수 있어요.';
 return null;
}

// 자유 질문 답변: 낱말로 주제를 찾는다. 찾지 못하면 바로 쓸 수 있는 질문을 권한다.
export const FAQ=[
 {k:['결측','빈칸','비어'],a:'결측치는 값이 빠진 칸이에요. 0과 빈칸은 달라요! 0으로 채우면 "거리 0m"처럼 전혀 다른 뜻이 되니, 원본에 값이 없으면 그 행은 제외해요.'},
 {k:['이상치','iqr','울타리','튀는'],a:'이상치는 다른 값들과 동떨어진 값이에요. IQR 울타리 밖이라고 다 틀린 건 아니에요. 진짜 급정거면 유지하고, 300km/h처럼 불가능한 값은 제외해요.'},
 {k:['학습','검증','비율','7:3','나누'],a:'학습 자료로 모델을 가르치고, 검증 자료는 숨겨 뒀다가 처음 보는 기록도 잘 맞히는지 시험해요. 시험지를 미리 보면 실력을 알 수 없으니까요.'},
 {k:['트리','tree','나무','분기'],a:'결정 트리는 "거리가 12m보다 가까운가?" 같은 질문을 차례로 던져 속도 변화를 정해요. 내 기록에서 그 질문과 답을 배운 거예요.'},
 {k:['orange','오렌지','저장','model.json','json'],a:'Orange에서 File로 train.tab을 열고, 모델 저장 노드를 두 번 눌러 Run → model.json으로 저장해요. 3차시 주행 설정의 "변환된 모델 JSON"에서 고르면 돼요.'},
 {k:['기준 거리','기준','미달','안전거리'],a:'프로그램 기준 거리는 속도에 따라 필요한 차간거리예요. 그보다 가까워진 시간이 길수록 위험했던 주행이에요.'},
 {k:['비교','공정','같은 조건','●'],a:'모델끼리 비교할 때는 코스·노면·처음 거리를 똑같이 맞춰야 해요. 표에서 ● 표시가 있는 줄끼리만 공정한 비교예요.'},
 {k:['b 코스','b코스','처음 보는','다른 코스'],a:'B 코스는 모델이 한 번도 못 본 길이에요. A에서 잘해도 B에서 실수하면, 내 기록에 그런 장면이 부족했다는 뜻이에요.'},
 {k:['재학습','다시 학습','개선'],a:'장면 분석에서 찾은 약한 장면을 직접 운전해 기록 → 전처리에서 이어 붙이기 → Orange로 다시 학습 → model-2.json으로 저장하고 같은 조건으로 비교해요.'},
 {k:['예상','왜 예상','맞히'],a:'출발 전 예상은 점수가 아니에요. "내 기록이 이랬으니 모델은 이럴 거야"라고 먼저 생각해 보고, 결과와 비교하며 모델이 배운 것을 알아내는 활동이에요.'},
 {k:['보고서','결과 파일'],a:'보고서에는 사람이 한 선택, 확인한 사실, 근거(숫자), 개선의 범위를 써요. "A 코스에선 나아졌지만 B는 아직"처럼 범위를 솔직하게 쓰는 게 좋아요.'},
 {k:['충돌','부딪'],a:'충돌했다면 장면 분석에서 충돌 몇 초 전부터 모델이 충분히 감속하지 않았는지 봐요. 그 장면 같은 기록이 학습 자료에 부족했을 수 있어요.'},
];
export function answer(q=''){const s=q.toLowerCase().replace(/\s+/g,' ');
 let best=null,score=0;for(const f of FAQ){const n=f.k.filter(k=>s.includes(k)).length;if(n>score){best=f;score=n;}}
 return best?.a??'음, 그건 아직 제가 잘 몰라요. 아래 질문을 눌러 보거나 선생님께 물어봐요!';}
export const QUICK=['결측치는 0으로 채우면 안 돼요?','이상치는 다 지워야 해요?','학습·검증은 왜 나눠요?','모델끼리 공정하게 비교하려면?','B 코스에서 왜 달라요?'];

const BOT=`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="12" rx="4" fill="currentColor"/><circle cx="9.5" cy="13" r="1.6" fill="#05070a"/><circle cx="14.5" cy="13" r="1.6" fill="#05070a"/><path d="M12 7V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="3.4" r="1.4" fill="currentColor"/></svg>`;
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;

export function installHelper(){
 const root=document.createElement('div');root.className='aiHelper';
 root.innerHTML=`<div class="helpNudge" hidden role="status" aria-live="polite"><span class="helpText"></span><button class="helpX" aria-label="말풍선 닫기">×</button></div>
  <section class="helpPanel" hidden aria-label="AI 학습 도우미"><header><b>AI 학습 도우미</b><button class="helpClose" aria-label="도우미 닫기">×</button></header>
   <div class="helpLog"></div><div class="helpChips">${QUICK.map(q=>`<button>${q}</button>`).join('')}</div>
   <form class="helpForm"><input placeholder="궁금한 걸 물어보세요" maxlength="120" aria-label="질문"><button class="start">보내기</button></form></section>
  <button class="helpBot" aria-label="AI 학습 도우미 열기" title="AI 학습 도우미">${BOT}<i class="helpDot" hidden></i></button>`;
 document.body.append(root);
 const q=s=>root.querySelector(s),nudge=q('.helpNudge'),text=q('.helpText'),panel=q('.helpPanel'),log=q('.helpLog');
 let timer=0,hideTimer=0,last='';
 // 모달 창이 열리면 그 창 안으로 옮겨야 눌린다(모달 밖은 클릭이 막힘). 닫히면 다시 body로.
 const host=()=>[...document.querySelectorAll('dialog[open]')].filter(d=>!d.classList.contains('modelReveal')).at(-1)??document.body;
 const rehome=()=>{const h=host();if(root.parentElement!==h)h.append(root);};
 new MutationObserver(rehome).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open'],childList:true});
 function addLog(who,msg){const p=document.createElement('p');p.className=who;p.textContent=msg;log.append(p);log.scrollTop=log.scrollHeight;return p;}
 // 할 말이 생기면: 말풍선에 "..."(입력 중) → 한 글자씩 말한다. 같은 말은 연달아 반복하지 않는다.
 function say(msg){if(!msg||msg===last)return;last=msg;clearTimeout(timer);clearTimeout(hideTimer);rehome();
  nudge.hidden=false;nudge.classList.add('typing');text.textContent='';q('.helpDot').hidden=false;addLog('bot',msg);
  timer=setTimeout(()=>{nudge.classList.remove('typing');let i=0;const step=()=>{text.textContent=msg.slice(0,++i);if(i<msg.length)timer=setTimeout(step,REDUCED?0:22);else hideTimer=setTimeout(()=>{nudge.hidden=true;},9000);};step();},REDUCED?100:900);}
 // 앞 대화(최근 8개)와 지금 열린 창 제목을 함께 보낸다. 12초 안에 답이 없거나 오류면 정해 둔 답.
 const history=[];
 const where=()=>{const d=[...document.querySelectorAll('dialog[open]')].filter(d=>!d.classList.contains('modelReveal')).at(-1);
  return [location.hash.slice(1)==='s3'?'3차시':'2차시',d?.querySelector('h2')?.textContent].filter(Boolean).join(' · ');};
 // Claude 답변은 교실 Mac의 preview.py(127.0.0.1)에만 있다. GitHub Pages 같은 공개 사이트에서는 정해 둔 답만 쓴다.
 const LOCAL=['127.0.0.1','localhost'].includes(location.hostname);
 async function reply(question){
  if(LOCAL)try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),12000);
   const r=await fetch('api/helper',{method:'POST',headers:{'Content-Type':'application/json'},signal:ctl.signal,body:JSON.stringify({question,context:where(),history:history.slice(-8)})});
   clearTimeout(t);const j=await r.json().catch(()=>({}));if(r.ok&&j.answer)return j.answer;}catch{}
  return answer(question);}
 let busy=false;
 async function ask(question){question=question.trim();if(!question||busy)return;busy=true;addLog('me',question);const p=addLog('bot typing','');
  const started=Date.now(),a=await reply(question),wait=Math.max(0,(REDUCED?50:700)-(Date.now()-started));
  setTimeout(()=>{p.className='bot';p.textContent=a;log.scrollTop=log.scrollHeight;history.push({who:'me',text:question},{who:'bot',text:a});busy=false;},wait);}
 q('.helpBot').onclick=()=>{panel.hidden=!panel.hidden;nudge.hidden=true;q('.helpDot').hidden=true;if(!panel.hidden){if(!log.children.length)addLog('bot','안녕하세요! 저는 AI 학습 도우미예요. 실수할 만한 곳이 보이면 먼저 알려 줄게요. 궁금한 건 아래에서 물어보세요.');q('.helpForm input').focus();}};
 q('.helpClose').onclick=()=>{panel.hidden=true;};q('.helpX').onclick=()=>{nudge.hidden=true;};
 q('.helpChips').onclick=e=>{const b=e.target.closest('button');if(b)ask(b.textContent);};
 q('.helpForm').onsubmit=e=>{e.preventDefault();const i=q('.helpForm input');ask(i.value);i.value='';};
 addEventListener('aiedu:helper',e=>say(adviceFor(e.detail)));
 // 화면의 검사 문구(role=status)가 바뀌면 그 문구에 맞는 조언을 한다.
 new MutationObserver(ms=>{for(const m of ms){const el=m.target.nodeType===1?m.target:m.target.parentElement;if(el?.matches?.('.evalMessage,#reviewMessage,#reflectionMessage,#splitWarn'))say(adviceFor({type:'status',text:el.textContent}));}})
  .observe(document.body,{subtree:true,childList:true,characterData:true});
 return {say,ask};
}
export const helperEvent=detail=>dispatchEvent(new CustomEvent('aiedu:helper',{detail}));
