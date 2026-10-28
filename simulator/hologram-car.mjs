// 시작 화면용 홀로그램 세단. 차 표면을 가로(단면)·세로(길이) 격자로 직접 짜서, 격자선이 고르게 보이게 한다.
// 외부 차 모델·브랜드 로고를 쓰지 않는다. 좌표: 앞쪽 +z, 위 +y, 길이 약 4.7m.
import * as THREE from 'three';

// 옆모습 지붕선(z, 높이). Catmull-Rom 곡선으로 매끄럽게 잇는다.
const ROOF=new THREE.CatmullRomCurve3([[-2.36,.66],[-2.28,.86],[-1.75,.95],[-1.2,1.0],[-.8,1.36],[-.2,1.47],[.45,1.45],[.95,1.2],[1.35,.98],[1.95,.88],[2.3,.76],[2.38,.56]].map(([z,y])=>new THREE.Vector3(0,y,z)),false,'centripetal');
const LEN=[-2.36,2.38];
function roofAt(z){ // 곡선에서 z에 해당하는 높이(이분 탐색)
 let lo=0,hi=1;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(ROOF.getPoint(m).z<z)lo=m;else hi=m;}return ROOF.getPoint((lo+hi)/2).y;}
const BOTTOM=.3;
const beltAt=z=>.97+.04*Math.max(0,-z)/2.3;          // 창문 아래선(뒤로 갈수록 살짝 올라감)
const cabin=z=>z>-1.25&&z<1.3;                         // 유리 구간
function halfWidth(z){const k=Math.abs(z-.01)/2.4;return .93*Math.pow(Math.max(0,1-Math.pow(k,5)),.32);}
// 단면 위의 한 점: v는 왼쪽 아래(0) → 지붕(0.5) → 오른쪽 아래(1). 각진 초타원으로 차체다운 단면을 만든다.
export function surfacePoint(u,v,out=new THREE.Vector3()){
 const z=LEN[0]+(LEN[1]-LEN[0])*u,top=roofAt(z),mid=(top+BOTTOM)/2,half=(top-BOTTOM)/2,w=halfWidth(z);
 const th=Math.PI*(1.5-v*2),c=Math.cos(th),s=Math.sin(th),p=.28;// th: 아래(-90°)→왼쪽→위→오른쪽→아래
 let x=w*Math.sign(c)*Math.pow(Math.abs(c),p),y=mid+half*Math.sign(s)*Math.pow(Math.abs(s),p);
 const belt=beltAt(z);if(y>belt&&top>belt+.05){const t=(y-belt)/(top-belt);x*=1-.24*Math.pow(t,1.15);}// 위로 갈수록 좁아지는 유리 부분
 return out.set(-x,y,z);
}
function strip(points){const a=[];for(let i=0;i<points.length-1;i++)a.push(points[i],points[i+1]);return a;}

export function buildHologramCar({nu=64,nv=34}={}){
 // 1) 면: 거의 투명한 껍질(가장자리 발광용)
 const pos=[],idx=[],P=new THREE.Vector3();
 for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){surfacePoint(i/nu,.02+.96*j/nv,P);pos.push(P.x,P.y,P.z);}
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;idx.push(a,b,a+1,b,b+1,a+1);}
 const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));shell.setIndex(idx);shell.computeVertexNormals();
 // 2) 격자선: 단면 고리 + 길이 방향 선. 점마다 '강조' 값(0~1)을 넣어 특징선은 더 밝게.
 const L=[],W=[];const push=(pts,weight)=>{for(const p of strip(pts)){L.push(p.x,p.y,p.z);W.push(weight);}};
 const ring=(u,a=.02,b=.98,n=60)=>Array.from({length:n+1},(_,k)=>surfacePoint(u,a+(b-a)*k/n));
 const along=(v,u0=0,u1=1,n=120)=>Array.from({length:n+1},(_,k)=>surfacePoint(u0+(u1-u0)*k/n,v));
 for(let i=0;i<=nu;i++)push(ring(i/nu),.35);
 for(let j=0;j<=nv;j++)push(along(.02+.96*j/nv),.35);
 // 특징선: 창문 아래선, 문 틈, 앞뒤 유리 테두리
 const uOf=z=>(z-LEN[0])/(LEN[1]-LEN[0]);
 const vAtY=(u,y,side)=>{let lo=side<0?0:.5,hi=side<0?.5:1;for(let k=0;k<30;k++){const m=(lo+hi)/2,py=surfacePoint(u,m).y;if((side<0)===(py<y))lo=m;else hi=m;}return (lo+hi)/2;};
 for(const side of [-1,1]){
  const belt=[];for(let k=0;k<=80;k++){const u=uOf(-2.2+4.45*k/80);belt.push(surfacePoint(u,vAtY(u,beltAt(LEN[0]+(LEN[1]-LEN[0])*u),side)));}push(belt,1);
  for(const z of [-1.25,-.05,1.3]){const u=uOf(z),v0=vAtY(u,.42,side),v1=vAtY(u,beltAt(z)-.02,side);push(Array.from({length:21},(_,k)=>surfacePoint(u,v0+(v1-v0)*k/20)),.9);}// 문 틈
  for(const z of [-1.2,-.1,1.25]){const u=uOf(z),v0=vAtY(u,beltAt(z)+.03,side),v1=side<0?.47:.53;push(Array.from({length:21},(_,k)=>surfacePoint(u,v0+(v1-v0)*k/20)),1);}// 창문 기둥
 }
 const lines=new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(L,3));lines.setAttribute('weight',new THREE.Float32BufferAttribute(W,1));
 // 3) 등화: 헤드라이트·테일램프·그릴(로고 없음) 윤곽
 const lamps=[];const box=(cx,cy,cz,w,h,tilt=0)=>{const q=[[-w,-h],[w,-h],[w,h],[-w,h],[-w,-h]].map(([x,y])=>new THREE.Vector3(cx+x,cy+y,cz+tilt*x));for(const p of strip(q))lamps.push(p.x,p.y,p.z);};
 for(const s of [-1,1]){box(s*.6,.72,2.3,.2,.055,-.18*s);box(s*.62,.86,-2.27,.22,.05,.12*s);}
 box(0,.5,2.37,.42,.09);box(0,.5,2.37,.34,.05);
 const lamp=new THREE.BufferGeometry();lamp.setAttribute('position',new THREE.Float32BufferAttribute(lamps,3));
 return {shell,lines,lamp};
}

// 바퀴: 타이어 고리 + 림 + 5쌍 스포크를 선으로
export function buildWheel(r=.4,width=.24){
 const L=[];const circle=(rad,x,n=48)=>{const pts=[];for(let k=0;k<=n;k++){const a=k/n*Math.PI*2;pts.push(new THREE.Vector3(x,Math.sin(a)*rad,Math.cos(a)*rad));}return pts;};
 const add=pts=>{for(const p of strip(pts))L.push(p.x,p.y,p.z);};
 for(const x of [-width/2,width/2]){add(circle(r,x));add(circle(r*.68,x));}
 add(circle(r*.62,width/2+.01));add(circle(r*.16,width/2+.01));
 for(let k=0;k<36;k++){const a=k/36*Math.PI*2;add([new THREE.Vector3(-width/2,Math.sin(a)*r,Math.cos(a)*r),new THREE.Vector3(width/2,Math.sin(a)*r,Math.cos(a)*r)]);}// 타이어 홈
 for(let k=0;k<5;k++)for(const d of [-.09,.09]){const a=k/5*Math.PI*2+d;add([new THREE.Vector3(width/2+.01,Math.sin(a)*r*.16,Math.cos(a)*r*.16),new THREE.Vector3(width/2+.01,Math.sin(a+d*.4)*r*.62,Math.cos(a+d*.4)*r*.62)]);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(L,3));return g;
}
