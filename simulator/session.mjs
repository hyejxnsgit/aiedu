import {ICON} from './icons.mjs';
// 2차시·3차시 구분: 시작할 때 차시와 학습 목표를 보여주고, 선택한 차시를 주소(#s2, #s3)에 남긴다.
export const SESSIONS={
 2:{label:'2차시',question:'내 운전 선택을 차가 배울 수 있을까?',
  goals:['앞차가 멈추고 다시 출발할 때 직접 운전해 보며, 나만의 운전 기준을 알아보자.','내가 운전한 장면을 다시 보며, 생각한 대로 운전했는지 알아보자.','빠지거나 이상한 기록을 정리해 AI를 학습시키며, 좋은 데이터가 왜 중요한지 알아보자.'],
  steps:['조작 퀘스트','기준 정하고 기록 주행','장면 회고','1분 개념 학습','전처리 · Orange 파일'],
  highlights:['조작 퀘스트 4개로 가속·브레이크 익히기','내 운전 기준을 정하고 코스를 직접 달리기','내 운전 장면을 다시 보며 돌아보기','기록을 정리해 AI 학습 파일 만들기'],cabin:'운전대가 있는 차 안에서 직접 운전합니다.'},
 3:{label:'3차시',question:'배운 대로 달리면 안전하게 달릴까?',
  goals:['AI가 어떻게 달릴지 먼저 예상하고 자동 주행을 지켜보며, 내 예상과 무엇이 다른지 알아보자.','아슬아슬했던 장면 하나를 골라 다시 보며, AI가 왜 그렇게 운전했는지 알아보자.','운전 기록을 더 모아 AI를 다시 학습시키며, AI가 얼마나 좋아졌는지 알아보자.'],
  steps:['모델 불러오기','결과 예상','자동 주행','장면 분석','재학습 · 비교'],
  highlights:['내 AI가 어떻게 달릴지 먼저 예상하기','AI 자동 주행을 지켜보고 예상과 비교하기','아슬아슬한 장면을 골라 원인 찾기','기록을 보태 다시 학습하고 결과 비교하기'],cabin:'운전대가 없는 차 안에서 학습한 모델의 운전을 지켜봅니다.'},
};
const parse=()=>({'#s2':2,'#s3':3})[location.hash]??null;

export function installSessions({onChoose,gate=Promise.resolve()}){
 const dialog=document.createElement('dialog');dialog.id='sessionDialog';dialog.className='sessionDialog';dialog.tabIndex=-1;
 dialog.innerHTML=`<div class="sessionIntro"><p class="eyebrow">AI EDU 자율주행 수업</p><h2>오늘은 몇 차시인가요?</h2></div>
 <div class="sessionCards">${[2,3].map(n=>{const s=SESSIONS[n];return `<article class="sessionCard s${n}"><p class="sessionTag">${s.label}</p><h3>${s.question}</h3>
  <h4>학습 목표</h4><ol>${s.goals.map(g=>`<li>${g}</li>`).join('')}</ol>
  <h4>오늘의 흐름</h4><p class="sessionSteps">${s.steps.map((x,i)=>`<span style="--i:${i}">${x}</span>`).join('')}</p>
  <button class="start" data-session="${n}">${s.label} 시작하기</button></article>`;}).join('')}
 ${[2,3].map(n=>n===2
   // 2차시: 글자 없이, 실제 기록 주행에서 자른 2초 영상만 보여 준다(앞차가 감속하자 내 차도 브레이크).
   ?`<aside class="sessionBubble for2 videoOnly" aria-hidden="true"><div class="bubbleMedia" data-preview="2"><video src="media/s2-preview.mp4" muted loop playsinline autoplay preload="auto"></video></div></aside>`
   :`<aside class="sessionBubble for${n}" aria-hidden="true"><p class="bubbleTag">${SESSIONS[n].label}에서는 이런 걸 해요</p><div class="bubbleMedia" data-preview="${n}"></div><ul>${SESSIONS[n].highlights.map(h=>`<li>${ICON.checkCircleSolid}${h}</li>`).join('')}</ul></aside>`).join('')}</div>`;
 document.body.append(dialog);
 const open=()=>{dialog.showModal();dialog.focus();};// 열릴 때 버튼 대신 창 자체에 포커스(카드가 미리 강조되지 않게)
 // 차시 카드에 마우스를 올리거나(키보드로 고르면) 옆 카드 자리에 말풍선이 튀어나와 그 차시의 하이라이트를 보여준다. 떼면 사라진다.
 for(const n of [2,3]){const card=dialog.querySelector('.sessionCard.s'+n),bubble=dialog.querySelector('.sessionBubble.for'+n),show=v=>{bubble.classList.toggle('show',v);const vid=bubble.querySelector('video');if(vid){if(v){vid.currentTime=0;vid.play().catch(()=>{});}else vid.pause();}};
  card.addEventListener('mouseenter',()=>show(true));card.addEventListener('mouseleave',()=>show(card.contains(document.activeElement)));card.addEventListener('focusin',()=>show(true));card.addEventListener('focusout',()=>show(card.matches(':hover')));}
 const badge=document.getElementById('sessionBadge');
 let current=null;
 function apply(n){current=n;document.body.dataset.session=n;if(location.hash!=='#s'+n)history.replaceState(null,'','#s'+n);
  badge.innerHTML=`<b>${SESSIONS[n].label}</b><span>${SESSIONS[n].question}</span>`;badge.title='차시 바꾸기';onChoose(n);}
 dialog.addEventListener('cancel',e=>{if(!current)e.preventDefault();});
 for(const b of dialog.querySelectorAll('[data-session]'))b.onclick=()=>{dialog.close();apply(Number(b.dataset.session));};
 badge.onclick=open;
 const initial=parse();if(initial)apply(initial);else gate.then(open);
 return {current:()=>current,show:open};
}
