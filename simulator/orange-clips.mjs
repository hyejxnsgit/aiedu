// Orange 사용 순서를 보여 주는 짧은 그림 클립(실제 녹화가 아닌, Windows 화면을 본뜬 SVG 애니메이션).
// 각 클립은 SVG 장면과 시간표(커서 이동·클릭·보이기/숨기기·글자 입력·끌기)로 이루어진다.
const NS='http://www.w3.org/2000/svg';
const W=420,H=250;
const DATA='#ffcf8a',MODEL='#f6b3cf',EVAL='#9fe3e3';

const winBar=(x,y,w,title)=>`<rect x="${x}" y="${y}" width="${w}" height="20" fill="#fff"/><text x="${x+8}" y="${y+14}" class="oc-t">${title}</text>
 <text x="${x+w-50}" y="${y+14}" class="oc-ctl">─</text><text x="${x+w-33}" y="${y+14}" class="oc-ctl">□</text><text x="${x+w-15}" y="${y+14}" class="oc-ctl">✕</text>`;
const panel=(x,y,w,h,title,body,k,hide=true)=>`<g data-k="${k}"${hide?' data-hide':''}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#f7f7f8" stroke="#9aa3ad" filter="url(#ocS)"/>${winBar(x,y,w,title)}${body}</g>`;
const node=(cx,cy,label,color,k='',hide=false,glyph='')=>`<g${k?` data-k="${k}"`:''}${hide?' data-hide':''}><circle cx="${cx}" cy="${cy}" r="17" fill="${color}" stroke="#8a8f96"/>${glyph||`<rect x="${cx-7}" y="${cy-8}" width="14" height="16" rx="2" fill="#fff" stroke="#7d848c"/>`}<text x="${cx}" y="${cy+31}" text-anchor="middle" class="oc-n">${label}</text></g>`;
const treeGlyph=(cx,cy)=>`<path d="M${cx} ${cy-8}v5M${cx} ${cy-3}l-6 6M${cx} ${cy-3}l6 6" stroke="#6b4255" stroke-width="1.6" fill="none"/><circle cx="${cx}" cy="${cy-8}" r="2.4" fill="#6b4255"/><circle cx="${cx-6}" cy="${cy+4}" r="2.4" fill="#6b4255"/><circle cx="${cx+6}" cy="${cy+4}" r="2.4" fill="#6b4255"/>`;
const pyGlyph=(cx,cy)=>`<text x="${cx}" y="${cy+4}" text-anchor="middle" class="oc-g">{ }</text>`;
const tsGlyph=(cx,cy)=>`<path d="M${cx-7} ${cy+6}h14M${cx-5} ${cy+5}v-6M${cx} ${cy+5}v-11M${cx+5} ${cy+5}v-8" stroke="#2b6a6a" stroke-width="2.4"/>`;
const link=(x1,y1,x2,y2,label,k='',hide=false)=>`<g${k?` data-k="${k}"`:''}${hide?' data-hide':''}><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7f868e" stroke-width="1.6"/>${label?`<text x="${(x1+x2)/2}" y="${(y1+y2)/2-5}" text-anchor="middle" class="oc-l">${label}</text>`:''}</g>`;
const toast=(text,k,y=226)=>`<g data-k="${k}" data-hide><rect x="${W/2-150}" y="${y-14}" width="300" height="22" rx="11" fill="#ff8a2b"/><text x="${W/2}" y="${y+1}" text-anchor="middle" class="oc-toast">${text}</text></g>`;
const btn=(x,y,w,label,primary=false)=>`<rect x="${x}" y="${y}" width="${w}" height="17" rx="2" fill="${primary?'#e8f0fb':'#fff'}" stroke="${primary?'#2f6fd6':'#9aa3ad'}"/><text x="${x+w/2}" y="${y+12}" text-anchor="middle" class="oc-t">${label}</text>`;
// Orange 창: 제목줄 + 왼쪽 위젯 상자 + 작업 캔버스
const orange=(body,extraTool='')=>`<rect width="${W}" height="${H}" fill="#fafafa"/>${winBar(0,0,W,'Orange — model-save.ows')}
 <rect x="0" y="20" width="62" height="${H-20}" fill="#ececef"/><text x="8" y="36" class="oc-c">Data</text><circle cx="18" cy="50" r="8" fill="${DATA}"/><circle cx="40" cy="50" r="8" fill="${DATA}"/>
 <text x="8" y="80" class="oc-c">Model</text><circle cx="18" cy="94" r="8" fill="${MODEL}"/><circle cx="40" cy="94" r="8" fill="${MODEL}"/>
 <text x="8" y="124" class="oc-c">Evaluate</text><circle cx="18" cy="138" r="8" fill="${EVAL}"/><circle cx="40" cy="138" r="8" fill="${EVAL}"/>${extraTool}${body}`;
const base3=(linked=true)=>`${linked?link(148,120,222,120,'Data')+link(258,120,332,120,'Model → Classifier'):''}${node(130,120,'File',DATA)}${node(240,120,'Tree',MODEL,'',false,treeGlyph(240,120))}${node(350,120,'모델 저장',DATA,'',false,pyGlyph(350,120))}`;

export const CLIPS=[
 {title:'1. Orange 열기',caption:'받은 model-save.ows를 두 번 누르면 Orange가 열리고 File → Tree → 모델 저장이 이미 연결돼 있어요.',dur:5.6,
  svg:`<rect width="${W}" height="${H}" fill="#1f3a5a"/>
   ${panel(30,24,360,190,'다운로드',`<rect x="31" y="45" width="80" height="168" fill="#eef1f5"/><text x="40" y="64" class="oc-t">⬇ 다운로드</text><text x="40" y="84" class="oc-t">🖥 바탕 화면</text>
    <rect data-k="hl" data-hide x="116" y="56" width="268" height="20" fill="#cde3fb"/>
    <rect x="124" y="60" width="11" height="13" rx="2" fill="#ff8a2b"/><text x="142" y="70" class="oc-t">model-save.ows</text><text x="290" y="70" class="oc-m">Orange 작업 파일</text>
    <text x="142" y="94" class="oc-t">📄 train.tab</text><text x="290" y="94" class="oc-m">TAB 파일</text><text x="142" y="118" class="oc-t">📄 validation.tab</text><text x="290" y="118" class="oc-m">TAB 파일</text>`,'exp',false)}
   <g data-k="orw" data-hide>${orange(base3())}</g>${toast('준비된 작업 화면이 열렸어요','t1')}`,
  steps:[{t:0,cur:[330,210]},{t:1,cur:[170,67]},{t:1.15,click:1},{t:1.3,click:1},{t:1.2,show:'hl'},{t:1.7,hide:'exp'},{t:1.8,show:'orw'},{t:2.4,show:'t1'},{t:2.6,cur:[200,200]}]},
 {title:'2. 학습 파일 열기',caption:'File을 두 번 누르고 📁 버튼으로 train.tab을 골라요. 열면 입력 4개와 목표값이 자동으로 잡혀요.',dur:6.6,
  svg:orange(base3()+panel(150,36,240,150,'File',`<text x="160" y="76" class="oc-t">파일:</text><rect x="190" y="64" width="150" height="17" fill="#fff" stroke="#9aa3ad"/>
    <text data-k="f0" x="196" y="76" class="oc-m">(선택한 파일 없음)</text><text data-k="f1" data-hide x="196" y="76" class="oc-t">train.tab</text>
    <rect x="346" y="64" width="22" height="17" rx="2" fill="#fff" stroke="#9aa3ad"/><path d="M350 70h5l2 2h7v6h-14z" fill="#f4c55b" stroke="#a07a20" stroke-width=".6"/>
    <g data-k="fi" data-hide><text x="160" y="104" class="oc-t">152개 행 · 입력 4개</text><text x="160" y="122" class="oc-t">목표값: 1초 실제 변화</text><text x="160" y="140" class="oc-m">자료가 Tree로 전달돼요</text></g>`,'fp')
   +panel(90,60,250,140,'열기',`<rect data-k="hl" data-hide x="92" y="90" width="246" height="18" fill="#cde3fb"/><text x="102" y="103" class="oc-t">📄 train.tab</text><text x="102" y="125" class="oc-t">📄 validation.tab</text>
    ${btn(286,176,46,'열기',true)}`,'op')),
  steps:[{t:0,cur:[300,220]},{t:.8,cur:[130,120]},{t:1,click:1},{t:1.15,click:1},{t:1.3,show:'fp'},{t:2,cur:[357,73]},{t:2.1,click:1},{t:2.3,show:'op'},{t:2.9,cur:[140,99]},{t:3,click:1},{t:3,show:'hl'},{t:3.6,cur:[309,184]},{t:3.7,click:1},{t:3.85,hide:'op'},{t:3.9,hide:'f0'},{t:3.9,show:'f1'},{t:4.1,show:'fi'},{t:4.7,cur:[260,210]}]},
 {title:'3. 학습시키기',caption:'File의 오른쪽 끝에서 Tree로 끌어 연결하면, 연결된 자료로 Tree가 바로 학습해요.',dur:5.6,
  svg:orange(`${node(130,120,'File',DATA)}${node(240,120,'Tree',MODEL,'',false,treeGlyph(240,120))}<g opacity=".35">${node(350,120,'모델 저장',DATA,'',false,pyGlyph(350,120))}</g>
   <line data-k="dl" data-hide x1="148" y1="120" x2="148" y2="120" stroke="#2f6fd6" stroke-width="1.6" stroke-dasharray="4 3"/>${link(148,120,222,120,'Data','ln',true)}
   <circle data-k="dot" data-hide cx="148" cy="120" r="3.5" fill="#ff8a2b"/><circle data-k="gl" data-hide cx="240" cy="120" r="21" fill="none" stroke="#ff8a2b" stroke-width="2.5"/>`)+toast('Tree가 train.tab으로 학습했어요','t3'),
  steps:[{t:0,cur:[200,210]},{t:.9,cur:[149,120]},{t:1,show:'dl'},{t:1,follow:'dl',until:1.9},{t:1.9,cur:[222,120]},{t:2,hide:'dl'},{t:2,show:'ln'},{t:2.1,show:'dot'},{tw:'dot',attr:'cx',t0:2.1,t1:2.9,from:148,to:222},{t:2.95,hide:'dot'},{t:3,show:'gl'},{t:3.2,show:'t3'},{t:3.6,cur:[300,200]}]},
 {title:'4. 검증하기',caption:'Test & Score를 끌어 놓고, validation.tab을 연 두 번째 File을 Test Data로 연결해 처음 보는 기록으로 채점해요. (숫자는 예시)',dur:6.8,
  svg:orange(`${link(128,90,192,90,'Data')}${node(110,90,'File',DATA)}${node(210,90,'Tree',MODEL,'',false,treeGlyph(210,90))}
   ${link(228,98,304,142,'Learner','l1',true)}${link(128,190,302,156,'Test Data','l2',true)}${link(124,102,304,146,'Data','l3',true)}
   ${node(110,190,'File (validation.tab)',DATA,'f2',true)}${node(320,150,'Test & Score',EVAL,'ts',true,tsGlyph(320,150))}
   <g data-k="gh" data-hide opacity=".6"><circle cx="0" cy="0" r="17" fill="${EVAL}" stroke="#8a8f96"/></g>
   ${panel(140,40,260,120,'Test & Score',`<text x="152" y="80" class="oc-t">◉ 테스트 데이터로 평가</text><rect x="152" y="92" width="236" height="52" fill="#fff" stroke="#c3c8ce"/>
    <text x="160" y="108" class="oc-m">모델</text><text x="240" y="108" class="oc-m">RMSE</text><text x="310" y="108" class="oc-m">R²</text>
    <text x="160" y="130" class="oc-t">Tree</text><text x="240" y="130" class="oc-t">0.42</text><text x="310" y="130" class="oc-t">0.91</text>`,'res')}`),
  steps:[{t:0,cur:[260,220]},{t:.9,cur:[40,138]},{t:1,click:1},{t:1,show:'gh'},{t:1,follow:'gh',until:1.9,move:1},{t:1.9,cur:[320,150]},{t:2,hide:'gh'},{t:2,show:'ts'},{t:2.3,show:'f2'},{t:2.6,show:'l1'},{t:2.9,show:'l2'},{t:3.1,show:'l3'},{t:3.5,cur:[320,150]},{t:3.6,click:1},{t:3.75,click:1},{t:3.95,show:'res'},{t:4.6,cur:[250,215]}]},
 {title:'5. 모델 저장',caption:'모델 저장을 두 번 누르고 오른쪽 아래 Run → 저장 창에서 model.json으로 저장해요. 3차시 주행 설정의 "변환된 모델 JSON"에서 이 파일을 골라요.',dur:6.8,
  svg:orange(base3()+panel(120,30,290,196,'모델 저장 (Python Script)',`<rect x="128" y="58" width="274" height="132" fill="#fff" stroke="#c3c8ce"/>
    ${[0,1,2,3,4,5,6].map(i=>`<rect x="136" y="${66+i*17}" width="${[150,210,120,230,180,90,160][i]}" height="6" rx="3" fill="${i%3?'#cfd6de':'#b9c7f0'}"/>`).join('')}${btn(354,199,48,'Run',true)}`,'py')
   +panel(70,70,280,120,'3차시용 모델 저장',`<text x="82" y="118" class="oc-t">파일 이름:</text><rect x="140" y="105" width="196" height="18" fill="#fff" stroke="#2f6fd6"/><text data-k="fn" x="146" y="118" class="oc-t"></text>
    ${btn(222,160,56,'저장',true)}${btn(284,160,56,'취소')}`,'sv'))+toast('model.json 저장 완료!','t5'),
  steps:[{t:0,cur:[260,220]},{t:.9,cur:[350,120]},{t:1,click:1},{t:1.15,click:1},{t:1.35,show:'py'},{t:2,cur:[378,207]},{t:2.1,click:1},{t:2.4,show:'sv'},{type:'fn',t0:2.6,t1:3.4,text:'model.json'},{t:3.7,cur:[250,168]},{t:3.8,click:1},{t:3.95,hide:'sv'},{t:4.05,hide:'py'},{t:4.2,show:'t5'},{t:4.8,cur:[280,200]}]},
];

const ease=p=>p<.5?2*p*p:1-(-2*p+2)**2/2;
// 시각 t의 커서 위치: 앞뒤 커서 키 사이를 부드럽게 잇는다.
export function cursorAt(steps,t){const keys=steps.filter(s=>s.cur);let a=keys[0];for(const k of keys){if(k.t<=t)a=k;else{const p=ease((t-a.t)/(k.t-a.t||1));return [a.cur[0]+(k.cur[0]-a.cur[0])*p,a.cur[1]+(k.cur[1]-a.cur[1])*p];}}return a.cur;}
// 시각 t에 보이는 요소: 처음 상태에서 t까지의 보이기/숨기기를 차례로 적용한다.
export function visibleAt(steps,initial,t){const v=new Map(initial);for(const s of [...steps].sort((a,b)=>a.t-b.t)){if(s.t>t)break;if(s.show)v.set(s.show,true);if(s.hide)v.set(s.hide,false);}return v;}

export function mountClip(host,i){
 const c=CLIPS[i],svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('class','oc');svg.setAttribute('role','img');svg.setAttribute('aria-label',c.title+' 화면 예시');
 svg.innerHTML=`<defs><filter id="ocS" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity=".25"/></filter></defs>${c.svg}
  <circle data-ring cx="0" cy="0" r="0" fill="none" stroke="#2f6fd6" stroke-width="2"/><path data-cur d="M0 0v15l4-4 3 7 3-1-3-7h6z" fill="#fff" stroke="#111" stroke-width="1.1"/>`;
 host.replaceChildren(svg);
 const els=new Map([...svg.querySelectorAll('[data-k]')].map(e=>[e.dataset.k,e])),initial=[...els].map(([k,e])=>[k,!e.hasAttribute('data-hide')]);
 const cur=svg.querySelector('[data-cur]'),ring=svg.querySelector('[data-ring]'),clicks=c.steps.filter(s=>s.click);
 let raf=0,t0=performance.now();
 const frame=now=>{const t=((now-t0)/1000)%c.dur,[x,y]=cursorAt(c.steps,t);cur.setAttribute('transform',`translate(${x} ${y})`);
  for(const [k,on] of visibleAt(c.steps,initial,t))els.get(k).style.opacity=on?1:0;
  for(const s of c.steps){
   if(s.follow&&t>=s.t){const [fx,fy]=t<s.until?[x,y]:cursorAt(c.steps,s.until);const e=els.get(s.follow);if(s.move)e.setAttribute('transform',`translate(${fx} ${fy})`);else{e.setAttribute('x2',fx);e.setAttribute('y2',fy);}}
   if(s.follow&&t<s.t&&!s.move)els.get(s.follow).setAttribute('x2',els.get(s.follow).getAttribute('x1'));
   if(s.tw){const p=Math.min(1,Math.max(0,(t-s.t0)/(s.t1-s.t0)));els.get(s.tw).setAttribute(s.attr,s.from+(s.to-s.from)*p);}
   if(s.type){const p=Math.min(1,Math.max(0,(t-s.t0)/(s.t1-s.t0)));els.get(s.type).textContent=s.text.slice(0,Math.round(s.text.length*p))+(p>0&&p<1?'|':'');}}
  const k=clicks.find(s=>t>=s.t&&t<s.t+.35);if(k){const p=(t-k.t)/.35,[cx,cy]=cursorAt(c.steps,k.t);ring.setAttribute('cx',cx);ring.setAttribute('cy',cy);ring.setAttribute('r',3+12*p);ring.style.opacity=1-p;}else ring.style.opacity=0;
  raf=requestAnimationFrame(frame);};
 raf=requestAnimationFrame(frame);
 return {title:c.title,caption:c.caption,stop:()=>cancelAnimationFrame(raf)};
}
